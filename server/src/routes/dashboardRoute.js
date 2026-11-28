const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { getDashboard } = require('../controllers/dashboardController');

const router = express.Router();

// Require authenticated user with GP ADMIN or WORKER role for all GP operational dashboard routes
router.use(authenticate);
router.use(requireRole('ADMIN', 'WORKER'));

// GET /api/dashboard
router.get('/', getDashboard);

module.exports = router;
