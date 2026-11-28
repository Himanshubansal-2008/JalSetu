/**
 * workerController.js
 * Admin-only Worker Management controller for JalSetu.
 *
 * Scoped strictly to the authenticated admin's Gram Panchayat (gpId = req.user.gpId).
 * Allows listing, creating, and toggling active status of GP workers.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { parsePagination } = require('../utils/paginationUtil');
const { phoneSchema, strongPasswordSchema } = require('../utils/validationUtil');

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

    const where = {
      gpId,
      role: 'WORKER',
    };

    const { isPaginated, page, limit, skip } = parsePagination(req.query);
    const total = await prisma.user.count({ where });
    const totalPages = isPaginated ? (Math.ceil(total / limit) || 1) : 1;

    const findOptions = {
      where,
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
    };

    if (isPaginated) {
      findOptions.skip = skip;
      findOptions.take = limit;
    }

    const workers = await prisma.user.findMany(findOptions);

    return res.status(200).json({
      items: workers,
      workers,
      count: workers.length,
      total,
      page: isPaginated ? page : 1,
      totalPages,
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
    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    // Validate phone using shared Indian 10-digit mobile validator
    const phoneParsed = phoneSchema.safeParse(phone);
    if (!phoneParsed.success) {
      return res.status(400).json({ error: phoneParsed.error.issues[0].message });
    }
    const cleanPhone = phoneParsed.data;

    // Validate password (min 8 characters, at least 1 letter and 1 number)
    const pwdParsed = strongPasswordSchema.safeParse(rawPassword);
    if (!pwdParsed.success) {
      return res.status(400).json({ error: pwdParsed.error.issues[0].message });
    }

    // Check duplicate phone
    const existingUser = await prisma.user.findUnique({
      where: { phone: cleanPhone },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Phone already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(pwdParsed.data, 10);

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

    // Update active status (increment tokenVersion on deactivation to revoke active sessions)
    const updateData = { isActive };
    if (!isActive) {
      updateData.tokenVersion = { increment: 1 };
    }

    const updatedWorker = await prisma.user.update({
      where: { id: worker.id },
      data: updateData,
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

/**
 * Reset Worker Password: POST /api/workers/:id/reset-password
 * Admin-only, resets a worker's password in their own GP and increments tokenVersion to revoke all existing sessions.
 */
async function resetWorkerPassword(req, res, next) {
  try {
    const gpId = req.user?.gpId;
    if (!gpId) {
      return res.status(401).json({ error: 'Unauthorized: missing Gram Panchayat scoping' });
    }

    const { id } = req.params;
    const rawPassword = req.body?.newPassword || req.body?.password;

    const parsed = strongPasswordSchema.safeParse(rawPassword);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

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

    const hashedPassword = await bcrypt.hash(parsed.data, 10);

    const updatedWorker = await prisma.user.update({
      where: { id: worker.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        tokenVersion: true,
      },
    });

    return res.status(200).json({
      message: 'Worker password reset successfully. All existing sessions have been revoked.',
      worker: updatedWorker,
    });
  } catch (err) {
    console.error('Error resetting worker password:', err);
    return res.status(500).json({ error: 'Failed to reset worker password' });
  }
}

module.exports = {
  listWorkers,
  createWorker,
  updateWorkerStatus,
  resetWorkerPassword,
};
