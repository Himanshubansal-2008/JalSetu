const { z } = require('zod');
const prisma = require('../prisma');
const { createAssetSchema, listAssetsQuerySchema } = require('../utils/assetUtil');

// Validation schema for UUID route params
const idParamSchema = z.string().uuid();

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

// Get a single asset with history events
async function getAsset(req, res, next) {
  try {
    // 1. Validate id as UUID
    const parsed = idParamSchema.safeParse(req.params.id);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const { id } = req.params;

    // 2. Fetch asset belonging to authenticated user's Gram Panchayat
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
      include: {
        events: {
          select: {
            id: true,
            kind: true,
            note: true,
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    // 3. Return 404 if not found or belongs to another GP
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 4. Return asset including events history
    return res.status(200).json({ asset });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAsset,
  listAssets,
  getAsset,
};
