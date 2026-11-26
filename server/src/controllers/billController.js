const prisma = require('../prisma');
const {
  idParamSchema,
  generateBillsSchema,
  payBillSchema,
  normalizeDateToUtcMidnight,
} = require('../utils/billUtil');

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
  generateBills,
  payBill,
};
