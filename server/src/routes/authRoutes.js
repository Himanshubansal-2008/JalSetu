const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { seedDemoGp, isDemoGpSeeded } = require('../utils/demoSeed');

const router = express.Router();

// Helper to sign a JWT token
function sign(user) {
  return jwt.sign(
    { id: user.id, role: user.role, gpId: user.gpId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// Helper to return user object without sensitive fields
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    gpId: user.gpId,
    isActive: Boolean(user.isActive !== undefined ? user.isActive : user.active),
  };
}

// Validation schema for signup
const signupSchema = z.object({
  gpName: z.string().min(2),
  village: z.string().min(2),
  district: z.string().min(2),
  state: z.string().min(2),
  name: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(6),
});

// Validation schema for creating a worker
const createWorkerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(6),
});

// Registration handler helper for /signup and /register
async function handleGpRegistration(req, res, next) {
  try {
    // 1. Validate request body with Zod
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { gpName, village, district, state, name, phone, password } = parsed.data;

    // 2. Check if phone is already registered
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Phone already registered' });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create GramPanchayat (isApproved: false) and Admin User (isActive: true)
    let newGp;
    let newUser;
    try {
      [newGp, newUser] = await prisma.$transaction(async (tx) => {
        const gp = await tx.gramPanchayat.create({
          data: {
            name: gpName,
            village,
            district,
            state,
            isApproved: false,
          },
        });

        const user = await tx.user.create({
          data: {
            gpId: gp.id,
            name,
            phone,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          },
        });

        return [gp, user];
      });
    } catch (err) {
      // Catch unique constraint violation on simultaneous signups
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Phone already registered' });
      }
      throw err;
    }

    // 5. Return 201 Created with pendingApproval: true and NO login token
    return res.status(201).json({
      pendingApproval: true,
      gp: {
        id: newGp.id,
        name: newGp.name,
        village: newGp.village,
        district: newGp.district,
        state: newGp.state,
        isApproved: false,
      },
      user: {
        id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
      },
      message:
        'Gram Panchayat registered successfully. Please wait for admin approval before logging in.',
    });
  } catch (err) {
    next(err);
  }
}

// POST /signup and POST /register (public)
router.post('/signup', handleGpRegistration);
router.post('/register', handleGpRegistration);

// POST /demo-login (public)
router.post('/demo-login', async (req, res, next) => {
  try {
    const { role, resetData } = req.body;

    const normalizedRole = typeof role === 'string' ? role.toUpperCase() : '';
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'WORKER') {
      return res.status(400).json({ error: 'Role must be "admin" or "worker"' });
    }

    const forceReset = Boolean(resetData === true || resetData === 'true');

    // Ensure demo GP is seeded with realistic dataset (or reset if requested)
    const { gp, adminUser, workerUser } = await seedDemoGp(prisma, { forceReset });

    // Select the target demo user
    let user = normalizedRole === 'ADMIN' ? adminUser : workerUser;

    // Safety fallback: fetch user directly if not in return payload
    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          gpId: gp.id,
          role: normalizedRole,
          isActive: true,
        },
      });
    }

    if (!user) {
      return res.status(500).json({ error: `Demo ${role} user not found` });
    }

    // Ensure active status
    if (!user.isActive) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });
    }

    const token = sign(user);
    const userPayload = publicUser(user);

    return res.status(200).json({
      token,
      user: {
        ...userPayload,
        gp,
      },
      gp,
    });
  } catch (err) {
    next(err);
  }
});

// POST /login (public)
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    // Find user by phone with gp
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { gp: true },
    });

    // Check user existence
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Check active status after verifying credentials
    const isActive = Boolean(user.isActive !== undefined ? user.isActive : user.active);
    if (!isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your Gram Panchayat admin.',
      });
    }

    // Check if Gram Panchayat is approved
    if (!user.gp || user.gp.isApproved !== true) {
      return res.status(403).json({
        error:
          'Your Gram Panchayat registration is pending approval. Please contact the administrator.',
      });
    }

    // Generate token and return
    const token = sign(user);
    return res.status(200).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

// GET /me (protected)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { gp: true },
    });

    const isActive = Boolean(user?.isActive !== undefined ? user?.isActive : user?.active);
    if (!user || !isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your Gram Panchayat admin.',
      });
    }

    const { gp, ...userData } = user;
    return res.status(200).json({
      user: publicUser(userData),
      gp,
    });
  } catch (err) {
    next(err);
  }
});

// POST /workers (admin only)
router.post('/workers', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    // 1. Validate request body with Zod
    const parsed = createWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { name, phone, password } = parsed.data;

    // 2. Check if phone is already registered
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Phone already registered' });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create worker (role and gpId are strictly enforced from admin token)
    let newWorker;
    try {
      newWorker = await prisma.user.create({
        data: {
          gpId: req.user.gpId,
          name,
          phone,
          password: hashedPassword,
          role: 'WORKER',
        },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Phone already registered' });
      }
      throw err;
    }

    // 5. Return created worker without password
    return res.status(201).json({
      user: publicUser(newWorker),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
