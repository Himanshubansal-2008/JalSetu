const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  listBills,
  getDuesSummary,
  getBill,
  generateBills,
  payBill,
  unpayBill,
} = require('../controllers/billController');

const router = express.Router();

// All bill routes require authentication and GP ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// Dues Summary: GET /api/bills/summary (must be before /:id)
router.get('/summary', getDuesSummary);

// List Bills: GET /api/bills
router.get('/', listBills);

// Generate Monthly Bills: POST /api/bills/generate
router.post('/generate', generateBills);

// Single Bill Detail: GET /api/bills/:id
router.get('/:id', getBill);

// Atomic Bill Payment: POST /api/bills/:id/pay
router.post('/:id/pay', payBill);

// Reverse Bill Payment: POST /api/bills/:id/unpay (or /reverse)
router.post('/:id/unpay', unpayBill);
router.post('/:id/reverse', unpayBill);

module.exports = router;
