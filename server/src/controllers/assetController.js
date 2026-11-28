const { z } = require('zod');
const prisma = require('../prisma');
const {
  createAssetSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
  createAssetEventSchema,
  sanitizeAttributes,
} = require('../utils/assetUtil');

// Validation schema for UUID route params
const idParamSchema = z.string().uuid();

// Reusable select fields for Asset
const assetSelectStandard = {
  id: true,
  gpId: true,
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
  photo: true,
  createdAt: true,
};

// Create a new asset
async function createAsset(req, res, next) {
  try {
    // 1. Validate request body
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const resolvedPhoto =
      parsed.data.photoUrl !== undefined
        ? parsed.data.photoUrl
        : (parsed.data.photo !== undefined ? parsed.data.photo : null);

    const assetData = {
      ...parsed.data,
      photo: resolvedPhoto,
      gpId: req.user.gpId,
    };
    delete assetData.photoUrl;

    // 2. Insert into database (gpId comes strictly from authenticated user)
    const asset = await prisma.asset.create({
      data: assetData,
      select: assetSelectStandard,
    });

    const { photo, ...cleanAsset } = asset;
    return res.status(201).json({
      asset: {
        ...cleanAsset,
        photoUrl: photo || null,
      },
    });
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

    // 3. Query assets and total count in transaction
    const [rawAssets, total] = await prisma.$transaction([
      prisma.asset.findMany({
        where,
        select: assetSelectStandard,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    const assets = rawAssets.map((a) => {
      const { photo, ...cleanA } = a;
      return {
        ...cleanA,
        photoUrl: photo || null,
      };
    });

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

    // 2. Fetch asset belonging to authenticated user's Gram Panchayat and linked expenses
    const [asset, rawExpenses] = await Promise.all([
      prisma.asset.findFirst({
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
              photo: true,
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
      }),
      prisma.ledgerEntry.findMany({
        where: {
          assetId: id,
          gpId: req.user.gpId,
          type: 'EXPENSE',
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          category: true,
          amount: true,
          date: true,
          mode: true,
          description: true,
        },
      }),
    ]);

    // 3. Return 404 if not found or belongs to another GP
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 4. Return asset including events history with photoUrl, timestamp, authorName
    const events = asset.events.map((e) => ({
      ...e,
      photoUrl: e.photo,
      timestamp: e.createdAt,
      authorName: e.createdBy ? e.createdBy.name : null,
    }));

    // 5. Compute total expenses and repair cost
    let totalSpentPaise = 0;
    let totalRepairCostPaise = 0;

    const expenses = rawExpenses.map((e) => {
      const amountPaise = e.amount;
      totalSpentPaise += amountPaise;
      if (e.category === 'Repair' || e.category?.toLowerCase() === 'repair') {
        totalRepairCostPaise += amountPaise;
      }
      return {
        id: e.id,
        category: e.category,
        amountPaise,
        date: e.date,
        mode: e.mode,
        description: e.description,
      };
    });

    const { photo, ...cleanAsset } = asset;
    return res.status(200).json({
      asset: {
        ...cleanAsset,
        photoUrl: photo || null,
        latitude: asset.lat,
        longitude: asset.lng,
        events,
        expenses,
        totalSpentPaise,
        totalRepairCostPaise,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Update an existing asset and record status change history if status changes
async function updateAsset(req, res, next) {
  try {
    // 1. Validate id as UUID
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const { id } = req.params;

    // 2. Validate request body
    const parsed = updateAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    // 3. Load existing asset belonging to user's GP
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 4. Type rule: if type is included and differs, reject
    if (parsed.data.type !== undefined && parsed.data.type !== existingAsset.type) {
      return res.status(400).json({ error: 'Asset type cannot be changed' });
    }

    // 5. Build update data from present fields only
    const updateData = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.lat !== undefined) updateData.lat = parsed.data.lat;
    if (parsed.data.lng !== undefined) updateData.lng = parsed.data.lng;
    if (parsed.data.installDate !== undefined) updateData.installDate = parsed.data.installDate;
    if (parsed.data.warrantyExpiry !== undefined) updateData.warrantyExpiry = parsed.data.warrantyExpiry;
    if (parsed.data.cost !== undefined) updateData.cost = parsed.data.cost;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.photoUrl !== undefined) {
      updateData.photo = parsed.data.photoUrl;
    } else if (parsed.data.photo !== undefined) {
      updateData.photo = parsed.data.photo;
    }

    if (parsed.data.attributes !== undefined) {
      if (parsed.data.attributes === null) {
        updateData.attributes = null;
      } else {
        updateData.attributes = sanitizeAttributes(existingAsset.type, parsed.data.attributes);
      }
    }

    // 6. Check if status actually changed
    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existingAsset.status;

    let eventNote = null;
    if (statusChanged) {
      eventNote = `Status changed from ${existingAsset.status} to ${parsed.data.status}`;
      if (parsed.data.statusNote) {
        eventNote += `: ${parsed.data.statusNote}`;
      }
    }

    // 7. Execute update and optional history entry in a single transaction
    const [updatedAsset] = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({
        where: { id: existingAsset.id },
        data: updateData,
        select: assetSelectStandard,
      });

      if (statusChanged) {
        await tx.assetEvent.create({
          data: {
            assetId: existingAsset.id,
            createdById: req.user.id,
            kind: 'STATUS_CHANGE',
            note: eventNote,
          },
        });
      }

      return [asset];
    });

    const { photo, ...cleanUpdated } = updatedAsset;
    return res.status(200).json({
      asset: {
        ...cleanUpdated,
        photoUrl: photo || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Delete an asset (admin only, blocks if linked ledger or stock usage exists)
async function deleteAsset(req, res, next) {
  try {
    // 1. Validate id as UUID
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const { id } = req.params;

    // 2. Find asset scoped to user's GP
    const asset = await prisma.asset.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 3. Safety check: count linked financial ledger entries and stock transactions scoped to user's GP
    const [ledgerCount, stockCount] = await Promise.all([
      prisma.ledgerEntry.count({
        where: {
          assetId: id,
          gpId: req.user.gpId,
          voided: false,
        },
      }),
      prisma.stockTxn.count({
        where: {
          assetId: id,
          item: { gpId: req.user.gpId },
        },
      }),
    ]);

    if (ledgerCount > 0 || stockCount > 0) {
      return res.status(409).json({
        error:
          'This asset has linked expenses or stock usage and cannot be deleted. Change its status instead.',
      });
    }

    // 4. Delete asset scoped by gpId (history events cascade delete)
    await prisma.asset.deleteMany({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    return res.status(200).json({ message: 'Asset deleted' });
  } catch (err) {
    next(err);
  }
}

// Add a history event (repair, inspection, note) to an asset
async function addAssetEvent(req, res, next) {
  try {
    // 1. Validate asset id as UUID
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const { id } = req.params;

    // 2. Validate request body
    const parsed = createAssetEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    // 3. Verify target asset exists and belongs to logged-in user's GP
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        gpId: req.user.gpId,
      },
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // 4. Resolve normalized kind and photo
    const normalizedKind = parsed.data.kind.toUpperCase();
    const photo = parsed.data.photoUrl || parsed.data.photo || null;

    // 5. Create event in database
    const event = await prisma.assetEvent.create({
      data: {
        assetId: existingAsset.id,
        createdById: req.user.id,
        kind: normalizedKind,
        note: parsed.data.note,
        photo,
      },
      select: {
        id: true,
        assetId: true,
        createdById: true,
        kind: true,
        note: true,
        photo: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const { photo, ...cleanEvent } = event;
    return res.status(201).json({
      event: {
        ...cleanEvent,
        photoUrl: photo,
        timestamp: event.createdAt,
        authorName: event.createdBy ? event.createdBy.name : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAsset,
  listAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  addAssetEvent,
};
