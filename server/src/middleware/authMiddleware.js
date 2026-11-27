const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Middleware to authenticate requests via JWT Bearer token and enforce active account
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (!payload || !payload.id) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        role: true,
        gpId: true,
        name: true,
        phone: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!dbUser.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Contact your Gram Panchayat admin.',
      });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      gpId: dbUser.gpId,
      name: dbUser.name,
      phone: dbUser.phone,
      isActive: dbUser.isActive,
    };

    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to enforce role-based access control
const requireRole = (...roles) => {
  const normalized = roles.map((r) => r.toUpperCase());
  return (req, res, next) => {
    const userRole = req.user?.role?.toUpperCase();
    if (!req.user || !userRole || !normalized.includes(userRole)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireRole,
};
