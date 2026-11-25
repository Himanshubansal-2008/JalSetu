const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  addReceipt,
  addExpense,
  listLedgerEntries,
  updateLedgerEntry,
  deleteLedgerEntry,
  getCashBook,
  getMonthlySummary,
} = require('../controllers/financeController');

const router = express.Router();

// Cash Book: Admin only
router.get('/cashbook', authenticate, requireRole('ADMIN'), getCashBook);

// Monthly Summary: Admin only
router.get('/summary', authenticate, requireRole('ADMIN'), getMonthlySummary);

// Add Receipt: Admin only
router.post('/receipts', authenticate, requireRole('ADMIN'), addReceipt);

// Add Expense: Admin only
router.post('/expenses', authenticate, requireRole('ADMIN'), addExpense);

// List Entries: Admin only
router.get('/entries', authenticate, requireRole('ADMIN'), listLedgerEntries);

// Edit Entry: Admin only (supports both PUT and PATCH)
router.put('/entries/:id', authenticate, requireRole('ADMIN'), updateLedgerEntry);
router.patch('/entries/:id', authenticate, requireRole('ADMIN'), updateLedgerEntry);

// Delete Entry: Admin only
router.delete('/entries/:id', authenticate, requireRole('ADMIN'), deleteLedgerEntry);

module.exports = router;
