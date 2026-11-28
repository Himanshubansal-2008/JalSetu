const prisma = require('../prisma');
const {
  idParamSchema,
  generateBillsSchema,
  payBillSchema,
  listBillsQuerySchema,
  duesSummaryQuerySchema,
  editBillSchema,
  cancelWaiveBillSchema,
  normalizeDateToUtcMidnight,
} = require('../utils/billUtil');
const { parsePagination } = require('../utils/paginationUtil');
const { getIstMonthBounds } = require('../utils/dateUtil');

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

    const { isPaginated, page, limit, skip } = parsePagination(req.query);

    const total = await prisma.bill.count({ where });
    const totalPages = isPaginated ? (Math.ceil(total / limit) || 1) : 1;

    const findOptions = {
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
    };

    if (isPaginated) {
      findOptions.skip = skip;
      findOptions.take = limit;
    }

    const bills = await prisma.bill.findMany(findOptions);

    return res.status(200).json({
      items: bills,
      bills,
      total,
      page: isPaginated ? page : 1,
      totalPages,
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

    const { month: rawMonth } = parsed.data;
    const gpId = req.user.gpId;

    const periodWhere = { gpId };
    let month = null;
    if (rawMonth) {
      const monthRange = getIstMonthBounds(rawMonth);
      if (!monthRange) {
        return res.status(400).json({ error: 'Invalid month format (must be YYYY-MM)' });
      }
      month = monthRange.month;
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

    const monthStr = parsed.data.month || null;
    const monthRange = getIstMonthBounds(monthStr);
    if (!monthRange) {
      return res.status(400).json({ error: 'Invalid month format (must be YYYY-MM)' });
    }
    const month = monthRange.month;
    const currentIstMonth = getIstMonthBounds().month;
    if (month > currentIstMonth) {
      return res.status(400).json({ error: 'Cannot generate bills for future months' });
    }

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

    if (activeConsumers.length === 0) {
      return res.status(200).json({
        month,
        createdCount: 0,
        skippedCount: 0,
        generatedCount: 0,
        totalEligible: 0,
        message: 'No active consumers found for bill generation',
      });
    }

    // 2. Prepare candidate bill rows for batch idempotent insertion
    const candidateRows = activeConsumers.map((consumer) => ({
      gpId,
      consumerId: consumer.id,
      month,
      amountPaise: consumer.monthlyChargePaise,
      status: 'PENDING',
    }));

    // 3. Batch insert using createMany with skipDuplicates: true
    const result = await prisma.bill.createMany({
      data: candidateRows,
      skipDuplicates: true,
    });

    const createdCount = result.count;
    const skippedCount = candidateRows.length - createdCount;

    return res.status(200).json({
      month,
      createdCount,
      skippedCount,
      generatedCount: createdCount,
      totalEligible: candidateRows.length,
      message: `Generated ${createdCount} bills for ${month} (${skippedCount} skipped as already generated)`,
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

      // Only PENDING bills can be paid
      if (bill.status !== 'PENDING') {
        const err = new Error(
          bill.status === 'PAID'
            ? 'Bill is already paid'
            : `Cannot pay a bill that has been ${bill.status.toLowerCase()}`
        );
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

/**
 * Reverse Bill Payment (POST /api/bills/:id/unpay or /reverse) - Admin only
 * Reverses a mistakenly paid bill inside a single prisma.$transaction:
 * 1. Verifies bill belongs to req.user.gpId and status === 'PAID'
 * 2. Sets bill status: 'PENDING', paidAt: null, mode: null, reference: null
 * 3. Voids linked LedgerEntry with voided: true, voidReason: 'Bill payment reversed', voidedAt: new Date(), voidedById: req.user.id
 */
async function unpayBill(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findFirst({
        where: {
          id,
          gpId: req.user.gpId,
        },
      });

      if (!bill) {
        const err = new Error('Bill not found');
        err.statusCode = 404;
        throw err;
      }

      if (bill.status !== 'PAID') {
        const err = new Error('Only paid bills can be reversed');
        err.statusCode = 400;
        throw err;
      }

      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: 'PENDING',
          paidAt: null,
          mode: null,
          reference: null,
        },
      });

      await tx.ledgerEntry.updateMany({
        where: {
          billId: bill.id,
          gpId: req.user.gpId,
        },
        data: {
          voided: true,
          voidedAt: new Date(),
          voidedById: req.user.id,
          voidReason: 'Bill payment reversed',
        },
      });

      return updatedBill;
    });

    return res.status(200).json({
      message: 'Bill payment reversed successfully',
      bill: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Edit Pending Bill (PATCH /api/bills/:id) - Admin only
 * Allows modifying amountPaise and notes on PENDING bills only.
 */
async function editBill(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const parsed = editBillSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
      include: {
        consumer: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bill.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot edit a bill with status ${bill.status}`,
      });
    }

    const updateData = {};
    if (parsed.data.amountPaise !== undefined) {
      updateData.amountPaise = parsed.data.amountPaise;
    }
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: updateData,
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
    });

    return res.status(200).json({
      message: 'Bill updated successfully',
      bill: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel Pending Bill (POST /api/bills/:id/cancel) - Admin only
 */
async function cancelBill(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const parsed = cancelWaiveBillSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bill.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot cancel a bill with status ${bill.status}`,
      });
    }

    const reason = parsed.data?.reason || parsed.data?.notes || 'Cancelled by admin';

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
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
      },
    });

    return res.status(200).json({
      message: 'Bill cancelled successfully',
      bill: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Waive Pending Bill (POST /api/bills/:id/waive) - Admin only
 */
async function waiveBill(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const parsed = cancelWaiveBillSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bill.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot waive a bill with status ${bill.status}`,
      });
    }

    const reason = parsed.data?.reason || parsed.data?.notes || 'Waived by admin';

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: 'WAIVED',
        cancelReason: reason,
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
      },
    });

    return res.status(200).json({
      message: 'Bill waived successfully',
      bill: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBills,
  getDuesSummary,
  getBill,
  generateBills,
  payBill,
  unpayBill,
  editBill,
  cancelBill,
  waiveBill,
};
