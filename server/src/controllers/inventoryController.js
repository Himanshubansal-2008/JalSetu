const prisma = require('../prisma');
const {
  idParamSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryQuerySchema,
  stockInSchema,
  stockOutSchema,
} = require('../utils/inventoryUtil');

// List inventory items with optional search and lowStockOnly filter
async function listInventoryItems(req, res, next) {
  try {
    const parsed = listInventoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { search, lowStockOnly } = parsed.data;

    const where = {
      gpId: req.user.gpId,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Query all items for this GP matching search
    const rawItems = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Compute isLowStock for each item
    const allItemsWithFlag = rawItems.map((item) => ({
      ...item,
      isLowStock: item.quantity <= item.reorderLevel,
    }));

    // Summary count of low-stock items in this GP
    const lowStockCount = allItemsWithFlag.filter((item) => item.isLowStock).length;

    // Filter if lowStockOnly is true
    let items = allItemsWithFlag;
    if (lowStockOnly) {
      items = items.filter((item) => item.isLowStock);
    }

    // Sort: low-stock items first, then alphabetical by name
    items.sort((a, b) => {
      if (a.isLowStock !== b.isLowStock) {
        return a.isLowStock ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      items,
      total: items.length,
      lowStockCount,
    });
  } catch (err) {
    next(err);
  }
}

// Get single inventory item by ID with full transaction history
async function getInventoryItem(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const { id } = req.params;

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
      include: {
        txns: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            quantity: true,
            note: true,
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            asset: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const transactions = item.txns.map((t) => ({
      id: t.id,
      type: t.type,
      quantity: t.quantity,
      note: t.note,
      createdAt: t.createdAt,
      user: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
      createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
      asset: t.asset
        ? { id: t.asset.id, name: t.asset.name, type: t.asset.type }
        : null,
    }));

    return res.status(200).json({
      item: {
        id: item.id,
        gpId: item.gpId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        createdAt: item.createdAt,
        isLowStock: item.quantity <= item.reorderLevel,
        txns: transactions,
        transactions,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Create new inventory item (Admin only)
async function createInventoryItem(req, res, next) {
  try {
    const parsed = createInventoryItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { name, unit, reorderLevel = 0 } = parsed.data;
    const initialQuantity =
      parsed.data.initialQuantity !== undefined
        ? parsed.data.initialQuantity
        : (parsed.data.quantity || 0);

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          gpId: req.user.gpId,
          name,
          unit,
          quantity: initialQuantity,
          reorderLevel,
        },
      });

      let txn = null;
      if (initialQuantity > 0) {
        txn = await tx.stockTxn.create({
          data: {
            itemId: item.id,
            type: 'IN',
            quantity: initialQuantity,
            note: 'Initial stock',
            createdById: req.user.id,
          },
        });
      }

      return { item, txn };
    });

    return res.status(201).json({
      item: {
        ...result.item,
        isLowStock: result.item.quantity <= result.item.reorderLevel,
      },
      transaction: result.txn,
    });
  } catch (err) {
    next(err);
  }
}

// Update inventory item (Admin only, quantity locked)
async function updateInventoryItem(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const parsed = updateInventoryItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { id } = req.params;

    // Verify item exists and belongs to the user's GP
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Build update data from allowed updatable fields only (quantity strictly locked)
    const updateData = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.unit !== undefined) updateData.unit = parsed.data.unit;
    if (parsed.data.reorderLevel !== undefined) {
      updateData.reorderLevel = parsed.data.reorderLevel;
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: updateData,
    });

    return res.status(200).json({
      item: {
        ...updated,
        isLowStock: updated.quantity <= updated.reorderLevel,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Delete inventory item (Admin only, blocks if StockTxn exists)
async function deleteInventoryItem(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const { id } = req.params;

    // Verify item exists and belongs to the user's GP
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Check if any StockTxn records exist for this item
    const txnCount = await prisma.stockTxn.count({
      where: { itemId: id },
    });

    if (txnCount > 0) {
      return res.status(400).json({
        error:
          'Cannot delete inventory item with existing stock transaction history',
      });
    }

    await prisma.inventoryItem.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      message: 'Inventory item deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

// Stock IN (Admin only): Increment quantity and record StockTxn
async function stockIn(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const parsed = stockInSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { id } = req.params;
    const { quantity, note } = parsed.data;

    // Verify item exists and belongs to logged-in user's GP
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // Run inside a single prisma.$transaction
    const [updatedItem, transaction] = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          quantity: {
            increment: quantity,
          },
        },
      });

      const txn = await tx.stockTxn.create({
        data: {
          itemId: existing.id,
          type: 'IN',
          quantity,
          note: note && note.trim() ? note.trim() : null,
          createdById: req.user.id,
        },
      });

      return [item, txn];
    });

    return res.status(201).json({
      item: {
        ...updatedItem,
        isLowStock: updatedItem.quantity <= updatedItem.reorderLevel,
      },
      transaction,
    });
  } catch (err) {
    next(err);
  }
}

// Stock OUT (Admin and Worker): Decrement quantity with atomic negative-stock guard
async function stockOut(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid item id' });
    }

    const parsed = stockOutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { id } = req.params;
    const { quantity, note, assetId } = parsed.data;

    // Verify inventory item exists and belongs to logged-in user's GP
    const existing = await prisma.inventoryItem.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    // If assetId is provided, verify that the asset exists AND belongs to the same GP
    if (assetId) {
      const existingAsset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          gpId: req.user.gpId,
        },
      });

      if (!existingAsset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
    }

    // Atomic Negative-Stock Guard in prisma.$transaction using atomic updateMany lock
    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.inventoryItem.updateMany({
        where: {
          id: existing.id,
          gpId: req.user.gpId,
          quantity: { gte: quantity },
        },
        data: {
          quantity: { decrement: quantity },
        },
      });

      if (updateResult.count === 0) {
        const err = new Error('Insufficient stock available');
        err.statusCode = 400;
        throw err;
      }

      const txn = await tx.stockTxn.create({
        data: {
          itemId: existing.id,
          type: 'OUT',
          quantity,
          note: note && note.trim() ? note.trim() : null,
          assetId: assetId || null,
          createdById: req.user.id,
        },
      });

      const updatedItem = await tx.inventoryItem.findUnique({
        where: { id: existing.id },
      });

      return { item: updatedItem, transaction: txn };
    });

    return res.status(201).json({
      item: {
        ...result.item,
        isLowStock: result.item.quantity <= result.item.reorderLevel,
      },
      transaction: result.transaction,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  stockIn,
  stockOut,
};
