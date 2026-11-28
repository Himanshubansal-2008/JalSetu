const prisma = require('../prisma');
const {
  idParamSchema,
  RECEIPT_CATEGORIES,
  EXPENSE_CATEGORIES,
  normalizeDateToUtcMidnight,
  normalizeDateToEndOfDay,
  resolveMonthRange,
  createReceiptSchema,
  createExpenseSchema,
  listLedgerEntriesQuerySchema,
  updateLedgerEntrySchema,
  cashBookQuerySchema,
  monthlySummaryQuerySchema,
} = require('../utils/financeUtil');
const { parsePagination } = require('../utils/paginationUtil');

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

    const { amount, ...cleanEntry } = entry;
    return res.status(201).json({
      entry: {
        ...cleanEntry,
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

    const { category, amountPaise, date, mode, description, reference, assetId } =
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
        reference: reference ? reference.trim() : null,
        assetId: assetId || null,
        isSystem: false,
        createdById: req.user.id,
      },
    });

    const { amount, ...cleanEntry } = entry;
    return res.status(201).json({
      entry: {
        ...cleanEntry,
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

    const entries = rawEntries.map((e) => {
      const { amount, ...cleanE } = e;
      return {
        ...cleanE,
        amountPaise: e.amount,
        user: e.createdBy
          ? { id: e.createdBy.id, name: e.createdBy.name }
          : null,
      };
    });

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

    if (existing.voided) {
      return res.status(400).json({
        error: 'Voided ledger entries cannot be edited',
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

    // Asset validation whenever assetId is provided (on either expenses or receipts)
    if (data.assetId !== undefined) {
      if (data.assetId) {
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
        updateData.assetId = null;
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

    const { amount, ...cleanUpdated } = updated;
    return res.status(200).json({
      entry: {
        ...cleanUpdated,
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

// Soft-void Entry (DELETE /api/finance/entries/:id) - Admin only
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

    // System-Entry Lock: System-generated bill payments cannot be deleted via finance route
    if (existing.isSystem) {
      return res.status(400).json({
        error: 'System-generated bill payment entries cannot be deleted',
      });
    }

    if (existing.voided) {
      return res.status(400).json({
        error: 'Ledger entry is already voided',
      });
    }

    const voidReason = req.body?.voidReason || req.body?.reason || 'Voided by administrator';

    const voidedEntry = await prisma.ledgerEntry.update({
      where: { id: existing.id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidedById: req.user.id,
        voidReason,
      },
    });

    return res.status(200).json({
      message: 'Ledger entry voided successfully',
      entry: voidedEntry,
    });
  } catch (err) {
    next(err);
  }
}

// Cash Book (GET /api/finance/cashbook) - Admin only
async function getCashBook(req, res, next) {
  try {
    const parsed = cashBookQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { startDate: qStart, endDate: qEnd, month: qMonth } = parsed.data;

    let startDateObj;
    let endDateObj;

    if (qStart && qEnd) {
      const start = normalizeDateToUtcMidnight(qStart);
      const end = normalizeDateToEndOfDay(qEnd);
      if (!start || !end) {
        return res.status(400).json({
          error:
            'Invalid startDate or endDate format (must be YYYY-MM-DD or valid ISO date)',
        });
      }
      if (start > end) {
        return res
          .status(400)
          .json({ error: 'startDate cannot be after endDate' });
      }
      startDateObj = start;
      endDateObj = end;
    } else if (qMonth) {
      const monthRange = resolveMonthRange(qMonth);
      if (!monthRange) {
        return res
          .status(400)
          .json({ error: 'Invalid month format (must be YYYY-MM)' });
      }
      startDateObj = monthRange.startDate;
      endDateObj = monthRange.endDate;
    } else {
      // Default to current month
      const monthRange = resolveMonthRange();
      startDateObj = monthRange.startDate;
      endDateObj = monthRange.endDate;
    }

    // 1. Fetch logged-in GP's opening balance
    const gp = await prisma.gramPanchayat.findUnique({
      where: { id: req.user.gpId },
      select: { openingBalancePaise: true },
    });
    const baseOpeningBalancePaise = gp?.openingBalancePaise ?? 0;

    // 2. Opening Balance at start of period = baseOpeningBalancePaise + prior non-voided receipts - prior non-voided expenses
    const [priorReceipts, priorExpenses] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: {
          gpId: req.user.gpId,
          type: 'RECEIPT',
          voided: false,
          date: { lt: startDateObj },
        },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          gpId: req.user.gpId,
          type: 'EXPENSE',
          voided: false,
          date: { lt: startDateObj },
        },
        _sum: { amount: true },
      }),
    ]);

    const openingBalancePaise =
      baseOpeningBalancePaise +
      (priorReceipts._sum.amount ?? 0) -
      (priorExpenses._sum.amount ?? 0);

    // Entries in range [startDateObj, endDateObj] sorted chronologically oldest-first
    const rawEntries = await prisma.ledgerEntry.findMany({
      where: {
        gpId: req.user.gpId,
        date: {
          gte: startDateObj,
          lte: endDateObj,
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
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

    let runningBalance = openingBalancePaise;
    let totalReceiptsPaise = 0;
    let totalExpensesPaise = 0;

    const entries = rawEntries.map((e) => {
      // Exclude voided rows from balance calculations (₹0 balance impact)
      if (!e.voided) {
        if (e.type === 'RECEIPT') {
          runningBalance += e.amount;
          totalReceiptsPaise += e.amount;
        } else if (e.type === 'EXPENSE') {
          runningBalance -= e.amount;
          totalExpensesPaise += e.amount;
        }
      }

      const { amount, ...cleanE } = e;
      return {
        ...cleanE,
        amountPaise: e.amount,
        runningBalancePaise: runningBalance,
        status: e.voided ? 'VOIDED' : 'ACTIVE',
        user: e.createdBy
          ? { id: e.createdBy.id, name: e.createdBy.name }
          : null,
      };
    });

    const closingBalancePaise =
      openingBalancePaise + totalReceiptsPaise - totalExpensesPaise;

    const { isPaginated, page, limit, skip } = parsePagination(req.query);
    const total = entries.length;
    const totalPages = isPaginated ? (Math.ceil(total / limit) || 1) : 1;
    const paginatedEntries = isPaginated ? entries.slice(skip, skip + limit) : entries;

    return res.status(200).json({
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString(),
      openingBalancePaise,
      totalReceiptsPaise,
      totalExpensesPaise,
      closingBalancePaise,
      items: paginatedEntries,
      entries: paginatedEntries,
      total,
      page: isPaginated ? page : 1,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}

// Monthly Summary (GET /api/finance/summary) - Admin only
async function getMonthlySummary(req, res, next) {
  try {
    const parsed = monthlySummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const monthRange = resolveMonthRange(parsed.data.month);
    if (!monthRange) {
      return res
        .status(400)
        .json({ error: 'Invalid month format (must be YYYY-MM)' });
    }

    const { month, startDate, endDate } = monthRange;

    // Fetch logged-in GP's opening balance
    const gp = await prisma.gramPanchayat.findUnique({
      where: { id: req.user.gpId },
      select: { openingBalancePaise: true },
    });
    const baseOpeningBalancePaise = gp?.openingBalancePaise ?? 0;

    // Prior non-voided receipts and expenses before startDate
    const [priorReceipts, priorExpenses] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: {
          gpId: req.user.gpId,
          type: 'RECEIPT',
          voided: false,
          date: { lt: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          gpId: req.user.gpId,
          type: 'EXPENSE',
          voided: false,
          date: { lt: startDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const openingBalancePaise =
      baseOpeningBalancePaise +
      (priorReceipts._sum.amount ?? 0) -
      (priorExpenses._sum.amount ?? 0);

    // Aggregation via groupBy on type and category for non-voided entries
    const groups = await prisma.ledgerEntry.groupBy({
      by: ['type', 'category'],
      where: {
        gpId: req.user.gpId,
        voided: false,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const incomeCategories = [];
    let totalIncomePaise = 0;

    const expenseCategories = [];
    let totalExpensePaise = 0;

    for (const group of groups) {
      const sumAmount = group._sum.amount ?? 0;
      if (group.type === 'RECEIPT') {
        incomeCategories.push({
          category: group.category,
          amountPaise: sumAmount,
        });
        totalIncomePaise += sumAmount;
      } else if (group.type === 'EXPENSE') {
        expenseCategories.push({
          category: group.category,
          amountPaise: sumAmount,
        });
        totalExpensePaise += sumAmount;
      }
    }

    // Sort categories descending by amount
    incomeCategories.sort((a, b) => b.amountPaise - a.amountPaise);
    expenseCategories.sort((a, b) => b.amountPaise - a.amountPaise);

    const netBalancePaise = totalIncomePaise - totalExpensePaise;
    const closingBalancePaise = openingBalancePaise + netBalancePaise;

    return res.status(200).json({
      month,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      openingBalancePaise,
      income: {
        categories: incomeCategories,
        totalIncomePaise,
      },
      expense: {
        categories: expenseCategories,
        totalExpensePaise,
      },
      netBalancePaise,
      closingBalancePaise,
    });
  } catch (err) {
    next(err);
  }
}

// Update GP Opening Balance (PATCH /api/gp/opening-balance) - GP Admin only
async function updateOpeningBalance(req, res, next) {
  try {
    const { openingBalancePaise } = req.body;
    if (
      typeof openingBalancePaise !== 'number' ||
      !Number.isInteger(openingBalancePaise) ||
      openingBalancePaise < 0
    ) {
      return res.status(400).json({
        error: 'openingBalancePaise must be an integer greater than or equal to 0',
      });
    }

    const updatedGp = await prisma.gramPanchayat.update({
      where: { id: req.user.gpId },
      data: { openingBalancePaise },
      select: {
        id: true,
        name: true,
        openingBalancePaise: true,
      },
    });

    return res.status(200).json({
      message: 'Opening balance updated successfully',
      openingBalancePaise: updatedGp.openingBalancePaise,
      gp: updatedGp,
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
  getCashBook,
  getMonthlySummary,
  updateOpeningBalance,
};
