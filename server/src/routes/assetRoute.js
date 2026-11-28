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

// Asset routes require authentication and GP operational role (ADMIN or WORKER)
router.use(authenticate);
router.use(requireRole('ADMIN', 'WORKER'));

// Asset routes open to both ADMIN and WORKER
router.post('/', createAsset);
router.get('/', listAssets);
router.get('/:id', getAsset);
router.patch('/:id', updateAsset);
router.post('/:id/events', addAssetEvent);

// Admin-only delete endpoint
router.delete('/:id', requireRole('ADMIN'), deleteAsset);

module.exports = router;
