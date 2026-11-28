const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { resetDemoData } = require('../controllers/adminController');

const router = express.Router();

/**
 * Middleware requiring authenticated Main Admin (Super Admin)
 */
const requireMainAdmin = (req, res, next) => {
  const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();
  const isMainAdmin = Boolean(
    req.user &&
    (req.user.isMainAdmin || req.user.phone === mainAdminPhone)
  );

  if (!isMainAdmin) {
    return res.status(403).json({
      error: 'Access denied. Only the platform main administrator can perform administrative demo resets.',
    });
  }
  next();
};

// All admin routes require authentication and Main Admin role
router.use(authenticate);
router.use(requireMainAdmin);

// POST /api/admin/demo/reset - Reset demo Gram Panchayat dataset
router.post('/demo/reset', resetDemoData);

module.exports = router;
