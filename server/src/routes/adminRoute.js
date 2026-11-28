const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/authMiddleware');
const { resetDemoData } = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(requireSuperAdmin);

// POST /api/admin/demo/reset - Reset demo Gram Panchayat dataset
router.post('/demo/reset', resetDemoData);

module.exports = router;
