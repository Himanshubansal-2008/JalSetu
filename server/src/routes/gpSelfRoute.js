const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const { updateOpeningBalance } = require('../controllers/financeController');

const router = express.Router();

// PATCH /api/gp/opening-balance (GP ADMIN only, scoped to req.user.gpId)
router.patch('/opening-balance', authenticate, requireAdmin, updateOpeningBalance);

module.exports = router;
