const prisma = require('../prisma');
const { generateBillsSchema } = require('../utils/billUtil');

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

module.exports = {
  generateBills,
};
