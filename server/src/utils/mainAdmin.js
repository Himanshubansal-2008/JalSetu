const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { getMainAdminPassword } = require('./credentials');

/**
 * Ensures the designated Main Admin user (configured via MAIN_ADMIN_PHONE in .env)
 * exists in the database with role 'ADMIN' and active status.
 * Uses MAIN_ADMIN_PASSWORD from environment (never hardcodes passwords).
 */
async function ensureMainAdminExists() {
  try {
    const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();

    // Dedicated Platform Administration (HQ) GP - strictly isolated from local demo GPs
    let gp = await prisma.gramPanchayat.findFirst({
      where: { name: 'Platform Administration (HQ)' },
    });

    if (!gp) {
      gp = await prisma.gramPanchayat.create({
        data: {
          name: 'Platform Administration (HQ)',
          village: 'Central Headquarters',
          block: 'Central',
          district: 'Pune',
          state: 'Maharashtra',
          isApproved: true,
        },
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: mainAdminPhone },
    });

    if (!existingUser) {
      const rawPassword = getMainAdminPassword();
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await prisma.user.create({
        data: {
          gpId: gp.id,
          name: 'Main Administrator',
          phone: mainAdminPhone,
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
        },
      });
      console.log(`[MainAdmin] Initialized platform main administrator account (${mainAdminPhone})`);
    } else {
      // Ensure linked to HQ GP, role is ADMIN and isActive is true
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { gpId: gp.id, role: 'ADMIN', isActive: true },
      });
      console.log(`[MainAdmin] Verified platform main administrator account (${mainAdminPhone})`);
    }
  } catch (err) {
    console.error('[MainAdmin] Error ensuring main admin exists:', err.message);
  }
}

module.exports = {
  ensureMainAdminExists,
};
