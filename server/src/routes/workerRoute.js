const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const {
  listWorkers,
  createWorker,
  updateWorkerStatus,
  resetWorkerPassword,
} = require('../controllers/workerController');

const router = express.Router();

// All worker management routes require authentication and ADMIN role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/workers - List workers for current GP
router.get('/', listWorkers);

// POST /api/workers - Create new worker for current GP
router.post('/', createWorker);

// POST /api/workers/:id/reset-password - Reset worker password and revoke sessions
router.post('/:id/reset-password', resetWorkerPassword);

// PATCH /api/workers/:id/status - Update worker active status
router.patch('/:id/status', updateWorkerStatus);
router.put('/:id/status', updateWorkerStatus);

module.exports = router;
