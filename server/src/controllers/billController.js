const prisma = require('../prisma');
const {
  idParamSchema,
  generateBillsSchema,
  payBillSchema,
  listBillsQuerySchema,
  duesSummaryQuerySchema,
  normalizeDateToUtcMidnight,
} = require('../utils/billUtil');

/**
 * List Bills (GET /api/bills) - Admin only
 * Strictly scoped to req.user.gpId
 * Supports optional filters: month, status (PENDING / PAID / ALL), search (name or houseNumber)
 * Includes consumer and GP metadata for mobile PDF generation
 * Sorted newest month first, then by consumer house number
 */
async function listBills(req, res, next) {
  try {
    const parsed = listBillsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { month, status, search } = parsed.data;
    const gpId = req.user.gpId;

    const where = {
      gpId,
    };

    if (month) {
      where.month = month;
    }

    if (status && status.trim() !== '') {
      const s = status.trim().toUpperCase();
      if (s === 'PENDING' || s === 'PAID') {
        where.status = s;
      }
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { consumer: { name: { contains: term, mode: 'insensitive' } } },
        { consumer: { houseNumber: { contains: term, mode: 'insensitive' } } },
        { reference: { contains: term, mode: 'insensitive' } },
      ];
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        consumer: {
          select: {
            id: true,
            name: true,
            houseNumber: true,
            phone: true,
          },
        },
        gp: {
          select: {
            id: true,
            name: true,
            village: true,
            district: true,
            state: true,
            upiId: true,
          },
        },
      },
      orderBy: [
        { month: 'desc' },
        { consumer: { houseNumber: 'asc' } },
        { createdAt: 'desc' },
      ],
    });

    return res.status(200).json({
      bills,
      total: bills.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Dues Summary (GET /api/bills/summary) - Admin only
 * Strictly scoped to req.user.gpId
 * Computes integer paise totals via Prisma aggregate / groupBy:
 * totalBilledPaise & totalBillsCount
 * totalCollectedPaise & paidBillsCount
 * totalPendingPaise & pendingBillsCount
 */
async function getDuesSummary(req, res, next) {
  try {
    const parsed = duesSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { month } = parsed.data;
    const gpId = req.user.gpId;

    const periodWhere = { gpId };
    if (month) {
      periodWhere.month = month;
    }

    // 1. Group by status for the specified period (month or overall)
    const grouped = await prisma.bill.groupBy({
      by: ['status'],
      where: periodWhere,
      _sum: {
        amountPaise: true,
      },
      _count: {
        id: true,
      },
    });

    let totalBilledPaise = 0;
    let totalBillsCount = 0;
    let totalCollectedPaise = 0;
    let paidBillsCount = 0;
    let totalPendingPaise = 0;
    let pendingBillsCount = 0;

    for (const group of grouped) {
      const sum = group._sum.amountPaise || 0;
      const count = group._count.id || 0;
      totalBilledPaise += sum;
      totalBillsCount += count;
      if (group.status === 'PAID') {
        totalCollectedPaise += sum;
        paidBillsCount += count;
      } else if (group.status === 'PENDING') {
        totalPendingPaise += sum;
        pendingBillsCount += count;
      }
    }

    // 2. Compute overall pending totals across all bills for this GP
    const overallPendingAgg = await prisma.bill.aggregate({
      where: {
        gpId,
        status: 'PENDING',
      },
      _sum: {
        amountPaise: true,
      },
      _count: {
        id: true,
      },
    });

    const overallPendingPaise = overallPendingAgg._sum.amountPaise || 0;
    const overallPendingBillsCount = overallPendingAgg._count.id || 0;

    return res.status(200).json({
      month: month || null,
      totalBilledPaise,
      totalBillsCount,
      totalCollectedPaise,
      paidBillsCount,
      totalPendingPaise,
      pendingBillsCount,
      overallPendingPaise,
      overallPendingBillsCount,
      pendingDuesPaise: overallPendingPaise,
      unpaidBillsCount: overallPendingBillsCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Single Bill Detail (GET /api/bills/:id) - Admin only
 */
async function getBill(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
      include: {
        consumer: {
          select: {
            id: true,
            name: true,
            houseNumber: true,
            phone: true,
          },
        },
        gp: {
          select: {
            id: true,
            name: true,
            village: true,
            district: true,
            state: true,
            upiId: true,
          },
        },
        ledger: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    return res.status(200).json({ bill });
  } catch (err) {
    next(err);
  }
}

/**
 * Generate Monthly Bills (POST /api/bills/generate) - Admin only
 * Strictly scoped to req.user.gpId
 * Accepts { month } in "YYYY-MM" format
 * Creates PENDING bill for each active consumer with snapshot of monthlyChargePaise
 * Idempotent: skips existing bills without throwing 500
 */
async function generateBills(req, res, next) {
  try {
    const parsed = generateBillsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { month } = parsed.data;
    const gpId = req.user.gpId;

    // 1. Fetch all active consumers in the authenticated user's GP
    const activeConsumers = await prisma.consumer.findMany({
      where: {
        gpId,
        isActive: true,
      },
      select: {
        id: true,
        monthlyChargePaise: true,
      },
    });

    // 2. Fetch existing bills for this GP and month to optimize and avoid duplicate queries
    const existingBills = await prisma.bill.findMany({
      where: {
        gpId,
        month,
      },
      select: {
        consumerId: true,
      },
    });
    const existingConsumerIds = new Set(existingBills.map((b) => b.consumerId));

    let createdCount = 0;
    let skippedCount = 0;

    // 3. Generate snapshot bill per active consumer
    for (const consumer of activeConsumers) {
      if (existingConsumerIds.has(consumer.id)) {
        skippedCount++;
        continue;
      }

      try {
        await prisma.bill.create({
          data: {
            gpId,
            consumerId: consumer.id,
            month,
            amountPaise: consumer.monthlyChargePaise,
            status: 'PENDING',
          },
        });
        createdCount++;
      } catch (err) {
        // Unique constraint error on @@unique([consumerId, month]) is P2002
        if (err.code === 'P2002') {
          skippedCount++;
        } else {
          throw err;
        }
      }
    }

    return res.status(200).json({
      month,
      createdCount,
      skippedCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Atomic Bill Payment (POST /api/bills/:id/pay) - Admin only
 * Uses a single prisma.$transaction so bill payment status and Cash Book LedgerEntry stay in sync.
 */
async function payBill(req, res, next) {
  try {
    // 1. Validate route param :id
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    // 2. Validate body { mode, reference, paidAt }
    const bodyParsed = payBillSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res
        .status(400)
        .json({ error: bodyParsed.error.issues[0].message });
    }

    const { mode, reference, paidAt } = bodyParsed.data;
    const paymentDate = paidAt
      ? normalizeDateToUtcMidnight(paidAt)
      : normalizeDateToUtcMidnight(new Date());
    const cleanRef = reference && reference.trim() ? reference.trim() : null;

    // 3. Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch the bill by id and gpId
      const bill = await tx.bill.findFirst({
        where: {
          id: req.params.id,
          gpId: req.user.gpId,
        },
        include: {
          consumer: {
            select: {
              id: true,
              name: true,
              houseNumber: true,
            },
          },
        },
      });

      if (!bill) {
        const err = new Error('Bill not found');
        err.statusCode = 404;
        throw err;
      }

      // Reject Already-Paid Bills
      if (bill.status === 'PAID' || bill.paidAt) {
        const err = new Error('Bill is already paid');
        err.statusCode = 400;
        throw err;
      }

      // Mark the bill as paid
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: 'PAID',
          paidAt: paymentDate,
          mode,
          reference: cleanRef,
        },
      });

      // Prepare metadata for LedgerEntry
      const consumerName = bill.consumer?.name || 'Unknown';
      const consumerHouse = bill.consumer?.houseNumber
        ? ` (${bill.consumer.houseNumber})`
        : '';
      const ledgerDescription = `Water tax bill (${bill.month}) - ${consumerName}${consumerHouse}`;
      const ledgerReference = cleanRef || `BILL-${bill.id}`;

      // Create linked LedgerEntry receipt in "Water tax" category
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          gpId: bill.gpId,
          type: 'RECEIPT',
          category: 'Water tax',
          amount: bill.amountPaise,
          date: paymentDate,
          mode,
          reference: ledgerReference,
          description: ledgerDescription,
          isSystem: true,
          billId: bill.id,
          createdById: req.user.id,
        },
      });

      return {
        bill: updatedBill,
        ledgerEntry: {
          ...ledgerEntry,
          amountPaise: ledgerEntry.amount,
        },
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Bill is already paid' });
    }
    next(err);
  }
}

module.exports = {
  listBills,
  getDuesSummary,
  getBill,
  generateBills,
  payBill,
};
