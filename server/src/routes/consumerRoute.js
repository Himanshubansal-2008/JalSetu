const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const {
  listConsumers,
  getConsumer,
  createConsumer,
  updateConsumer,
  deactivateConsumer,
  deleteConsumer,
} = require('../controllers/consumerController');

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

// All consumer routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// List Consumers: GET /api/consumers
router.get('/', listConsumers);

// Get Single Consumer: GET /api/consumers/:id
router.get('/:id', getConsumer);

// Create Consumer: POST /api/consumers
router.post('/', createConsumer);

// Edit Consumer: PUT & PATCH /api/consumers/:id
router.put('/:id', updateConsumer);
router.patch('/:id', updateConsumer);

// Deactivate Consumer: POST /api/consumers/:id/deactivate
router.post('/:id/deactivate', deactivateConsumer);

// Delete / Soft-deactivate Consumer: DELETE /api/consumers/:id
router.delete('/:id', deleteConsumer);

module.exports = router;
