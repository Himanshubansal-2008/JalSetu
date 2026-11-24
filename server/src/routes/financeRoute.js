const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { addReceipt, addExpense } = require('../controllers/financeController');

const router = express.Router();

// Add Receipt: Admin only
router.post('/receipts', authenticate, requireRole('ADMIN'), addReceipt);

// Add Expense: Admin only
router.post('/expenses', authenticate, requireRole('ADMIN'), addExpense);

module.exports = router;
