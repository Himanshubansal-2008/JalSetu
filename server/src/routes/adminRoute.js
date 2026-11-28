const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { resetDemoData } = require('../controllers/adminController');

const router = express.Router();

/**
 * Middleware requiring authenticated Super Admin based strictly on schema role.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Access denied. Only the platform Super Administrator can perform administrative demo resets.',
    });
  }
  next();
};

// All admin routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(requireSuperAdmin);

// POST /api/admin/demo/reset - Reset demo Gram Panchayat dataset
router.post('/demo/reset', resetDemoData);

module.exports = router;
