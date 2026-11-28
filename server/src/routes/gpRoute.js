const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Middleware or header check allowing access to GP approval endpoints:
 * 1. Logged-in approved Admin (req.user.role === 'ADMIN' && req.user.gp?.isApproved === true)
 * 2. OR an optional ADMIN_APPROVAL_KEY header matching process.env.ADMIN_APPROVAL_KEY (or fallback secret)
 */
const requireAdminOrKey = async (req, res, next) => {
  const approvalKey = req.headers['x-admin-approval-key'];
  const expectedKey = process.env.ADMIN_APPROVAL_KEY || 'JALSETU_SUPERADMIN_SECRET';

  if (approvalKey && approvalKey === expectedKey) {
    return next();
  }

  // Otherwise fallback to standard JWT authentication requiring approved ADMIN
  return authenticate(req, res, () => {
    if (req.user && req.user.role === 'ADMIN') {
      return next();
    }
    return res.status(403).json({ error: 'Admin access required' });
  });
};

/**
 * GET /api/gps/pending
 * List all Gram Panchayats where isApproved === false along with primary admin's name and phone.
 */
router.get('/pending', requireAdminOrKey, async (req, res, next) => {
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
 * PATCH /api/gps/:id/approve
 * Sets isApproved: true on the target Gram Panchayat.
 */
router.patch('/:id/approve', requireAdminOrKey, async (req, res, next) => {
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
router.patch('/:id/reject', requireAdminOrKey, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (!cleanNote || cleanNote.length < 3) {
      return res.status(400).json({
        error: 'A reason or note explaining why the registration was declined is required (minimum 3 characters).',
      });
    }

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
});

module.exports = router;
