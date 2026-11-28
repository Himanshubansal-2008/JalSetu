const prisma = require('../prisma');

/**
 * List all Gram Panchayats with summary operational activity and statistics.
 * GET /api/gps/overview (Main Admin only)
 * Optimized to use Prisma _count, groupBy, and aggregate summaries instead of loading full nested arrays into memory.
 */
async function getOverview(req, res, next) {
  try {
    const [
      allGps,
      assetStatusGroups,
      consumerActiveGroups,
      paidBillsAggregates,
      pendingBillsCounts,
      inventoryItems,
    ] = await Promise.all([
      prisma.gramPanchayat.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          village: true,
          block: true,
          district: true,
          state: true,
          isApproved: true,
          createdAt: true,
          users: {
            where: { role: 'ADMIN' },
            take: 1,
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          _count: {
            select: {
              users: { where: { role: 'WORKER' } },
              assets: true,
              consumers: true,
              items: true,
            },
          },
        },
      }),
      prisma.asset.groupBy({
        by: ['gpId', 'status'],
        _count: { id: true },
      }),
      prisma.consumer.groupBy({
        by: ['gpId'],
        where: { isActive: true },
        _count: { id: true },
      }),
      prisma.bill.groupBy({
        by: ['gpId'],
        where: { status: 'PAID' },
        _sum: { amountPaise: true },
      }),
      prisma.bill.groupBy({
        by: ['gpId'],
        where: { status: { in: ['PENDING', 'DUE'] } },
        _count: { id: true },
      }),
      prisma.inventoryItem.findMany({
        select: {
          gpId: true,
          quantity: true,
          reorderLevel: true,
        },
      }),
    ]);

    const faultyMap = new Map();
    const underRepairMap = new Map();
    for (const group of assetStatusGroups) {
      if (group.status === 'FAULTY') {
        faultyMap.set(group.gpId, group._count.id);
      } else if (group.status === 'UNDER_REPAIR') {
        underRepairMap.set(group.gpId, group._count.id);
      }
    }

    const activeConsumersMap = new Map();
    for (const group of consumerActiveGroups) {
      activeConsumersMap.set(group.gpId, group._count.id);
    }

    const paidBillsSumMap = new Map();
    for (const group of paidBillsAggregates) {
      paidBillsSumMap.set(group.gpId, group._sum?.amountPaise || 0);
    }

    const pendingBillsCountMap = new Map();
    for (const group of pendingBillsCounts) {
      pendingBillsCountMap.set(group.gpId, group._count.id);
    }

    const lowStockMap = new Map();
    for (const item of inventoryItems) {
      if (item.quantity <= item.reorderLevel) {
        lowStockMap.set(item.gpId, (lowStockMap.get(item.gpId) || 0) + 1);
      }
    }

    const formatted = allGps.map((gp) => {
      const primaryAdmin = gp.users && gp.users.length > 0 ? gp.users[0] : null;
      const workersCount = gp._count?.users || 0;
      const totalAssets = gp._count?.assets || 0;
      const faultyAssets = faultyMap.get(gp.id) || 0;
      const underRepairAssets = underRepairMap.get(gp.id) || 0;
      const workingAssets = Math.max(0, totalAssets - faultyAssets - underRepairAssets);
      const totalConsumers = gp._count?.consumers || 0;
      const activeConsumers = activeConsumersMap.get(gp.id) || 0;
      const totalInventoryItems = gp._count?.items || 0;
      const lowStockItems = lowStockMap.get(gp.id) || 0;
      const totalCollectedPaise = paidBillsSumMap.get(gp.id) || 0;
      const pendingBillsCount = pendingBillsCountMap.get(gp.id) || 0;

      return {
        id: gp.id,
        name: gp.name,
        village: gp.village,
        block: gp.block,
        district: gp.district,
        state: gp.state,
        isApproved: gp.isApproved,
        createdAt: gp.createdAt,
        admin: primaryAdmin
          ? {
              id: primaryAdmin.id,
              name: primaryAdmin.name,
              phone: primaryAdmin.phone,
            }
          : null,
        stats: {
          workersCount,
          totalAssets,
          workingAssets,
          faultyAssets,
          underRepairAssets,
          totalConsumers,
          activeConsumers,
          totalInventoryItems,
          lowStockItems,
          totalCollectedPaise,
          pendingBillsCount,
        },
      };
    });

    const platformSummary = {
      totalGps: allGps.length,
      approvedGps: allGps.filter((g) => g.isApproved).length,
      pendingGps: allGps.filter((g) => !g.isApproved).length,
      totalAssets: formatted.reduce((sum, g) => sum + g.stats.totalAssets, 0),
      faultyAssets: formatted.reduce((sum, g) => sum + g.stats.faultyAssets, 0),
      underRepairAssets: formatted.reduce((sum, g) => sum + g.stats.underRepairAssets, 0),
      totalWorkers: formatted.reduce((sum, g) => sum + g.stats.workersCount, 0),
      totalConsumers: formatted.reduce((sum, g) => sum + g.stats.totalConsumers, 0),
      totalCollectedPaise: formatted.reduce((sum, g) => sum + g.stats.totalCollectedPaise, 0),
      totalLowStockItems: formatted.reduce((sum, g) => sum + g.stats.lowStockItems, 0),
    };

    return res.status(200).json({ gps: formatted, summary: platformSummary });
  } catch (err) {
    next(err);
  }
}

/**
 * List all Gram Panchayats where isApproved === false.
 * GET /api/gps/pending (Main Admin only)
 */
