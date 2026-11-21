const prisma = require('../prisma');
const { createAssetSchema, listAssetsQuerySchema } = require('../utils/assetUtil');

// Create a new asset
async function createAsset(req, res, next) {
  try {
    // 1. Validate request body
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    // 2. Insert into database (gpId comes strictly from authenticated user)
    const asset = await prisma.asset.create({
      data: {
        ...parsed.data,
        gpId: req.user.gpId,
      },
    });

    return res.status(201).json({ asset });
  } catch (err) {
    next(err);
  }
}

// List assets with filtering and pagination
async function listAssets(req, res, next) {
  try {
    // 1. Validate query parameters
    const parsed = listAssetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { type, status, search, page, limit } = parsed.data;

    // 2. Build where filter (gpId always enforced)
    const where = {
      gpId: req.user.gpId,
    };

    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Explicit select excluding photo for a lighter response
    const select = {
      id: true,
      name: true,
      type: true,
      status: true,
      lat: true,
      lng: true,
      installDate: true,
      cost: true,
      warrantyExpiry: true,
      attributes: true,
      notes: true,
      createdAt: true,
    };

    // 3. Query assets and total count in transaction
    const [assets, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return res.status(200).json({
      assets,
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAsset,
  listAssets,
};
