const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  getOverview,
  getPendingGps,
  getGpById,
  approveGp,
  rejectGp,
} = require('../controllers/gpController');

const router = express.Router();

/**
 * Middleware allowing access to GP approval and inspection endpoints:
 * 1. Logged-in Main Admin whose token belongs to the designated Super Admin
 * 2. OR an optional SUPERADMIN_SECRET / ADMIN_APPROVAL_KEY header ONLY if explicitly non-empty in environment variables
 */
const requireMainAdminOrKey = async (req, res, next) => {
  const secretKey = (process.env.SUPERADMIN_SECRET || process.env.ADMIN_APPROVAL_KEY || '').trim();
  const providedKey = req.headers['x-admin-approval-key'] || req.headers['x-superadmin-secret'];

  // Only allow header key bypass if an explicit secret is set in environment (never fallback to hardcoded default)
  if (secretKey && providedKey && providedKey === secretKey) {
    return next();
  }

  // Otherwise authenticate strictly via valid JWT belonging to Main Admin
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

// Require Main Admin or Key on all routes in this router
router.use(requireMainAdminOrKey);

// GET /api/gps/overview - Platform-wide summary of all Gram Panchayats
router.get('/overview', getOverview);

// GET /api/gps/pending - List unapproved Gram Panchayats awaiting review
router.get('/pending', getPendingGps);

// GET /api/gps/:id - Deep-dive operational health inspection of a single GP
router.get('/:id', getGpById);

// PATCH /api/gps/:id/approve - Approve GP registration
router.patch('/:id/approve', approveGp);

// DELETE & PATCH /api/gps/:id/reject - Decline GP registration
router.patch('/:id/reject', rejectGp);
router.delete('/:id/reject', rejectGp);
router.delete('/:id', rejectGp);

module.exports = router;
