const prisma = require('../prisma');
const {
  idParamSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryQuerySchema,
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

// Get single inventory item by ID
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
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    return res.status(200).json({
      item: {
        ...item,
        isLowStock: item.quantity <= item.reorderLevel,
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

    const { name, unit, quantity = 0, reorderLevel = 0 } = parsed.data;

    const item = await prisma.inventoryItem.create({
      data: {
        gpId: req.user.gpId,
        name,
        unit,
        quantity,
        reorderLevel,
      },
    });

    return res.status(201).json({
      item: {
        ...item,
        isLowStock: item.quantity <= item.reorderLevel,
      },
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

module.exports = {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
};
