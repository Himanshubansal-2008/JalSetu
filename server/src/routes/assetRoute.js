const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { createAsset, listAssets } = require('../controllers/assetController');

const router = express.Router();

// Asset routes open to both ADMIN and WORKER
router.post('/', authenticate, createAsset);
router.get('/', authenticate, listAssets);

module.exports = router;
