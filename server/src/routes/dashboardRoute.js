const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { getDashboard } = require('../controllers/dashboardController');

const router = express.Router();

// Require authenticated user for all dashboard routes
router.use(authenticate);

// GET /api/dashboard
router.get('/', getDashboard);

module.exports = router;
