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

// All inventory operations require authentication and either GP ADMIN or WORKER role
router.use(authenticate);
router.use(requireRole('ADMIN', 'WORKER'));

// List items: accessible to both ADMIN and WORKER
router.get('/', listInventoryItems);

// Get single item: accessible to both ADMIN and WORKER
router.get('/:id', getInventoryItem);

// Create item: ADMIN only
router.post('/', requireRole('ADMIN'), createInventoryItem);

// Stock IN: ADMIN only
router.post('/:id/in', requireRole('ADMIN'), stockIn);

// Stock OUT: accessible to both ADMIN and WORKER
router.post('/:id/out', stockOut);

// Update item: ADMIN only (supports both PUT and PATCH)
router.put('/:id', requireRole('ADMIN'), updateInventoryItem);
router.patch('/:id', requireRole('ADMIN'), updateInventoryItem);

// Delete item: ADMIN only
router.delete('/:id', requireRole('ADMIN'), deleteInventoryItem);

module.exports = router;
