const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Middleware or header check allowing access to GP approval endpoints:
 * 1. Logged-in approved Admin whose phone matches process.env.MAIN_ADMIN_PHONE (default: '9992934154')
 * 2. OR an optional ADMIN_APPROVAL_KEY header matching process.env.ADMIN_APPROVAL_KEY (or fallback secret)
 */
const requireMainAdminOrKey = async (req, res, next) => {
  const approvalKey = req.headers['x-admin-approval-key'];
  const expectedKey = process.env.ADMIN_APPROVAL_KEY || 'JALSETU_SUPERADMIN_SECRET';

  if (approvalKey && approvalKey === expectedKey) {
    return next();
  }

  // Otherwise fallback to standard JWT authentication requiring approved Main Admin
  return authenticate(req, res, () => {
    const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();
    const isMainAdmin = Boolean(
      req.user &&
      (req.user.isMainAdmin || req.user.phone === mainAdminPhone)
    );

    if (isMainAdmin) {
      return next();
    }
    return res.status(403).json({
      error: 'Access denied. Only the main administrator can view or approve Gram Panchayat registrations.',
    });
  });
};

/**
 * GET /api/gps/overview
 * List all Gram Panchayats with summary operational activity and statistics.
 * Restricted strictly to Main Admin.
 */
router.get('/overview', requireMainAdminOrKey, async (req, res, next) => {
  try {
    const allGps = await prisma.gramPanchayat.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
          },
        },
        assets: {
          select: {
            id: true,
            status: true,
          },
        },
        consumers: {
          select: {
            id: true,
            isActive: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            reorderLevel: true,
          },
        },
        bills: {
          select: {
            id: true,
            status: true,
            amountPaise: true,
          },
        },
      },
    });

    const formatted = allGps.map((gp) => {
      const primaryAdmin = gp.users.find((u) => u.role === 'ADMIN');
      const workers = gp.users.filter((u) => u.role === 'WORKER');

      const totalAssets = gp.assets.length;
      const faultyAssets = gp.assets.filter((a) => a.status === 'FAULTY').length;
      const underRepairAssets = gp.assets.filter((a) => a.status === 'UNDER_REPAIR').length;
      const workingAssets = totalAssets - faultyAssets - underRepairAssets;

      const totalItems = gp.items.length;
      const lowStockItems = gp.items.filter((i) => i.quantity <= i.reorderLevel).length;

      const totalConsumers = gp.consumers.length;
      const activeConsumers = gp.consumers.filter((c) => c.isActive).length;

      const paidBills = gp.bills.filter((b) => b.status === 'PAID');
      const totalCollectedPaise = paidBills.reduce((acc, b) => acc + (b.amountPaise || 0), 0);
      const pendingBillsCount = gp.bills.filter((b) => b.status === 'PENDING' || b.status === 'DUE').length;

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
          workersCount: workers.length,
          totalAssets,
          workingAssets,
          faultyAssets,
          underRepairAssets,
          totalConsumers,
          activeConsumers,
          totalInventoryItems: totalItems,
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
});

/**
 * GET /api/gps/pending
 * List all Gram Panchayats where isApproved === false along with primary admin's name and phone.
 */
router.get('/pending', requireMainAdminOrKey, async (req, res, next) => {
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
});

/**
 * GET /api/gps/:id
 * Deep-dive detailed inspection data for a single Gram Panchayat.
 * Accessible to Main Admin.
 */
router.get('/:id', requireMainAdminOrKey, async (req, res, next) => {
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
      openingBalance: gp.openingBalance,
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
});

/**
 * PATCH /api/gps/:id/approve
 * Sets isApproved: true on the target Gram Panchayat.
 */
router.patch('/:id/approve', requireMainAdminOrKey, async (req, res, next) => {
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
});

/**
 * PATCH /api/gps/:id/reject (or POST /api/gps/:id/reject)
 * Declines the target Gram Panchayat registration.
 * Requires a decline reason/note.
 * Cleans up the unapproved GP and its pending users so the applicant phone number can immediately reapply.
 */
const handleRejectGp = async (req, res, next) => {
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

    // Clean up dependent records so admin/worker phone numbers can re-register cleanly
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
};

router.patch('/:id/reject', requireMainAdminOrKey, handleRejectGp);
router.delete('/:id/reject', requireMainAdminOrKey, handleRejectGp);
router.delete('/:id', requireMainAdminOrKey, handleRejectGp);

module.exports = router;
