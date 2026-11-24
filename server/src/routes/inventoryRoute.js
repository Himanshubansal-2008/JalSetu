const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  stockIn,
  stockOut,
} = require('../controllers/inventoryController');

const router = express.Router();

// List items: accessible to both ADMIN and WORKER
router.get('/', authenticate, listInventoryItems);

// Get single item: accessible to both ADMIN and WORKER
router.get('/:id', authenticate, getInventoryItem);

// Create item: ADMIN only
router.post('/', authenticate, requireRole('ADMIN'), createInventoryItem);

// Stock IN: ADMIN only
router.post('/:id/in', authenticate, requireRole('ADMIN'), stockIn);

// Stock OUT: accessible to both ADMIN and WORKER
router.post('/:id/out', authenticate, stockOut);

// Update item: ADMIN only (supports both PUT and PATCH)
router.put('/:id', authenticate, requireRole('ADMIN'), updateInventoryItem);
router.patch('/:id', authenticate, requireRole('ADMIN'), updateInventoryItem);

// Delete item: ADMIN only
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteInventoryItem);

module.exports = router;
