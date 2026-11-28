const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { seedDemoGp } = require('../utils/demoSeed');
const { signToken, publicUser, signupSchema, loginSchema } = require('../utils/authUtil');

/**
 * Register a new Gram Panchayat and initial Admin user.
 * POST /api/auth/signup & POST /api/auth/register
 */
async function registerGp(req, res, next) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { gpName, village, district, state, name, phone, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'Phone already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Phone already registered' });
      }
      throw err;
    }

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

/**
 * Demo 1-tap login for testing & presentations.
 * POST /api/auth/demo-login
 * Accepts role: "main_admin" | "admin" | "worker"
 */
async function demoLogin(req, res, next) {
  try {
    const { role } = req.body;

    const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
    if (normalizedRole !== 'main_admin' && normalizedRole !== 'admin' && normalizedRole !== 'worker') {
      return res.status(400).json({ error: 'Role must be "main_admin", "admin", or "worker"' });
    }

    // Ensure demo dataset exists without wiping existing data
    const { gp, adminUser, workerUser, mainAdminUser } = await seedDemoGp(prisma, { forceReset: false });

    let user;
    let userGp = gp;
    const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();

    if (normalizedRole === 'main_admin') {
      user = await prisma.user.findUnique({
        where: { phone: mainAdminPhone },
        include: { gp: true },
      }) || mainAdminUser;
      userGp = user?.gp || gp;
    } else if (normalizedRole === 'admin') {
      user = await prisma.user.findFirst({
        where: {
          gpId: gp.id,
          phone: { not: mainAdminPhone },
          role: 'ADMIN',
          isActive: true,
        },
        include: { gp: true },
      }) || adminUser;
      userGp = gp;
    } else {
      user = await prisma.user.findFirst({
        where: { gpId: gp.id, role: 'WORKER', isActive: true },
        include: { gp: true },
      }) || workerUser;
      userGp = gp;
    }

    if (!user) {
      return res.status(500).json({ error: `Demo ${role} user not found` });
    }

    if (!user.isActive) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
        include: { gp: true },
      });
    }

    const token = signToken(user);
    const userPayload = publicUser(user);

    return res.status(200).json({
      token,
      user: {
        ...userPayload,
        gp: userGp,
      },
      gp: userGp,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Standard user login with phone & password.
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { phone, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { phone },
      include: { gp: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const isActive = Boolean(user.isActive !== undefined ? user.isActive : user.active);
    if (!isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your Gram Panchayat admin.',
      });
    }

    if (!user.gp || user.gp.isApproved !== true) {
      return res.status(403).json({
        error:
          'Your Gram Panchayat registration is pending approval. Please contact the administrator.',
      });
    }

    const token = signToken(user);
    return res.status(200).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get authenticated user profile and associated Gram Panchayat.
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
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
}

module.exports = {
  registerGp,
  demoLogin,
  login,
  getMe,
};
