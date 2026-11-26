const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { generateBills } = require('../controllers/billController');

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

// Generate Monthly Bills: POST /api/bills/generate
router.post('/generate', generateBills);

module.exports = router;
