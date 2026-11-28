const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const {
  addReceipt,
  addExpense,
  listLedgerEntries,
  updateLedgerEntry,
  deleteLedgerEntry,
  getCashBook,
  getMonthlySummary,
  updateOpeningBalance,
} = require('../controllers/financeController');

const router = express.Router();

// All finance routes require authentication and GP ADMIN role
router.use(authenticate);
router.use(requireAdmin);

// Opening balance update: Admin only
router.patch('/opening-balance', updateOpeningBalance);

// Cash Book: Admin only
router.get('/cashbook', getCashBook);

// Monthly Summary: Admin only
router.get('/summary', getMonthlySummary);

// Add Receipt: Admin only
router.post('/receipts', addReceipt);

// Add Expense: Admin only
router.post('/expenses', addExpense);

// List Entries: Admin only
router.get('/entries', listLedgerEntries);

// Edit Entry: Admin only (supports both PUT and PATCH)
router.put('/entries/:id', updateLedgerEntry);
router.patch('/entries/:id', updateLedgerEntry);

// Delete Entry: Admin only
router.delete('/entries/:id', deleteLedgerEntry);

module.exports = router;
