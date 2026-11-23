const express = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const {
  createAsset,
  listAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  addAssetEvent,
} = require('../controllers/assetController');

const router = express.Router();

// Asset routes open to both ADMIN and WORKER
router.post('/', authenticate, createAsset);
router.get('/', authenticate, listAssets);
router.get('/:id', authenticate, getAsset);
router.patch('/:id', authenticate, updateAsset);
router.post('/:id/events', authenticate, addAssetEvent);

// Admin-only delete endpoint
router.delete('/:id', authenticate, requireRole('ADMIN'), deleteAsset);

module.exports = router;
