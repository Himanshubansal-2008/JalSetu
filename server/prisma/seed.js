/**
 * seed.js
 * Idempotent database seed script for JalKosh Gram Panchayat O&M system.
 *
 * Populates a realistic demo dataset in PostgreSQL via Prisma:
 * - 1 Gram Panchayat (Gram Panchayat Shirur)
 * - 1 Admin user + 2 Worker users (with hashed passwords)
 * - 15 GIS water supply assets with local coordinates and asset events
 * - 8 Inventory items (exactly 2 below reorder level)
 * - 20 Household consumers
 * - 2 Months of bills (previous & current month) with realistic Paid/Pending distribution
 * - Multi-week Ledger entries (manual grants, donations, expenses, and linked system-generated water tax receipts)
 *
 * Safe to run repeatedly (resets and repopulates demo GP records cleanly).
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Demo Gram Panchayat details
const DEMO_GP = {
  name: 'Gram Panchayat Shirur',
  village: 'Shirur',
  block: 'Shirur',
  district: 'Pune',
  state: 'Maharashtra',
  upiId: 'shirurgp@upi',
  openingBalance: 5000000, // ₹50,000.00
};

// Demo Users
const DEMO_USERS = [
  {
    name: 'Sarpanch Ramesh Patil',
    phone: '9876543210',
    rawPassword: 'Admin@123',
    role: 'ADMIN',
  },
  {
    name: 'Vikas Shinde (Operator)',
    phone: '9876543211',
    rawPassword: 'Worker@123',
    role: 'WORKER',
  },
  {
    name: 'Sunil More (Lineman)',
    phone: '9876543212',
    rawPassword: 'Worker@123',
    role: 'WORKER',
  },
];

// 15 GIS Water Supply Assets in Shirur / Pune region (lat: ~18.82, lng: ~74.37)
const DEMO_ASSETS = [
  {
    name: 'Main Borewell Source #1',
    type: 'SOURCE',
    status: 'WORKING',
    lat: 18.8245,
    lng: 74.3789,
    cost: 18000000, // ₹1,80,000
    attributes: { depthMeters: 120, yieldLph: 15000, casingType: 'MS' },
    notes: 'Primary deep groundwater extraction source with good recharge.',
  },
  {
    name: 'River Infiltration Well',
    type: 'SOURCE',
    status: 'WORKING',
    lat: 18.8312,
    lng: 74.3854,
    cost: 35000000, // ₹3,50,000
    attributes: { diameterMeters: 6, depthMeters: 14, source: 'Ghod River basin' },
    notes: 'Jackwell intake feeding the water treatment plant.',
  },
  {
    name: 'High-Head Submersible Pump #1',
    type: 'PUMP',
    status: 'WORKING',
    lat: 18.8248,
    lng: 74.3792,
    cost: 8500000, // ₹85,000
    attributes: { hp: 10, dischargeLps: 25, headMeters: 80, phase: 3 },
    notes: 'Installed inside Main Borewell Source #1.',
  },
  {
    name: 'Booster Pump Station #2 (Ward 2)',
    type: 'PUMP',
    status: 'FAULTY',
    lat: 18.8214,
    lng: 74.3731,
    cost: 6500000, // ₹65,000
    attributes: { hp: 7.5, dischargeLps: 18, issue: 'Drive bearing vibration and high temp' },
    notes: 'Reported faulty during morning pumping cycle. Needs bearing overhaul.',
  },
  {
    name: 'Standby Submersible Pump #3',
    type: 'PUMP',
    status: 'UNDER_REPAIR',
    lat: 18.8291,
    lng: 74.3815,
    cost: 6500000, // ₹65,000
    attributes: { hp: 7.5, dischargeLps: 18, repairStage: 'Stator rewinding' },
    notes: 'Dispatched to authorized service centre in Pune for rewinding.',
  },
  {
    name: 'Elevated Storage Reservoir (OHT-1)',
    type: 'TANK',
    status: 'WORKING',
    lat: 18.8267,
    lng: 74.3755,
    cost: 45000000, // ₹4,50,000
    attributes: { capacityL: 100000, stagingMeters: 15, material: 'RCC' },
    notes: 'Primary overhead tank supplying Sector A and central bazaar.',
  },
  {
    name: 'Ground Level Service Reservoir (GLSR-2)',
    type: 'TANK',
    status: 'WORKING',
    lat: 18.8305,
    lng: 74.3842,
    cost: 28000000, // ₹2,80,000
    attributes: { capacityL: 75000, material: 'RCC', chlorinationChamber: true },
    notes: 'Receives water from river intake; acts as clean water sump.',
  },
  {
    name: 'Main Transmission Rising Main (150mm DI)',
    type: 'PIPELINE',
    status: 'WORKING',
    lat: 18.8285,
    lng: 74.3802,
    cost: 32000000, // ₹3,20,000
    attributes: { diameterMm: 150, lengthMeters: 1200, material: 'Ductile Iron K9' },
    notes: 'Main header pipeline from pump station to OHT-1.',
  },
  {
    name: 'Ward 1 Distribution Pipeline (90mm HDPE)',
    type: 'PIPELINE',
    status: 'UNDER_REPAIR',
    lat: 18.8228,
    lng: 74.3718,
    cost: 14000000, // ₹1,40,000
    attributes: { diameterMm: 90, lengthMeters: 850, material: 'HDPE PE100' },
    notes: 'Minor joint blowout near house H-108. Lineman fixing with electrofusion coupler.',
  },
  {
    name: 'Ward 2 Distribution Pipeline (75mm PVC)',
    type: 'PIPELINE',
    status: 'WORKING',
    lat: 18.8198,
    lng: 74.3695,
    cost: 9500000, // ₹95,000
    attributes: { diameterMm: 75, lengthMeters: 650, material: 'PVC Class 3' },
    notes: 'Supplies South Ward household tap connections.',
  },
  {
    name: 'Sluice Isolation Valve - Sector A',
    type: 'VALVE',
    status: 'WORKING',
    lat: 18.8258,
    lng: 74.3742,
    cost: 120000, // ₹1,200
    attributes: { sizeMm: 100, type: 'Resilient seated gate valve' },
    notes: 'Controls gravity feed into Sector A residential zone.',
  },
  {
    name: 'Air Release Valve - High Ridge',
    type: 'VALVE',
    status: 'FAULTY',
    lat: 18.8272,
    lng: 74.3768,
    cost: 85000, // ₹850
    attributes: { sizeMm: 50, type: 'Kinetic double orifice' },
    notes: 'Float mechanism leaking air/water during high pressure surge.',
  },
  {
    name: 'Rapid Sand Filter & Chlorination Unit',
    type: 'TREATMENT_PLANT',
    status: 'WORKING',
    lat: 18.8308,
    lng: 74.3848,
    cost: 22000000, // ₹2,20,000
    attributes: { capacityMld: 0.5, dosingType: 'Gas/Sodium Hypochlorite', media: 'Silica sand' },
    notes: 'Water treatment filtration and residual chlorine disinfection unit.',
  },
  {
    name: 'Public Standpost #1 - Main Chowk',
    type: 'STANDPOST',
    status: 'WORKING',
    lat: 18.8239,
    lng: 74.3749,
    cost: 65000, // ₹650
    attributes: { taps: 4, platformType: 'Concrete with soak pit' },
    notes: 'Community drinking water post near village panchayat bhavan.',
  },
  {
    name: 'Public Standpost #2 - ZP Primary School',
    type: 'STANDPOST',
    status: 'WORKING',
    lat: 18.8211,
    lng: 74.3776,
    cost: 65000, // ₹650
    attributes: { taps: 2, platformType: 'Concrete apron with drainage' },
    notes: 'Dedicated drinking water facility for primary school students.',
  },
];

// 8 Inventory items (Exactly 2 items below reorder level)
const DEMO_INVENTORY = [
  {
    name: 'Bleaching Powder (Grade 1)',
    unit: 'kg',
    quantity: 15,
    reorderLevel: 25, // LOW STOCK (15 <= 25)
  },
  {
    name: 'Gate Valve Rubber Seals (100mm)',
    unit: 'piece',
    quantity: 2,
    reorderLevel: 5, // LOW STOCK (2 <= 5)
  },
  {
    name: 'Chlorine Disinfection Tablets',
    unit: 'piece',
    quantity: 500,
    reorderLevel: 100, // OK
  },
  {
    name: 'PVC Pipe Joints (90mm Couplers)',
    unit: 'piece',
    quantity: 45,
    reorderLevel: 15, // OK
  },
  {
    name: 'Submersible Pump Spare Impellers (10HP)',
    unit: 'piece',
    quantity: 8,
    reorderLevel: 3, // OK
  },
  {
    name: 'Digital Pressure Gauge (0-10 Bar)',
    unit: 'piece',
    quantity: 6,
    reorderLevel: 2, // OK
  },
  {
    name: 'Heavy Duty Bearing Grease',
    unit: 'kg',
    quantity: 18,
    reorderLevel: 5, // OK
  },
  {
    name: 'Filter Silica Sand (0.5-1.0mm)',
    unit: 'kg',
    quantity: 250,
    reorderLevel: 80, // OK
  },
];

// 20 Consumers with varied monthly tariffs (₹150 to ₹300)
const DEMO_CONSUMERS = [
  { name: 'Ramesh Patil', houseNumber: 'H-101', phone: '9820010101', monthlyChargePaise: 15000 },
  { name: 'Suresh Deshmukh', houseNumber: 'H-102', phone: '9820010102', monthlyChargePaise: 20000 },
  { name: 'Anita Kadam', houseNumber: 'H-103', phone: '9820010103', monthlyChargePaise: 15000 },
  { name: 'Ganesh Jadhav', houseNumber: 'H-104', phone: '9820010104', monthlyChargePaise: 25000 },
  { name: 'Priya Shinde', houseNumber: 'H-105', phone: '9820010105', monthlyChargePaise: 20000 },
  { name: 'Vijay More', houseNumber: 'H-106', phone: '9820010106', monthlyChargePaise: 30000 },
  { name: 'Savita Pawar', houseNumber: 'H-107', phone: '9820010107', monthlyChargePaise: 15000 },
  { name: 'Rahul Gaikwad', houseNumber: 'H-108', phone: '9820010108', monthlyChargePaise: 20000 },
  { name: 'Deepak Bhosale', houseNumber: 'H-109', phone: '9820010109', monthlyChargePaise: 25000 },
  { name: 'Sunita Chavan', houseNumber: 'H-110', phone: '9820010110', monthlyChargePaise: 15000 },
  { name: 'Mahesh Jagtap', houseNumber: 'H-111', phone: '9820010111', monthlyChargePaise: 20000 },
  { name: 'Pooja Salunke', houseNumber: 'H-112', phone: '9820010112', monthlyChargePaise: 30000 },
  { name: 'Sachin Ghorpade', houseNumber: 'H-113', phone: '9820010113', monthlyChargePaise: 20000 },
  { name: 'Manisha Thorat', houseNumber: 'H-114', phone: '9820010114', monthlyChargePaise: 15000 },
  { name: 'Nitin Sonawane', houseNumber: 'H-115', phone: '9820010115', monthlyChargePaise: 25000 },
  { name: 'Alka Kale', houseNumber: 'H-116', phone: '9820010116', monthlyChargePaise: 15000 },
  { name: 'Vinod Tambe', houseNumber: 'H-117', phone: '9820010117', monthlyChargePaise: 20000 },
  { name: 'Vaishali Gite', houseNumber: 'H-118', phone: '9820010118', monthlyChargePaise: 30000 },
  { name: 'Anand Shirole', houseNumber: 'H-119', phone: '9820010119', monthlyChargePaise: 20000 },
  { name: 'Jyoti Wagh', houseNumber: 'H-120', phone: '9820010120', monthlyChargePaise: 25000 },
];

async function seed() {
  console.log('🌱 Starting JalKosh Database Seed...\n');

  // Compute previous and current month dynamically (e.g. "2026-10" and "2026-11")
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthNum = now.getUTCMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const prevDate = new Date(Date.UTC(currentYear, currentMonthNum - 2, 1));
  const prevMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

  // 1. Find or Create Demo Gram Panchayat (Idempotent cleanup for demo GP)
  console.log(`[1/6] Preparing Gram Panchayat: "${DEMO_GP.name}"...`);
  let gp = await prisma.gramPanchayat.findFirst({
    where: { name: DEMO_GP.name },
  });

  if (gp) {
    console.log(`  Cleaning existing records for GP ${gp.id} in strict dependency order...`);
    // Delete in dependency order:
    await prisma.ledgerEntry.deleteMany({ where: { gpId: gp.id } });
    await prisma.bill.deleteMany({ where: { gpId: gp.id } });
    await prisma.consumer.deleteMany({ where: { gpId: gp.id } });
    await prisma.stockTxn.deleteMany({ where: { item: { gpId: gp.id } } });
    await prisma.inventoryItem.deleteMany({ where: { gpId: gp.id } });
    await prisma.assetEvent.deleteMany({ where: { asset: { gpId: gp.id } } });
    await prisma.asset.deleteMany({ where: { gpId: gp.id } });
    await prisma.user.deleteMany({ where: { gpId: gp.id } });
    await prisma.gramPanchayat.delete({ where: { id: gp.id } });
  }

  // Also ensure demo user phones are cleaned up if attached to old orphaned records
  const demoPhones = DEMO_USERS.map((u) => u.phone);
  await prisma.user.deleteMany({ where: { phone: { in: demoPhones } } });

  // Create clean Gram Panchayat
  gp = await prisma.gramPanchayat.create({
    data: DEMO_GP,
  });
  console.log(`  ✓ Gram Panchayat created: ${gp.name} (ID: ${gp.id})\n`);

  // 2. Create Demo Admin & Worker Users
  console.log('[2/6] Seeding Admin and Worker users...');
  const userMap = {};
  for (const u of DEMO_USERS) {
    const hashedPassword = await bcrypt.hash(u.rawPassword, 10);
    const createdUser = await prisma.user.create({
      data: {
        gpId: gp.id,
        name: u.name,
        phone: u.phone,
        password: hashedPassword,
        role: u.role,
        isActive: true,
      },
    });
    userMap[u.role] = createdUser;
    console.log(`  ✓ Created ${u.role}: ${u.name} (Phone: ${u.phone})`);
  }
  const adminUser = userMap.ADMIN;
  console.log('');

  // 3. Create ~15 GIS Water Assets & Initial Events
  console.log('[3/6] Seeding 15 GIS Water Supply Assets and logs...');
  const createdAssets = [];
  for (let i = 0; i < DEMO_ASSETS.length; i++) {
    const assetDef = DEMO_ASSETS[i];
    const asset = await prisma.asset.create({
      data: {
        gpId: gp.id,
        name: assetDef.name,
        type: assetDef.type,
        status: assetDef.status,
        lat: assetDef.lat,
        lng: assetDef.lng,
        cost: assetDef.cost,
        installDate: new Date(Date.UTC(2025, 3, 1 + i)),
        warrantyExpiry: new Date(Date.UTC(2028, 3, 1 + i)),
        attributes: assetDef.attributes,
        notes: assetDef.notes,
      },
    });
    createdAssets.push(asset);

    // Seed realistic asset events
    if (assetDef.status === 'FAULTY') {
      await prisma.assetEvent.create({
        data: {
          assetId: asset.id,
          createdById: adminUser.id,
          kind: 'STATUS_CHANGE',
          note: 'Status set to FAULTY: ' + (assetDef.notes || 'Component failure reported during operation'),
          createdAt: new Date(Date.UTC(2026, 10, 18, 9, 30)),
        },
      });
    } else if (assetDef.status === 'UNDER_REPAIR') {
      await prisma.assetEvent.create({
        data: {
          assetId: asset.id,
          createdById: adminUser.id,
          kind: 'REPAIR',
          note: 'Work order issued: ' + (assetDef.notes || 'Repair underway'),
          createdAt: new Date(Date.UTC(2026, 10, 20, 14, 0)),
        },
      });
    } else {
      await prisma.assetEvent.create({
        data: {
          assetId: asset.id,
          createdById: adminUser.id,
          kind: 'INSPECTION',
          note: 'Routine preventative inspection completed. Operating within normal parameters.',
          createdAt: new Date(Date.UTC(2026, 10, 5, 11, 0)),
        },
      });
    }
  }
  console.log(`  ✓ 15 Assets and event logs seeded across types and statuses.\n`);

  // 4. Create ~8 Inventory Items (Exactly 2 Below Reorder Level)
  console.log('[4/6] Seeding 8 Inventory items (2 below reorder level)...');
  const createdInventory = [];
  let lowStockCount = 0;
  for (const itemDef of DEMO_INVENTORY) {
    const item = await prisma.inventoryItem.create({
      data: {
        gpId: gp.id,
        name: itemDef.name,
        unit: itemDef.unit,
        quantity: itemDef.quantity,
        reorderLevel: itemDef.reorderLevel,
      },
    });
    createdInventory.push(item);
    if (item.quantity <= item.reorderLevel) {
      lowStockCount++;
      console.log(`  ⚠ [LOW STOCK] ${item.name} (${item.quantity} ${item.unit} <= ${item.reorderLevel})`);
    } else {
      console.log(`  ✓ [In Stock] ${item.name} (${item.quantity} ${item.unit})`);
    }
  }
  console.log(`  ✓ Inventory seeded: ${createdInventory.length} items (${lowStockCount} below reorder level).\n`);

  // 5. Create ~20 Consumers and 2 Months of Bills
  console.log('[5/6] Seeding 20 Consumers and 2 months of bills (' + prevMonthStr + ' & ' + currentMonthStr + ')...');
  const createdConsumers = [];
  for (const cDef of DEMO_CONSUMERS) {
    const consumer = await prisma.consumer.create({
      data: {
        gpId: gp.id,
        name: cDef.name,
        houseNumber: cDef.houseNumber,
        phone: cDef.phone,
        monthlyChargePaise: cDef.monthlyChargePaise,
        isActive: true,
      },
    });
    createdConsumers.push(consumer);
  }

  // Generate Previous Month Bills (16 Paid, 4 Pending)
  const paidBillsWithConsumer = [];
  let prevMonthPaidCount = 0;
  let prevMonthPendingCount = 0;

  for (let i = 0; i < createdConsumers.length; i++) {
    const consumer = createdConsumers[i];
    const isPaid = i < 16; // First 16 paid, last 4 pending
    const modes = ['Cash', 'UPI', 'Cheque'];
    const selectedMode = modes[i % 3];
    const paidDay = Math.min(28, 5 + (i % 20));
    const paidDate = new Date(Date.UTC(2026, 9, paidDay, 10 + (i % 8), 15));
    const reference =
      selectedMode === 'Cash'
        ? `REC-${prevMonthStr.replace('-', '')}-${101 + i}`
        : selectedMode === 'UPI'
        ? `UPI/${prevMonthStr.replace('-', '')}90${100 + i}`
        : `CHQ-40${100 + i}`;

    const bill = await prisma.bill.create({
      data: {
        gpId: gp.id,
        consumerId: consumer.id,
        month: prevMonthStr,
        amountPaise: consumer.monthlyChargePaise,
        status: isPaid ? 'PAID' : 'PENDING',
        paidAt: isPaid ? paidDate : null,
        mode: isPaid ? selectedMode : null,
        reference: isPaid ? reference : null,
      },
    });

    if (isPaid) {
      prevMonthPaidCount++;
      paidBillsWithConsumer.push({ bill, consumer });
    } else {
      prevMonthPendingCount++;
    }
  }

  // Generate Current Month Bills (10 Paid, 10 Pending)
  let currentMonthPaidCount = 0;
  let currentMonthPendingCount = 0;

  for (let i = 0; i < createdConsumers.length; i++) {
    const consumer = createdConsumers[i];
    const isPaid = i < 10; // First 10 paid, remaining 10 pending
    const modes = ['Cash', 'UPI', 'Cheque'];
    const selectedMode = modes[(i + 1) % 3];
    const paidDay = Math.min(26, 3 + (i % 18));
    const paidDate = new Date(Date.UTC(2026, 10, paidDay, 11 + (i % 6), 30));
    const reference =
      selectedMode === 'Cash'
        ? `REC-${currentMonthStr.replace('-', '')}-${201 + i}`
        : selectedMode === 'UPI'
        ? `UPI/${currentMonthStr.replace('-', '')}80${200 + i}`
        : `CHQ-50${200 + i}`;

    const bill = await prisma.bill.create({
      data: {
        gpId: gp.id,
        consumerId: consumer.id,
        month: currentMonthStr,
        amountPaise: consumer.monthlyChargePaise,
        status: isPaid ? 'PAID' : 'PENDING',
        paidAt: isPaid ? paidDate : null,
        mode: isPaid ? selectedMode : null,
        reference: isPaid ? reference : null,
      },
    });

    if (isPaid) {
      currentMonthPaidCount++;
      paidBillsWithConsumer.push({ bill, consumer });
    } else {
      currentMonthPendingCount++;
    }
  }

  console.log(`  ✓ 20 Consumers seeded.`);
  console.log(`  ✓ ${prevMonthStr} Bills: ${prevMonthPaidCount} Paid, ${prevMonthPendingCount} Pending.`);
  console.log(`  ✓ ${currentMonthStr} Bills: ${currentMonthPaidCount} Paid, ${currentMonthPendingCount} Pending.\n`);

  // 6. Create Multi-Week Ledger Entries (Cash Book & Summary Ready)
  console.log('[6/6] Seeding Cash Book ledger entries (receipts, expenses, and linked water tax payments)...');

  // 6a: Create linked system-generated receipts for every PAID bill
  for (const { bill, consumer } of paidBillsWithConsumer) {
    const houseStr = consumer.houseNumber ? ` (${consumer.houseNumber})` : '';
    await prisma.ledgerEntry.create({
      data: {
        gpId: gp.id,
        type: 'RECEIPT',
        category: 'Water tax',
        amount: bill.amountPaise,
        date: bill.paidAt || new Date(),
        mode: bill.mode || 'Cash',
        reference: bill.reference || `BILL-${bill.id.slice(0, 8).toUpperCase()}`,
        description: `Water tax bill (${bill.month}) - ${consumer.name}${houseStr}`,
        isSystem: true,
        billId: bill.id,
        createdById: adminUser.id,
      },
    });
  }
  console.log(`  ✓ ${paidBillsWithConsumer.length} System-generated "Water tax" ledger receipts created.`);

  // 6b: Manual Grants, Donations, and other receipts
  const manualReceipts = [
    {
      category: 'Grant',
      amount: 15000000, // ₹1,50,000.00
      date: new Date(Date.UTC(2026, 9, 12, 10, 0)),
      mode: 'Cheque',
      reference: 'ZP-PUN-2026-902',
      description: 'Zilla Parishad Jal Jeevan Mission Quarterly O&M Grant release',
    },
    {
      category: 'Donation',
      amount: 2500000, // ₹25,000.00
      date: new Date(Date.UTC(2026, 10, 8, 14, 30)),
      mode: 'UPI',
      reference: 'UPI/432109876543',
      description: 'Village Devotee Trust contribution towards Community Water Cooler',
    },
    {
      category: 'Other',
      amount: 850000, // ₹8,500.00
      date: new Date(Date.UTC(2026, 10, 16, 12, 0)),
      mode: 'Cash',
      reference: 'RCPT-MN-101',
      description: 'Auction proceeds from scrap cast iron pipes and worn valves',
    },
  ];

  for (const r of manualReceipts) {
    await prisma.ledgerEntry.create({
      data: {
        gpId: gp.id,
        type: 'RECEIPT',
        category: r.category,
        amount: r.amount,
        date: r.date,
        mode: r.mode,
        reference: r.reference,
        description: r.description,
        isSystem: false,
        createdById: adminUser.id,
      },
    });
  }

  // 6c: Manual Expenses across recent weeks (some linked to assets)
  const risingMainAsset = createdAssets.find((a) => a.name.includes('Rising Main'));
  const standbyPumpAsset = createdAssets.find((a) => a.name.includes('Standby Submersible'));

  const manualExpenses = [
    {
      category: 'Electricity',
      amount: 3240000, // ₹32,400.00
      date: new Date(Date.UTC(2026, 9, 24, 11, 0)),
      mode: 'UPI',
      reference: 'MSE-10-89421',
      description: 'MSEDCL Monthly Electric Bill for Water Works Pump House (Oct)',
      assetId: null,
    },
    {
      category: 'Electricity',
      amount: 3420000, // ₹34,200.00
      date: new Date(Date.UTC(2026, 10, 22, 11, 0)),
      mode: 'UPI',
      reference: 'MSE-11-90145',
      description: 'MSEDCL Monthly Electric Bill for Water Works Pump House (Nov)',
      assetId: null,
    },
    {
      category: 'Repair',
      amount: 1850000, // ₹18,500.00
      date: new Date(Date.UTC(2026, 10, 11, 15, 30)),
      mode: 'Cash',
      reference: 'VCH-REP-201',
      description: 'Emergency excavation and joint welding on Sector A Rising Main',
      assetId: risingMainAsset ? risingMainAsset.id : null,
    },
    {
      category: 'Repair',
      amount: 1450000, // ₹14,500.00
      date: new Date(Date.UTC(2026, 10, 20, 16, 0)),
      mode: 'Cheque',
      reference: 'CHQ-778892',
      description: 'Authorized service centre advance for Standby Pump motor rewinding',
      assetId: standbyPumpAsset ? standbyPumpAsset.id : null,
    },
    {
      category: 'Purchase',
      amount: 1200000, // ₹12,000.00
      date: new Date(Date.UTC(2026, 10, 14, 13, 0)),
      mode: 'Cheque',
      reference: 'CHQ-778891',
      description: 'Procurement of 5 bags Bleaching Powder and chlorine test kit',
      assetId: null,
    },
    {
      category: 'Salary',
      amount: 2400000, // ₹24,000.00
      date: new Date(Date.UTC(2026, 10, 25, 17, 0)),
      mode: 'UPI',
      reference: 'UPI/556677889900',
      description: 'Monthly O&M honorarium for Water Pump Operator and Lineman',
      assetId: null,
    },
  ];

  for (const e of manualExpenses) {
    await prisma.ledgerEntry.create({
      data: {
        gpId: gp.id,
        type: 'EXPENSE',
        category: e.category,
        amount: e.amount,
        date: e.date,
        mode: e.mode,
        reference: e.reference,
        description: e.description,
        isSystem: false,
        assetId: e.assetId,
        createdById: adminUser.id,
      },
    });
  }

  console.log(`  ✓ ${manualReceipts.length} Manual Receipts and ${manualExpenses.length} Manual Expenses created.\n`);

  // Final Summary Stats
  const totalAssetsCount = await prisma.asset.count({ where: { gpId: gp.id } });
  const faultyAssetsCount = await prisma.asset.count({ where: { gpId: gp.id, status: 'FAULTY' } });
  const repairAssetsCount = await prisma.asset.count({ where: { gpId: gp.id, status: 'UNDER_REPAIR' } });
  const totalConsumersCount = await prisma.consumer.count({ where: { gpId: gp.id } });
  const totalBillsCount = await prisma.bill.count({ where: { gpId: gp.id } });
  const totalPaidBillsCount = await prisma.bill.count({ where: { gpId: gp.id, status: 'PAID' } });
  const totalPendingBillsCount = await prisma.bill.count({ where: { gpId: gp.id, status: 'PENDING' } });
  const totalLedgerCount = await prisma.ledgerEntry.count({ where: { gpId: gp.id } });
  const totalReceiptsCount = await prisma.ledgerEntry.count({ where: { gpId: gp.id, type: 'RECEIPT' } });
  const totalExpensesCount = await prisma.ledgerEntry.count({ where: { gpId: gp.id, type: 'EXPENSE' } });

  console.log('================================================================');
  console.log('🎉 JalKosh Demo Dataset Seeded Successfully!');
  console.log('================================================================');
  console.log(`Gram Panchayat : ${gp.name} (ID: ${gp.id})`);
  console.log(`Location       : ${gp.village}, ${gp.district}, ${gp.state}`);
  console.log('----------------------------------------------------------------');
  console.log('Credentials for Demo / Testing:');
  console.log('  Admin User   : Phone 9876543210  |  Password: Admin@123');
  console.log('  Worker 1     : Phone 9876543211  |  Password: Worker@123');
  console.log('  Worker 2     : Phone 9876543212  |  Password: Worker@123');
  console.log('----------------------------------------------------------------');
  console.log('Seeded Dataset Counts:');
  console.log(`  GIS Assets   : ${totalAssetsCount} (${faultyAssetsCount} faulty, ${repairAssetsCount} under repair)`);
  console.log(`  Inventory    : ${createdInventory.length} items (${lowStockCount} below reorder level)`);
  console.log(`  Consumers    : ${totalConsumersCount} households`);
  console.log(`  Bills (2 mos): ${totalBillsCount} (${totalPaidBillsCount} paid, ${totalPendingBillsCount} pending)`);
  console.log(`  Cash Book    : ${totalLedgerCount} entries (${totalReceiptsCount} receipts, ${totalExpensesCount} expenses)`);
  console.log('================================================================\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
