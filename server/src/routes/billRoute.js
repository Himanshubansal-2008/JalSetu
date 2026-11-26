const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  listBills,
  getDuesSummary,
  getBill,
  generateBills,
  payBill,
} = require('../controllers/billController');

const router = express.Router();

// Helper middleware: Reject non-admin users with 403 Forbidden
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  const role = req.user.role?.toLowerCase();
  if (role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// All bill routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

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

module.exports = router;
