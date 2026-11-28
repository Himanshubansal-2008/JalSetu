/**
 * promote-super-admin.js
 * One-time CLI script to promote an existing user from 'ADMIN' to 'SUPER_ADMIN' by phone number.
 *
 * Usage:
 *   node scripts/promote-super-admin.js <phone>
 *   npm run promote:super-admin <phone>
 *
 * Equivalent Raw SQL:
 *   UPDATE "User"
 *   SET "role" = 'SUPER_ADMIN', "active" = true, "tokenVersion" = "tokenVersion" + 1
 *   WHERE "phone" = '<PHONE_NUMBER>';
 */

require('dotenv').config();
const prisma = require('../src/prisma');

async function promoteSuperAdmin() {
  const phoneArg = process.argv[2] || process.env.MAIN_ADMIN_PHONE;
  const targetPhone = (phoneArg || '').trim();

  if (!targetPhone) {
    console.error('❌ Error: Please provide a phone number to promote:');
    console.error('   npm run promote:super-admin <phone>');
    console.error('   or configure MAIN_ADMIN_PHONE in server/.env\n');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { phone: targetPhone },
      include: { gp: true },
    });

    if (!user) {
      console.error(`❌ Error: No user found with phone number: "${targetPhone}"\n`);
      process.exit(1);
    }

    if (user.role === 'SUPER_ADMIN') {
      console.log(`ℹ️ User "${user.name}" (${user.phone}) is already a SUPER_ADMIN.`);
      process.exit(0);
    }

    // Ensure Platform Administration (HQ) GP exists
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

    // Promote user to SUPER_ADMIN, link to HQ GP, and invalidate previous tokens
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'SUPER_ADMIN',
        gpId: gp.id,
        isActive: true,
        tokenVersion: { increment: 1 },
      },
    });

    console.log('\n✅ Successfully promoted user to SUPER_ADMIN:');
    console.log(`   User ID:       ${updatedUser.id}`);
    console.log(`   Name:          ${updatedUser.name}`);
    console.log(`   Phone:         ${updatedUser.phone}`);
    console.log(`   Previous Role: ${user.role}`);
    console.log(`   New Role:      ${updatedUser.role}`);
    console.log(`   Token Version: ${updatedUser.tokenVersion} (previous tokens revoked)\n`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Database error during promotion:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

promoteSuperAdmin();
