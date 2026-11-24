const prisma = require('../prisma');
const {
  idParamSchema,
  RECEIPT_CATEGORIES,
  EXPENSE_CATEGORIES,
  createReceiptSchema,
  createExpenseSchema,
  listLedgerEntriesQuerySchema,
  updateLedgerEntrySchema,
} = require('../utils/financeUtil');

// Add Receipt (POST /api/finance/receipts) - Admin only
async function addReceipt(req, res, next) {
  try {
    const parsed = createReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { category, amountPaise, date, mode, reference, description } =
      parsed.data;

    const entry = await prisma.ledgerEntry.create({
      data: {
        gpId: req.user.gpId,
        type: 'RECEIPT',
        category,
        amount: amountPaise,
        date,
        mode,
        reference: reference ? reference.trim() : null,
        description: description ? description.trim() : null,
        isSystem: false,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      entry: {
        ...entry,
        amountPaise: entry.amount,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Add Expense (POST /api/finance/expenses) - Admin only
async function addExpense(req, res, next) {
  try {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { category, amountPaise, date, mode, description, assetId } =
      parsed.data;

    // If assetId is provided, verify it exists and belongs to the user's gpId
    if (assetId) {
      const asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          gpId: req.user.gpId,
        },
      });

      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        gpId: req.user.gpId,
        type: 'EXPENSE',
        category,
        amount: amountPaise,
        date,
        mode,
        description: description ? description.trim() : null,
        assetId: assetId || null,
        isSystem: false,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      entry: {
        ...entry,
        amountPaise: entry.amount,
      },
    });
  } catch (err) {
    next(err);
  }
}

// List Entries (GET /api/finance/entries) - Admin only
async function listLedgerEntries(req, res, next) {
  try {
    const parsed = listLedgerEntriesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { startDate, endDate, type, category } = parsed.data;

    const where = {
      gpId: req.user.gpId,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    const rawEntries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const entries = rawEntries.map((e) => ({
      ...e,
      amountPaise: e.amount,
      user: e.createdBy
        ? { id: e.createdBy.id, name: e.createdBy.name }
        : null,
    }));

    return res.status(200).json({
      entries,
      total: entries.length,
    });
  } catch (err) {
    next(err);
  }
}

// Edit Entry (PUT or PATCH /api/finance/entries/:id) - Admin only
async function updateLedgerEntry(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid entry id' });
    }

    const { id } = req.params;

    // Verify entry exists and belongs to the user's GP
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }

    // System-Entry Lock: System-generated bill payments cannot be edited
    if (existing.isSystem) {
      return res.status(400).json({
        error: 'System-generated bill payment entries cannot be edited',
      });
    }

    const parsed = updateLedgerEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const data = parsed.data;

    // Category validation for entry's type
    const effectiveCategory =
      data.category !== undefined ? data.category : existing.category;
    if (existing.type === 'RECEIPT') {
      if (!RECEIPT_CATEGORIES.includes(effectiveCategory)) {
        return res.status(400).json({
          error: `Category must be one of: ${RECEIPT_CATEGORIES.join(', ')}`,
        });
      }
    } else {
      if (!EXPENSE_CATEGORIES.includes(effectiveCategory)) {
        return res.status(400).json({
          error: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`,
        });
      }
    }

    // Build update object
    const updateData = {};
    if (data.category !== undefined) updateData.category = data.category;
    if (data.amountPaise !== undefined) updateData.amount = data.amountPaise;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.mode !== undefined) updateData.mode = data.mode;
    if (data.reference !== undefined) {
      updateData.reference = data.reference ? data.reference.trim() : null;
    }
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    // Asset validation if assetId is provided on an expense
    if (data.assetId !== undefined) {
      if (existing.type === 'EXPENSE' && data.assetId) {
        const asset = await prisma.asset.findFirst({
          where: {
            id: data.assetId,
            gpId: req.user.gpId,
          },
        });
        if (!asset) {
          return res.status(404).json({ error: 'Asset not found' });
        }
        updateData.assetId = data.assetId;
      } else {
        updateData.assetId = data.assetId;
      }
    }

    const updated = await prisma.ledgerEntry.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json({
      entry: {
        ...updated,
        amountPaise: updated.amount,
        user: updated.createdBy
          ? { id: updated.createdBy.id, name: updated.createdBy.name }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Delete Entry (DELETE /api/finance/entries/:id) - Admin only
async function deleteLedgerEntry(req, res, next) {
  try {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid entry id' });
    }

    const { id } = req.params;

    // Verify entry exists and belongs to the user's GP
    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }

    // System-Entry Lock: System-generated bill payments cannot be deleted
    if (existing.isSystem) {
      return res.status(400).json({
        error: 'System-generated bill payment entries cannot be deleted',
      });
    }

    await prisma.ledgerEntry.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      message: 'Ledger entry deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addReceipt,
  addExpense,
  listLedgerEntries,
  updateLedgerEntry,
  deleteLedgerEntry,
};
