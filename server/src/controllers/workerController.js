/**
 * workerController.js
 * Admin-only Worker Management controller for JalKosh.
 *
 * Scoped strictly to the authenticated admin's Gram Panchayat (gpId = req.user.gpId).
 * Allows listing, creating, and toggling active status of GP workers.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

/**
 * List Workers: GET /api/workers
 * Admin-only, scoped strictly to logged-in admin's gpId.
 * Never returns password hashes.
 */
async function listWorkers(req, res, next) {
  try {
    const gpId = req.user?.gpId;
    if (!gpId) {
      return res.status(401).json({ error: 'Unauthorized: missing Gram Panchayat scoping' });
    }

    const workers = await prisma.user.findMany({
      where: {
        gpId,
        role: 'WORKER',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });

    return res.status(200).json({
      workers,
      count: workers.length,
    });
  } catch (err) {
    console.error('Error listing workers:', err);
    return res.status(500).json({ error: 'Failed to list workers' });
  }
}

/**
 * Create Worker: POST /api/workers
 * Admin-only, creates a new worker under the admin's gpId with isActive: true.
 */
async function createWorker(req, res, next) {
  try {
    const gpId = req.user?.gpId;
    if (!gpId) {
      return res.status(401).json({ error: 'Unauthorized: missing Gram Panchayat scoping' });
    }

    const { name, phone } = req.body || {};
    const rawPassword = req.body?.password || req.body?.tempPassword;

    // Validate name
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate phone
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    if (!cleanPhone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    // Validate password (at least 6 characters)
    if (!rawPassword || typeof rawPassword !== 'string' || rawPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check duplicate phone
    const existingUser = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Phone already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    // Create worker
    const newWorker = await prisma.user.create({
      data: {
        gpId,
        name: cleanName,
        phone: cleanPhone,
        password: hashedPassword,
        role: 'WORKER',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      worker: newWorker,
      user: newWorker,
      id: newWorker.id,
      name: newWorker.name,
      phone: newWorker.phone,
      role: newWorker.role,
      isActive: newWorker.isActive,
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Phone already registered' });
    }
    console.error('Error creating worker:', err);
    return res.status(500).json({ error: 'Failed to create worker' });
  }
}

/**
 * Toggle Worker Active Status: PATCH /api/workers/:id/status
 * Admin-only, toggles isActive boolean for a worker in the admin's GP.
 * Cross-GP and non-worker targets reject with 404.
 */
async function updateWorkerStatus(req, res, next) {
  try {
    const gpId = req.user?.gpId;
    if (!gpId) {
      return res.status(401).json({ error: 'Unauthorized: missing Gram Panchayat scoping' });
    }

    const { id } = req.params;
    const { isActive } = req.body || {};

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    // Find worker by id, scoped strictly to this GP and role: 'WORKER'
    const worker = await prisma.user.findFirst({
      where: {
        id,
        gpId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Update active status
    const updatedWorker = await prisma.user.update({
      where: { id: worker.id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    return res.status(200).json({
      worker: updatedWorker,
    });
  } catch (err) {
    console.error('Error updating worker status:', err);
    return res.status(500).json({ error: 'Failed to update worker status' });
  }
}

module.exports = {
  listWorkers,
  createWorker,
  updateWorkerStatus,
};
