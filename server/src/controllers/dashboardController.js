/**
 * dashboardController.js
 * Aggregated Dashboard metrics controller for JalSetu.
 *
 * Scoped strictly to the authenticated user's Gram Panchayat (gpId = req.user.gpId).
 * Returns operational counts (assets, low stock inventory) for both admin and worker roles.
 * Strictly redacts all financial and billing monetary fields when called by worker tokens.
 */

const prisma = require('../prisma');
const { resolveMonthRange } = require('../utils/financeUtil');

/**
 * GET /api/dashboard
 * Optional query: ?month=YYYY-MM (defaults to current calendar month)
 */
async function getDashboard(req, res, next) {
  try {
    const gpId = req.user?.gpId;
    if (!gpId) {
      return res.status(401).json({ error: 'Unauthorized: missing Gram Panchayat scoping' });
    }

    const role = (req.user?.role || '').toLowerCase();
    const isAdmin = role === 'admin';

    // Validate or resolve month boundaries
    let monthRange;
    if (req.query.month) {
      monthRange = resolveMonthRange(req.query.month);
      if (!monthRange) {
        return res.status(400).json({ error: 'Invalid month format (must be YYYY-MM)' });
      }
    } else {
      monthRange = resolveMonthRange();
    }

    const { month, startDate, endDate } = monthRange;

    // Operational query 1: Asset counts by status for this GP
    const assetGroupsPromise = prisma.asset.groupBy({
      by: ['status'],
      where: { gpId },
      _count: {
        id: true,
      },
    });

    // Operational query 2: Low-stock inventory items for this GP (quantity <= reorderLevel)
    const inventoryItemsPromise = prisma.inventoryItem.findMany({
      where: { gpId },
      select: {
        quantity: true,
        reorderLevel: true,
      },
    });

    // Gram Panchayat metadata query
    const gpPromise = prisma.gramPanchayat.findUnique({
      where: { id: gpId },
      select: {
        id: true,
        name: true,
        village: true,
        district: true,
        state: true,
      },
    });

    if (!isAdmin) {
      // Worker execution path: only operational queries, zero financial leakage
      const [assetGroups, inventoryItems, gpRecord] = await Promise.all([
        assetGroupsPromise,
        inventoryItemsPromise,
        gpPromise,
      ]);

      let totalAssets = 0;
      let faultyAssets = 0;
      let underRepairAssets = 0;

      for (const g of assetGroups) {
        const count = g._count.id || 0;
        totalAssets += count;
        if (g.status === 'FAULTY') {
          faultyAssets += count;
        } else if (g.status === 'UNDER_REPAIR') {
          underRepairAssets += count;
        }
      }

      const lowStockCount = inventoryItems.filter(
        (item) => item.quantity <= item.reorderLevel
      ).length;

      return res.status(200).json({
        role: 'worker',
        month,
        gp: gpRecord || null,
        assets: {
          total: totalAssets,
          faulty: faultyAssets,
          underRepair: underRepairAssets,
        },
        lowStockCount,
      });
    }

    // Admin execution path: execute operational + financial + pending dues queries in parallel
    const ledgerGroupsPromise = prisma.ledgerEntry.groupBy({
      by: ['type'],
      where: {
        gpId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const pendingDuesPromise = prisma.bill.aggregate({
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

    const [assetGroups, inventoryItems, ledgerGroups, pendingDuesAgg, gpRecord] = await Promise.all([
      assetGroupsPromise,
      inventoryItemsPromise,
      ledgerGroupsPromise,
      pendingDuesPromise,
      gpPromise,
    ]);

    // Process Asset counts
    let totalAssets = 0;
    let faultyAssets = 0;
    let underRepairAssets = 0;

    for (const g of assetGroups) {
      const count = g._count.id || 0;
      totalAssets += count;
      if (g.status === 'FAULTY') {
        faultyAssets += count;
      } else if (g.status === 'UNDER_REPAIR') {
        underRepairAssets += count;
      }
    }

    // Process Low-stock count
    const lowStockCount = inventoryItems.filter(
      (item) => item.quantity <= item.reorderLevel
    ).length;

    // Process Ledger financial totals for the selected month
    let incomePaise = 0;
    let expensePaise = 0;

    for (const g of ledgerGroups) {
      const sum = g._sum.amount || 0;
      if (g.type === 'RECEIPT') {
        incomePaise += sum;
      } else if (g.type === 'EXPENSE') {
        expensePaise += sum;
      }
    }

    const balancePaise = incomePaise - expensePaise;

    // Process Pending Dues across unpaid bills
    const amountPaise = pendingDuesAgg._sum.amountPaise || 0;
    const unpaidCount = pendingDuesAgg._count.id || 0;

    return res.status(200).json({
      role: 'admin',
      month,
      gp: gpRecord || null,
      assets: {
        total: totalAssets,
        faulty: faultyAssets,
        underRepair: underRepairAssets,
      },
      lowStockCount,
      finance: {
        incomePaise,
        expensePaise,
        balancePaise,
      },
      pendingDues: {
        amountPaise,
        unpaidCount,
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
}

module.exports = {
  getDashboard,
};
