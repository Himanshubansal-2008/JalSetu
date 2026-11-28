const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { phoneSchema, strongPasswordSchema } = require('./validationUtil');

/**
 * Signs a JWT token containing user id, role, gpId, and tokenVersion.
 * Default expiry shortened to 12h.
 */
function signToken(user, expiresIn = '12h') {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      gpId: user.gpId,
      tokenVersion: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Shared helper to check if a user is a platform Super Administrator.
 */
function isSuperAdmin(user) {
  return user?.role === 'SUPER_ADMIN';
}

/**
 * Formats a user object for API responses, removing sensitive fields
 * and computing platform-level flags based strictly on schema role.
 */
function publicUser(user) {
  const superAdminFlag = isSuperAdmin(user);

  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    gpId: user.gpId,
    isActive: Boolean(user.isActive),
    isSuperAdmin: superAdminFlag,
    isMainAdmin: superAdminFlag,
  };
}

// Zod validation schema for Gram Panchayat registration (signup)
// Explicitly only creates standard GP Admin - never accepts or allows SUPER_ADMIN
const signupSchema = z.object({
  gpName: z.string().trim().min(2, 'Gram Panchayat name must be at least 2 characters'),
  village: z.string().trim().min(2, 'Village name must be at least 2 characters'),
  district: z.string().trim().min(2, 'District must be at least 2 characters'),
  state: z.string().trim().min(2, 'State must be at least 2 characters'),
  name: z.string().trim().min(2, 'Applicant name must be at least 2 characters'),
  phone: phoneSchema,
  password: strongPasswordSchema,
});

// Zod validation schema for user login
const loginSchema = z.object({
  phone: z.string().trim().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

// Zod validation schema for changing own password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPasswordSchema,
});

module.exports = {
  isSuperAdmin,
  signToken,
  publicUser,
  signupSchema,
  loginSchema,
  changePasswordSchema,
  phoneSchema,
  strongPasswordSchema,
};
