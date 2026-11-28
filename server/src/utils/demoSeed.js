/**
 * demoSeed.js
 * Extracted idempotent seeding logic for demo Gram Panchayat dataset.
 * Reusable by server/prisma/seed.js and POST /api/auth/demo-login.
 */

const bcrypt = require('bcryptjs');
const { getMainAdminPassword, generateDummyPassword } = require('./credentials');

const MAIN_ADMIN_GP = {
  name: 'Platform Administration (HQ)',
  village: 'Central Headquarters',
  block: 'Central',
  district: 'Pune',
  state: 'Maharashtra',
  upiId: 'jalsetu-hq@upi',
  openingBalance: 0,
  isApproved: true,
};

const DEMO_GP = {
  name: 'Gram Panchayat Shirur',
  village: 'Shirur',
  block: 'Shirur',
  district: 'Pune',
  state: 'Maharashtra',
  upiId: 'shirurgp@upi',
  openingBalance: 5000000, // ₹50,000.00
  isApproved: true,
};

const DEMO_USERS = [
  {
    name: 'Sarpanch Ramesh Patil',
    phone: '9876543210',
    role: 'ADMIN',
  },
  {
    name: 'Vikas Shinde (Operator)',
    phone: '9876543211',
    role: 'WORKER',
  },
  {
    name: 'Sunil More (Lineman)',
    phone: '9876543212',
    role: 'WORKER',
  },
];

const DEMO_ASSETS = [
  {
    name: 'Main Borewell Source #1',
    type: 'SOURCE',
    status: 'WORKING',
    lat: 18.8245,
    lng: 74.3789,
    cost: 18000000,
    attributes: { depthMeters: 120, yieldLph: 15000, casingType: 'MS' },
    notes: 'Primary deep groundwater extraction source with good recharge.',
  },
  {
    name: 'River Infiltration Well',
    type: 'SOURCE',
    status: 'WORKING',
    lat: 18.8312,
    lng: 74.3854,
    cost: 35000000,
    attributes: { diameterMeters: 6, depthMeters: 14, source: 'Ghod River basin' },
    notes: 'Jackwell intake feeding the water treatment plant.',
  },
  {
    name: 'High-Head Submersible Pump #1',
    type: 'PUMP',
    status: 'WORKING',
    lat: 18.8248,
    lng: 74.3792,
    cost: 8500000,
    attributes: { hp: 10, dischargeLps: 25, headMeters: 80, phase: 3 },
    notes: 'Installed inside Main Borewell Source #1.',
  },
  {
    name: 'Booster Pump Station #2 (Ward 2)',
    type: 'PUMP',
    status: 'FAULTY',
    lat: 18.8214,
    lng: 74.3731,
    cost: 6500000,
    attributes: { hp: 7.5, dischargeLps: 18, issue: 'Drive bearing vibration and high temp' },
    notes: 'Reported faulty during morning pumping cycle. Needs bearing overhaul.',
  },
  {
    name: 'Standby Submersible Pump #3',
    type: 'PUMP',
    status: 'UNDER_REPAIR',
    lat: 18.8291,
    lng: 74.3815,
    cost: 6500000,
    attributes: { hp: 7.5, dischargeLps: 18, repairStage: 'Stator rewinding' },
    notes: 'Dispatched to authorized service centre in Pune for rewinding.',
  },
  {
    name: 'Elevated Storage Reservoir (OHT-1)',
    type: 'TANK',
    status: 'WORKING',
    lat: 18.8267,
    lng: 74.3755,
    cost: 45000000,
    attributes: { capacityL: 100000, stagingMeters: 15, material: 'RCC' },
    notes: 'Primary overhead tank supplying Sector A and central bazaar.',
  },
  {
    name: 'Ground Level Service Reservoir (GLSR-2)',
    type: 'TANK',
    status: 'WORKING',
    lat: 18.8305,
    lng: 74.3842,
    cost: 28000000,
    attributes: { capacityL: 75000, material: 'RCC', chlorinationChamber: true },
    notes: 'Receives water from river intake; acts as clean water sump.',
  },
  {
    name: 'Main Transmission Rising Main (150mm DI)',
    type: 'PIPELINE',
    status: 'WORKING',
    lat: 18.8285,
    lng: 74.3802,
    cost: 32000000,
    attributes: { diameterMm: 150, lengthMeters: 1200, material: 'Ductile Iron K9' },
    notes: 'Main header pipeline from pump station to OHT-1.',
  },
  {
    name: 'Ward 1 Distribution Pipeline (90mm HDPE)',
    type: 'PIPELINE',
    status: 'UNDER_REPAIR',
    lat: 18.8228,
    lng: 74.3718,
    cost: 14000000,
    attributes: { diameterMm: 90, lengthMeters: 850, material: 'HDPE PE100' },
    notes: 'Minor joint blowout near house H-108. Lineman fixing with electrofusion coupler.',
  },
  {
    name: 'Ward 2 Distribution Pipeline (75mm PVC)',
    type: 'PIPELINE',
    status: 'WORKING',
    lat: 18.8198,
    lng: 74.3695,
    cost: 9500000,
    attributes: { diameterMm: 75, lengthMeters: 650, material: 'PVC Class 3' },
    notes: 'Supplies South Ward household tap connections.',
  },
  {
    name: 'Sluice Isolation Valve - Sector A',
    type: 'VALVE',
    status: 'WORKING',
    lat: 18.8258,
    lng: 74.3742,
    cost: 120000,
    attributes: { sizeMm: 100, type: 'Resilient seated gate valve' },
    notes: 'Controls gravity feed into Sector A residential zone.',
  },
  {
    name: 'Air Release Valve - High Ridge',
    type: 'VALVE',
    status: 'FAULTY',
    lat: 18.8272,
    lng: 74.3768,
    cost: 85000,
    attributes: { sizeMm: 50, type: 'Kinetic double orifice' },
    notes: 'Float mechanism leaking air/water during high pressure surge.',
  },
  {
    name: 'Rapid Sand Filter & Chlorination Unit',
    type: 'TREATMENT_PLANT',
    status: 'WORKING',
    lat: 18.8308,
    lng: 74.3848,
    cost: 22000000,
    attributes: { capacityMld: 0.5, dosingType: 'Gas/Sodium Hypochlorite', media: 'Silica sand' },
    notes: 'Water treatment filtration and residual chlorine disinfection unit.',
  },
  {
    name: 'Public Standpost #1 - Main Chowk',
    type: 'STANDPOST',
    status: 'WORKING',
    lat: 18.8239,
    lng: 74.3749,
    cost: 65000,
    attributes: { taps: 4, platformType: 'Concrete with soak pit' },
    notes: 'Community drinking water post near village panchayat bhavan.',
  },
  {
    name: 'Public Standpost #2 - ZP Primary School',
    type: 'STANDPOST',
    status: 'WORKING',
    lat: 18.8211,
    lng: 74.3776,
    cost: 65000,
    attributes: { taps: 2, platformType: 'Concrete apron with drainage' },
    notes: 'Dedicated drinking water facility for primary school students.',
  },
];

