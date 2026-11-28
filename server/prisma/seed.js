/**
 * seed.js
 * Idempotent database seed script for JalSetu Gram Panchayat O&M system.
 * Delegates to reusable seedDemoGp utility.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { seedDemoGp } = require('../src/utils/demoSeed');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting JalSetu Database Seed (forceReset: true)...\n');
  const { gp, adminUser, workerUser, mainAdminUser } = await seedDemoGp(prisma, { forceReset: true });

  const totalAssetsCount = await prisma.asset.count({ where: { gpId: gp.id } });
  const faultyAssetsCount = await prisma.asset.count({ where: { gpId: gp.id, status: 'FAULTY' } });
  const repairAssetsCount = await prisma.asset.count({ where: { gpId: gp.id, status: 'UNDER_REPAIR' } });
  const totalConsumersCount = await prisma.consumer.count({ where: { gpId: gp.id } });
  const totalBillsCount = await prisma.bill.count({ where: { gpId: gp.id } });
  const totalPaidBillsCount = await prisma.bill.count({ where: { gpId: gp.id, status: 'PAID' } });
  const totalPendingBillsCount = await prisma.bill.count({ where: { gpId: gp.id, status: 'PENDING' } });
  const totalLedgerCount = await prisma.ledgerEntry.count({ where: { gpId: gp.id } });
  const totalInventoryCount = await prisma.inventoryItem.count({ where: { gpId: gp.id } });

  console.log('================================================================');
  console.log('🎉 JalSetu Demo Dataset Seeded Successfully!');
  console.log('================================================================');
  console.log(`Gram Panchayat : ${gp.name} (ID: ${gp.id})`);
  console.log(`Location       : ${gp.village}, ${gp.district}, ${gp.state}`);
  console.log('----------------------------------------------------------------');
  console.log('Accounts Configured for Demo / Testing:');
  console.log(`  Main Admin   : Phone ${mainAdminUser?.phone || '9992934154'}  (Role: main_admin - Super Admin)`);
  console.log(`  GP Admin     : Phone ${adminUser.phone}  (Role: admin - Sarpanch)`);
  console.log(`  Worker User  : Phone ${workerUser.phone}  (Role: worker)`);
  console.log('  * Access via 1-tap demo buttons on mobile login (no passwords required for demo accounts)');
  console.log('----------------------------------------------------------------');
  console.log('Seeded Dataset Counts:');
  console.log(`  GIS Assets   : ${totalAssetsCount} (${faultyAssetsCount} faulty, ${repairAssetsCount} under repair)`);
  console.log(`  Inventory    : ${totalInventoryCount} items`);
  console.log(`  Consumers    : ${totalConsumersCount} households`);
  console.log(`  Bills (2 mos): ${totalBillsCount} (${totalPaidBillsCount} paid, ${totalPendingBillsCount} pending)`);
  console.log(`  Cash Book    : ${totalLedgerCount} entries`);
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
