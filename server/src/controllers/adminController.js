const prisma = require('../prisma');
const { seedDemoGp } = require('../utils/demoSeed');

/**
 * Reset the demo Gram Panchayat dataset.
 * POST /api/admin/demo/reset (Main Admin only)
 */
async function resetDemoData(req, res, next) {
  try {
    const { gp } = await seedDemoGp(prisma, { forceReset: true });

    return res.status(200).json({
      message: 'Demo Gram Panchayat dataset has been reset successfully to clean initial state.',
      gp: {
        id: gp.id,
        name: gp.name,
        village: gp.village,
        district: gp.district,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  resetDemoData,
};
