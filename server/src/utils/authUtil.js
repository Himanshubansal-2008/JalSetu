const jwt = require('jsonwebtoken');
const { z } = require('zod');

/**
 * Signs a JWT token containing user id, role, and gpId.
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, gpId: user.gpId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

/**
 * Formats a user object for API responses, removing sensitive fields
 * and computing platform-level flags based strictly on schema role.
 */
function publicUser(user) {
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    gpId: user.gpId,
    isActive: Boolean(user.isActive !== undefined ? user.isActive : user.active),
    isSuperAdmin,
    isMainAdmin: isSuperAdmin,
  };
}

// Zod validation schema for Gram Panchayat registration (signup)
// Explicitly only creates standard GP Admin - never accepts or allows SUPER_ADMIN
const signupSchema = z.object({
  gpName: z.string().min(2, 'Gram Panchayat name must be at least 2 characters'),
  village: z.string().min(2, 'Village name must be at least 2 characters'),
  district: z.string().min(2, 'District must be at least 2 characters'),
  state: z.string().min(2, 'State must be at least 2 characters'),
  name: z.string().min(2, 'Applicant name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Zod validation schema for user login
const loginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  signToken,
  publicUser,
  signupSchema,
  loginSchema,
};
