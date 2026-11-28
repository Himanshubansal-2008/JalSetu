const crypto = require('crypto');

/**
 * Returns the Main Admin password if configured via process.env.MAIN_ADMIN_PASSWORD (for manual login).
 * Otherwise generates a random dummy password to satisfy the PostgreSQL NOT NULL constraint.
 */
function getMainAdminPassword() {
  const envPassword = (process.env.MAIN_ADMIN_PASSWORD || '').trim();
  if (envPassword) {
    return envPassword;
  }
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a random dummy password for demo accounts solely to satisfy
 * the PostgreSQL NOT NULL constraint on the User.password column.
 * Demo accounts log in via one-tap JWT without ever needing passwords.
 */
function generateDummyPassword() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  getMainAdminPassword,
  generateDummyPassword,
};