async function getPendingGps(req, res, next) {
  try {
    const pendingGps = await prisma.gramPanchayat.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: 'ADMIN' },
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
          },
          take: 1,
        },
      },
    });

    const formatted = pendingGps.map((gp) => {
      const primaryAdmin = gp.users && gp.users.length > 0 ? gp.users[0] : null;
      return {
        id: gp.id,
        name: gp.name,
        village: gp.village,
        block: gp.block,
        district: gp.district,
        state: gp.state,
        isApproved: gp.isApproved,
        createdAt: gp.createdAt,
        admin: primaryAdmin
          ? {
              id: primaryAdmin.id,
              name: primaryAdmin.name,
              phone: primaryAdmin.phone,
            }
          : null,
      };
    });

    return res.status(200).json({ pendingGps: formatted });
  } catch (err) {
    next(err);
  }
}

/**
 * Deep-dive detailed inspection data for a single Gram Panchayat.
 * GET /api/gps/:id (Main Admin only)
 */
async function getGpById(req, res, next) {
  try {
    const { id } = req.params;

    const gp = await prisma.gramPanchayat.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        assets: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            lat: true,
            lng: true,
            installDate: true,
            notes: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            reorderLevel: true,
            unit: true,
          },
        },
        consumers: {
          select: {
            id: true,
            name: true,
            houseNumber: true,
            phone: true,
            isActive: true,
          },
          take: 20,
        },
        bills: {
          select: {
            id: true,
            status: true,
            amountPaise: true,
            month: true,
          },
        },
      },
    });

    if (!gp) {
      return res.status(404).json({ error: 'Gram Panchayat not found' });
    }

    const primaryAdmin = gp.users.find((u) => u.role === 'ADMIN') || null;
    const workers = gp.users.filter((u) => u.role === 'WORKER');

    const totalAssets = gp.assets.length;
    const faultyAssets = gp.assets.filter((a) => a.status === 'FAULTY');
    const underRepairAssets = gp.assets.filter((a) => a.status === 'UNDER_REPAIR');
    const workingAssets = totalAssets - faultyAssets.length - underRepairAssets.length;

    const lowStockItems = gp.items.filter((i) => i.quantity <= i.reorderLevel);

    const paidBills = gp.bills.filter((b) => b.status === 'PAID');
    const totalCollectedPaise = paidBills.reduce((acc, b) => acc + (b.amountPaise || 0), 0);
    const pendingBillsCount = gp.bills.filter((b) => b.status === 'PENDING' || b.status === 'DUE').length;

    const detailedGp = {
      id: gp.id,
      name: gp.name,
      village: gp.village,
      block: gp.block,
      district: gp.district,
      state: gp.state,
      upiId: gp.upiId,
      openingBalance: gp.openingBalancePaise,
      openingBalancePaise: gp.openingBalancePaise,
      isApproved: gp.isApproved,
      createdAt: gp.createdAt,
      admin: primaryAdmin,
      workers,
      stats: {
        workersCount: workers.length,
        totalAssets,
        workingAssets,
        faultyAssets: faultyAssets.length,
        underRepairAssets: underRepairAssets.length,
        totalConsumers: gp.consumers.length,
        activeConsumers: gp.consumers.filter((c) => c.isActive).length,
        totalInventoryItems: gp.items.length,
        lowStockItems: lowStockItems.length,
        totalCollectedPaise,
        pendingBillsCount,
      },
      assets: gp.assets,
      faultyAssetsList: [...faultyAssets, ...underRepairAssets],
      lowStockItemsList: lowStockItems,
      consumersSample: gp.consumers,
    };

    return res.status(200).json({ gp: detailedGp });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve a pending Gram Panchayat registration.
 * PATCH /api/gps/:id/approve (Main Admin only)
 */
async function approveGp(req, res, next) {
  try {
    const { id } = req.params;

    const existingGp = await prisma.gramPanchayat.findUnique({
      where: { id },
    });

    if (!existingGp) {
      return res.status(404).json({ error: 'Gram Panchayat not found' });
    }

    const updatedGp = await prisma.gramPanchayat.update({
      where: { id },
      data: { isApproved: true },
    });

    return res.status(200).json({
      message: `Gram Panchayat "${updatedGp.name}" approved successfully. Users may now log in.`,
      gp: {
        id: updatedGp.id,
        name: updatedGp.name,
        village: updatedGp.village,
        district: updatedGp.district,
        isApproved: updatedGp.isApproved,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Decline/Reject an unapproved Gram Panchayat registration.
 * DELETE & PATCH /api/gps/:id/reject & DELETE /api/gps/:id (Main Admin only)
 */
async function rejectGp(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const cleanNote = typeof note === 'string' && note.trim().length >= 3 ? note.trim() : 'Registration declined by administrator';

    const existingGp = await prisma.gramPanchayat.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!existingGp) {
      return res.status(404).json({ error: 'Gram Panchayat not found' });
    }

    if (existingGp.isApproved) {
      return res.status(400).json({ error: 'Cannot decline an already approved Gram Panchayat.' });
    }

    // Clean up dependent records so applicant phone numbers can re-register cleanly
    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { gpId: id } });
      await tx.gramPanchayat.delete({ where: { id } });
    });

    return res.status(200).json({
      message: `Gram Panchayat "${existingGp.name}" declined successfully. Note recorded: "${cleanNote}". The applicant may now reapply.`,
      declinedGp: {
        id: existingGp.id,
        name: existingGp.name,
        village: existingGp.village,
        district: existingGp.district,
        note: cleanNote,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getPendingGps,
  getGpById,
  approveGp,
  rejectGp,
};
