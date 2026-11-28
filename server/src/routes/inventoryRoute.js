const express = require('express');
const { authenticate, requireRole, requireAdmin } = require('../middleware/authMiddleware');
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

// All inventory operations require authentication and either GP ADMIN or WORKER role
router.use(authenticate);
router.use(requireRole('ADMIN', 'WORKER'));

// List items: accessible to both ADMIN and WORKER
router.get('/', listInventoryItems);

// Get single item: accessible to both ADMIN and WORKER
router.get('/:id', getInventoryItem);

// Create item: ADMIN only
router.post('/', requireAdmin, createInventoryItem);

// Stock IN: ADMIN only
router.post('/:id/in', requireAdmin, stockIn);

// Stock OUT: accessible to both ADMIN and WORKER
router.post('/:id/out', stockOut);

// Update item: ADMIN only (supports both PUT and PATCH)
router.put('/:id', requireAdmin, updateInventoryItem);
router.patch('/:id', requireAdmin, updateInventoryItem);

// Delete item: ADMIN only
router.delete('/:id', requireAdmin, deleteInventoryItem);

module.exports = router;
