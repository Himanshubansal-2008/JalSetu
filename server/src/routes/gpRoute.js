const express = require('express');
const { authenticate, isSuperAdmin } = require('../middleware/authMiddleware');
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
 * 1. Logged-in Super Admin whose schema role is strictly "SUPER_ADMIN"
 * 2. OR an optional SUPERADMIN_SECRET / ADMIN_APPROVAL_KEY header ONLY if explicitly non-empty in environment variables
 */
const requireSuperAdminOrKey = async (req, res, next) => {
  const secretKey = (process.env.SUPERADMIN_SECRET || process.env.ADMIN_APPROVAL_KEY || '').trim();
  const providedKey = req.headers['x-admin-approval-key'] || req.headers['x-superadmin-secret'];

  // Only allow header key bypass if an explicit secret is set in environment (never fallback to hardcoded default)
  if (secretKey && providedKey && providedKey === secretKey) {
    return next();
  }

  // Otherwise authenticate strictly via valid JWT belonging to Super Admin
  return authenticate(req, res, () => {
    if (isSuperAdmin(req.user)) {
      return next();
    }
    return res.status(403).json({
      error: 'Access denied. Only the platform Super Administrator can view or approve Gram Panchayat registrations.',
    });
  });
};

// Require Super Admin or Key on all routes in this router
router.use(requireSuperAdminOrKey);

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