const DEMO_INVENTORY = [
  {
    name: 'Bleaching Powder (Grade 1)',
    unit: 'kg',
    quantity: 15,
    reorderLevel: 25,
  },
  {
    name: 'Gate Valve Rubber Seals (100mm)',
    unit: 'piece',
    quantity: 2,
    reorderLevel: 5,
  },
  {
    name: 'Chlorine Disinfection Tablets',
    unit: 'piece',
    quantity: 500,
    reorderLevel: 100,
  },
  {
    name: 'PVC Pipe Joints (90mm Couplers)',
    unit: 'piece',
    quantity: 45,
    reorderLevel: 15,
  },
  {
    name: 'Submersible Pump Spare Impellers (10HP)',
    unit: 'piece',
    quantity: 8,
    reorderLevel: 3,
  },
  {
    name: 'Digital Pressure Gauge (0-10 Bar)',
    unit: 'piece',
    quantity: 6,
    reorderLevel: 2,
  },
  {
    name: 'Heavy Duty Bearing Grease',
    unit: 'kg',
    quantity: 18,
    reorderLevel: 5,
  },
  {
    name: 'Filter Silica Sand (0.5-1.0mm)',
    unit: 'kg',
    quantity: 250,
    reorderLevel: 80,
  },
];

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

/**
 * Checks if the Demo Gram Panchayat exists and has populated records.
 */
async function isDemoGpSeeded(prisma) {
  const gp = await prisma.gramPanchayat.findFirst({
    where: { name: DEMO_GP.name },
    include: {
      _count: {
        select: {
          users: true,
          assets: true,
          consumers: true,
          bills: true,
          items: true,
        },
      },
    },
  });

  if (!gp) return false;
  const counts = gp._count;
  return (
    counts.users >= 3 &&
    counts.assets >= 10 &&
    counts.consumers >= 10 &&
    counts.bills >= 10 &&
    counts.items >= 5
  );
}

/**
 * Seeds or resets the Demo Gram Panchayat dataset idempotently.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ forceReset?: boolean }} [options]
 * @returns {Promise<{ gp: any, adminUser: any, workerUser: any }>}
 */
