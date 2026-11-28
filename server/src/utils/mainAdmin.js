const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

/**
 * Safely bootstraps the platform Super Admin account.
 * Reads MAIN_ADMIN_PHONE and MAIN_ADMIN_PASSWORD strictly from process.env.
 * Skips bootstrap cleanly with a warning if either is missing (never hardcodes fallbacks).
 * Queries existing users by role: "SUPER_ADMIN" first to prevent privilege hijacking.
 */
async function ensureSuperAdminExists() {
  try {
    const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '').trim();
    const mainAdminPassword = (process.env.MAIN_ADMIN_PASSWORD || '').trim();

    if (!mainAdminPhone || !mainAdminPassword) {
      console.warn(
        '[MainAdmin] Skipping Super Admin bootstrap: MAIN_ADMIN_PHONE or MAIN_ADMIN_PASSWORD is not set in environment.'
      );
      return null;
    }

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

    // 1. Query existing users by role: "SUPER_ADMIN" first
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmin) {
      // Super Admin exists. If password or GP linkage needs syncing, update only that record
      const isPasswordMatch = await bcrypt.compare(mainAdminPassword, existingSuperAdmin.password);
      const updateData = {};
      if (!isPasswordMatch) {
        updateData.password = await bcrypt.hash(mainAdminPassword, 10);
      }
      if (existingSuperAdmin.gpId !== gp.id) {
        updateData.gpId = gp.id;
      }
      if (!existingSuperAdmin.isActive) {
        updateData.isActive = true;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: existingSuperAdmin.id },
          data: updateData,
        });
      }
      console.log(`[MainAdmin] Verified active SUPER_ADMIN account (${existingSuperAdmin.phone})`);
      return existingSuperAdmin;
    }

    // 2. If no SUPER_ADMIN exists, check if MAIN_ADMIN_PHONE is claimed by a non-super-admin
    const userWithPhone = await prisma.user.findUnique({
      where: { phone: mainAdminPhone },
    });

    if (userWithPhone) {
      // NEVER promote a regular user account that happened to register this phone number
      console.error(
        `[MainAdmin] Cannot bootstrap Super Admin: Phone number ${mainAdminPhone} is already claimed by non-super-admin user (${userWithPhone.id}, role: ${userWithPhone.role}). Aborting bootstrap.`
      );
      return null;
    }

    // 3. No SUPER_ADMIN exists and MAIN_ADMIN_PHONE is unclaimed: create SUPER_ADMIN account
    const hashedPassword = await bcrypt.hash(mainAdminPassword, 10);
    const newSuperAdmin = await prisma.user.create({
      data: {
        gpId: gp.id,
        name: 'Platform Super Administrator',
        phone: mainAdminPhone,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    console.log(`[MainAdmin] Created platform SUPER_ADMIN account (${mainAdminPhone})`);
    return newSuperAdmin;
  } catch (err) {
    console.error('[MainAdmin] Error in ensureSuperAdminExists:', err.message);
    return null;
  }
}

module.exports = {
  ensureSuperAdminExists,
  ensureMainAdminExists: ensureSuperAdminExists,
};
