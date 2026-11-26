const jwt = require('jsonwebtoken');

// Middleware to authenticate requests via JWT Bearer token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role,
      gpId: payload.gpId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
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
