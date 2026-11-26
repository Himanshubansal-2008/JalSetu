const prisma = require('../prisma');
const {
  idParamSchema,
  createConsumerSchema,
  updateConsumerSchema,
} = require('../utils/consumerUtil');

/**
 * List Consumers (GET /api/consumers) - Admin only
 * Strictly scoped to req.user.gpId
 * Supports optional case-insensitive search by name or houseNumber
 * Includes pendingDuesPaise and pendingBillsCount
 * Sorted active consumers first, then by houseNumber and name
 */
async function listConsumers(req, res, next) {
  try {
    const where = {
      gpId: req.user.gpId,
    };

    const search = req.query.search;
    if (typeof search === 'string' && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { houseNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const rawConsumers = await prisma.consumer.findMany({
      where,
      include: {
        bills: {
          where: { status: 'PENDING' },
          select: { id: true, amountPaise: true },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { houseNumber: 'asc' },
        { name: 'asc' },
      ],
    });

    const consumers = rawConsumers.map((c) => {
      const pendingBills = c.bills || [];
      const pendingDuesPaise = pendingBills.reduce(
        (sum, b) => sum + (b.amountPaise || 0),
        0
      );
      const pendingBillsCount = pendingBills.length;
      const { bills, ...consumerData } = c;

      return {
        ...consumerData,
        pendingDuesPaise,
        pendingBillsCount,
      };
    });

    return res.status(200).json({
      consumers,
      total: consumers.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Consumer Detail (GET /api/consumers/:id) - Admin only
 */
async function getConsumer(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const consumer = await prisma.consumer.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
      include: {
        bills: {
          orderBy: { month: 'desc' },
        },
      },
    });

    if (!consumer) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const pendingBills = (consumer.bills || []).filter(
      (b) => b.status === 'PENDING'
    );
    const pendingDuesPaise = pendingBills.reduce(
      (sum, b) => sum + (b.amountPaise || 0),
      0
    );
    const pendingBillsCount = pendingBills.length;

    return res.status(200).json({
      consumer: {
        ...consumer,
        pendingDuesPaise,
        pendingBillsCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create Consumer (POST /api/consumers) - Admin only
 * Accepts { name, houseNumber, phone, monthlyChargePaise }
 * Validates inputs, attaches gpId from token, sets isActive = true
 */
async function createConsumer(req, res, next) {
  try {
    const parsed = createConsumerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { name, houseNumber, phone, monthlyChargePaise } = parsed.data;

    const consumer = await prisma.consumer.create({
      data: {
        gpId: req.user.gpId,
        name,
        houseNumber,
        phone,
        monthlyChargePaise,
        isActive: true,
      },
    });

    return res.status(201).json({
      consumer: {
        ...consumer,
        pendingDuesPaise: 0,
        pendingBillsCount: 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Consumer (PUT or PATCH /api/consumers/:id) - Admin only
 * Allows updating name, houseNumber, phone, monthlyChargePaise, isActive
 */
async function updateConsumer(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const bodyParsed = updateConsumerSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res
        .status(400)
        .json({ error: bodyParsed.error.issues[0].message });
    }

    // Verify consumer exists and belongs to logged-in user's gpId
    const existing = await prisma.consumer.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const updateData = {};
    const { name, houseNumber, phone, monthlyChargePaise, isActive } =
      bodyParsed.data;

    if (name !== undefined) updateData.name = name;
    if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
    if (phone !== undefined) updateData.phone = phone;
    if (monthlyChargePaise !== undefined)
      updateData.monthlyChargePaise = monthlyChargePaise;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.consumer.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Query pending dues for response completeness
    const pendingBills = await prisma.bill.findMany({
      where: { consumerId: existing.id, status: 'PENDING' },
      select: { amountPaise: true },
    });
    const pendingDuesPaise = pendingBills.reduce(
      (sum, b) => sum + (b.amountPaise || 0),
      0
    );

    return res.status(200).json({
      consumer: {
        ...updated,
        pendingDuesPaise,
        pendingBillsCount: pendingBills.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft-Deactivate Consumer (POST /api/consumers/:id/deactivate) - Admin only
 * Sets isActive = false to preserve billing history
 */
async function deactivateConsumer(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const existing = await prisma.consumer.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const updated = await prisma.consumer.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return res.status(200).json({
      consumer: updated,
      deactivated: true,
      message: 'Consumer deactivated to preserve billing history',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete or Soft-Deactivate Consumer (DELETE /api/consumers/:id) - Admin only
 * If consumer has any Bill records, soft-deactivates (isActive = false)
 * If consumer has zero bills, deletes cleanly
 */
async function deleteConsumer(req, res, next) {
  try {
    const idParsed = idParamSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: idParsed.error.issues[0].message });
    }

    const existing = await prisma.consumer.findFirst({
      where: {
        id: req.params.id,
        gpId: req.user.gpId,
      },
      include: {
        _count: {
          select: { bills: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const billCount = existing._count?.bills ?? 0;

    if (billCount > 0) {
      // Deactivate to preserve billing history
      const updated = await prisma.consumer.update({
        where: { id: existing.id },
        data: { isActive: false },
      });

      return res.status(200).json({
        consumer: updated,
        deactivated: true,
        message: 'Consumer deactivated to preserve billing history',
      });
    }

    // Zero bills: clean hard delete
    await prisma.consumer.delete({
      where: { id: existing.id },
    });

    const { _count, ...consumerData } = existing;
    return res.status(200).json({
      consumer: consumerData,
      deleted: true,
      message: 'Consumer deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConsumers,
  getConsumer,
  createConsumer,
  updateConsumer,
  deactivateConsumer,
  deleteConsumer,
};
