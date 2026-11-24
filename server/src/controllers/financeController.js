const prisma = require('../prisma');
const {
  createReceiptSchema,
  createExpenseSchema,
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

module.exports = {
  addReceipt,
  addExpense,
};