async function seedDemoGp(prisma, options = {}) {
  const { forceReset = false } = options;

  let existingGp = await prisma.gramPanchayat.findFirst({
    where: { name: DEMO_GP.name },
  });

  // If already seeded and not force resetting, retrieve users and return immediately
  if (existingGp && !forceReset) {
    const isSeeded = await isDemoGpSeeded(prisma);
    if (isSeeded) {
      const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();

      const admin = await prisma.user.findFirst({
        where: {
          gpId: existingGp.id,
          phone: { not: mainAdminPhone },
          role: 'ADMIN',
          isActive: true,
        },
      });
      const worker = await prisma.user.findFirst({
        where: { gpId: existingGp.id, role: 'WORKER', isActive: true },
      });

      let hqGp = await prisma.gramPanchayat.findFirst({ where: { name: MAIN_ADMIN_GP.name } });
      if (!hqGp) {
        hqGp = await prisma.gramPanchayat.create({ data: MAIN_ADMIN_GP });
      }

      let mainAdmin = await prisma.user.findUnique({
        where: { phone: mainAdminPhone },
        include: { gp: true },
      });

      if (!mainAdmin) {
        const mainAdminPassword = getMainAdminPassword();
        const hashedPassword = await bcrypt.hash(mainAdminPassword, 10);
        mainAdmin = await prisma.user.create({
          data: {
            gpId: hqGp.id,
            name: 'Main Administrator',
            phone: mainAdminPhone,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          },
          include: { gp: true },
        });
      } else if (mainAdmin.gpId !== hqGp.id) {
        mainAdmin = await prisma.user.update({
          where: { id: mainAdmin.id },
          data: { gpId: hqGp.id, role: 'ADMIN', isActive: true },
          include: { gp: true },
        });
      }

      if (admin && worker && mainAdmin) {
        return { gp: existingGp, adminUser: admin, workerUser: worker, mainAdminUser: mainAdmin };
      }
    }
  }

  // Clean existing demo records in strict dependency order
  if (existingGp) {
    await prisma.ledgerEntry.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.bill.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.consumer.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.stockTxn.deleteMany({ where: { item: { gpId: existingGp.id } } });
    await prisma.inventoryItem.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.assetEvent.deleteMany({ where: { asset: { gpId: existingGp.id } } });
    await prisma.asset.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.user.deleteMany({ where: { gpId: existingGp.id } });
    await prisma.gramPanchayat.delete({ where: { id: existingGp.id } });
  }

  // Ensure demo user phones are cleaned up
  const demoPhones = DEMO_USERS.map((u) => u.phone);
  await prisma.user.deleteMany({ where: { phone: { in: demoPhones } } });

  // 1. Create Gram Panchayat
  const gp = await prisma.gramPanchayat.create({
    data: DEMO_GP,
  });

  // 2. Create Users
  const userMap = {};
  for (const u of DEMO_USERS) {
    const dummyPassword = generateDummyPassword();
    const hashedPassword = await bcrypt.hash(dummyPassword, 10);
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
    if (!userMap[u.role]) {
      userMap[u.role] = createdUser;
    }
  }
  const adminUser = userMap.ADMIN;
  const workerUser = userMap.WORKER;

  // Ensure Main Admin exists under Platform Administration (HQ) GP - strictly isolated from demo GP
  let mainAdminGp = await prisma.gramPanchayat.findFirst({
    where: { name: MAIN_ADMIN_GP.name },
  });
  if (!mainAdminGp) {
    mainAdminGp = await prisma.gramPanchayat.create({
      data: MAIN_ADMIN_GP,
    });
  }

  const mainAdminPhone = (process.env.MAIN_ADMIN_PHONE || '9992934154').trim();
  let mainAdminUser = await prisma.user.findUnique({
    where: { phone: mainAdminPhone },
    include: { gp: true },
  });

  const mainAdminPassword = getMainAdminPassword();
  const mainAdminHashedPassword = await bcrypt.hash(mainAdminPassword, 10);
  if (!mainAdminUser) {
    mainAdminUser = await prisma.user.create({
      data: {
        gpId: mainAdminGp.id,
        name: 'Main Administrator',
        phone: mainAdminPhone,
        password: mainAdminHashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
      include: { gp: true },
    });
  } else {
    mainAdminUser = await prisma.user.update({
      where: { id: mainAdminUser.id },
      data: {
        gpId: mainAdminGp.id,
        role: 'ADMIN',
        isActive: true,
      },
      include: { gp: true },
    });
  }

  // 3. Create ~15 GIS Assets & Events
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

  // 4. Create Inventory Items (2 below reorder level)
  for (const itemDef of DEMO_INVENTORY) {
    await prisma.inventoryItem.create({
      data: {
        gpId: gp.id,
        name: itemDef.name,
        unit: itemDef.unit,
        quantity: itemDef.quantity,
        reorderLevel: itemDef.reorderLevel,
      },
    });
  }

  // 5. Create Consumers and Bills
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthNum = now.getUTCMonth() + 1;
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const prevDate = new Date(Date.UTC(currentYear, currentMonthNum - 2, 1));
  const prevMonthStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

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

  const paidBillsWithConsumer = [];
  // Previous month bills (16 paid, 4 pending)
  for (let i = 0; i < createdConsumers.length; i++) {
    const consumer = createdConsumers[i];
    const isPaid = i < 16;
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
      paidBillsWithConsumer.push({ bill, consumer });
    }
  }

  // Current month bills (10 paid, 10 pending)
  for (let i = 0; i < createdConsumers.length; i++) {
    const consumer = createdConsumers[i];
    const isPaid = i < 10;
    const modes = ['Cash', 'UPI', 'Cheque'];
    const selectedMode = modes[(i + 1) % 3];
    const paidDay = Math.min(26, 3 + (i % 18));
    const paidDate = new Date(Date.UTC(2026, 10, paidDay, 11 + (i % 6), 30));
    const reference =
      selectedMode === 'Cash'
        ? `REC-${currentMonthStr.replace('-', '')}-${201 + i}`
        : selectedMode === 'UPI'
        ? `UPI/${currentMonthStr.replace('-', '')}88${100 + i}`
        : `CHQ-50${100 + i}`;

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
      paidBillsWithConsumer.push({ bill, consumer });
    }
  }

  // 6. Create Ledger Entries
  // System-generated receipt entries for paid bills
  for (const { bill, consumer } of paidBillsWithConsumer) {
    await prisma.ledgerEntry.create({
      data: {
        gpId: gp.id,
        type: 'RECEIPT',
        category: 'Water Tax',
        amount: bill.amountPaise,
        date: bill.paidAt,
        mode: bill.mode || 'Cash',
        reference: bill.reference,
        description: `Water tax collection - Consumer ${consumer.name} (${consumer.houseNumber}) for ${bill.month}`,
        isSystem: true,
        billId: bill.id,
        createdById: adminUser.id,
      },
    });
  }

  // Manual receipts
  const manualReceipts = [
    {
      category: 'Grant',
      amount: 15000000,
      date: new Date(Date.UTC(2026, 9, 15, 11, 0)),
      mode: 'Bank Transfer',
      reference: 'TXN-GOV-2026-8891',
      description: 'Zilla Parishad Pune - 15th Finance Commission untied basic water supply grant',
    },
    {
      category: 'Donation',
      amount: 2500000,
      date: new Date(Date.UTC(2026, 10, 4, 14, 30)),
      mode: 'Cheque',
      reference: 'CHQ-889912',
      description: 'Shirur Village Youth Welfare Trust CSR donation for solar borewell maintenance',
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

  // Manual expenses
  const risingMainAsset = createdAssets.find((a) => a.name.includes('Rising Main'));
  const standbyPumpAsset = createdAssets.find((a) => a.name.includes('Standby'));

  const manualExpenses = [
    {
      category: 'Electricity',
      amount: 3850000,
      date: new Date(Date.UTC(2026, 9, 28, 12, 0)),
      mode: 'Bank Transfer',
      reference: 'MSEDCL-OCT-44120',
      description: 'MSEDCL high-tension power tariff for Main Pump House & booster stations',
      assetId: null,
    },
    {
      category: 'Repair',
      amount: 1850000,
      date: new Date(Date.UTC(2026, 10, 11, 15, 30)),
      mode: 'Cash',
      reference: 'VCH-REP-201',
      description: 'Emergency excavation and joint welding on Sector A Rising Main',
      assetId: risingMainAsset ? risingMainAsset.id : null,
    },
    {
      category: 'Repair',
      amount: 1450000,
      date: new Date(Date.UTC(2026, 10, 20, 16, 0)),
      mode: 'Cheque',
      reference: 'CHQ-778892',
      description: 'Authorized service centre advance for Standby Pump motor rewinding',
      assetId: standbyPumpAsset ? standbyPumpAsset.id : null,
    },
    {
      category: 'Purchase',
      amount: 1200000,
      date: new Date(Date.UTC(2026, 10, 14, 13, 0)),
      mode: 'Cheque',
      reference: 'CHQ-778891',
      description: 'Procurement of 5 bags Bleaching Powder and chlorine test kit',
      assetId: null,
    },
    {
      category: 'Salary',
      amount: 2400000,
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

  return { gp, adminUser, workerUser, mainAdminUser };
}

module.exports = {
  DEMO_GP,
  DEMO_USERS,
  DEMO_ASSETS,
  DEMO_INVENTORY,
  DEMO_CONSUMERS,
  isDemoGpSeeded,
  seedDemoGp,
};
