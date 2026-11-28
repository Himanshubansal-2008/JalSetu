const { z } = require('zod');

// Schema for UUID route parameter
const idParamSchema = z.string().uuid({ message: 'Invalid item id' });

// Schema for creating an inventory item
const createInventoryItemSchema = z.object({
  name: z
    .string({
      required_error: 'Item name is required',
      invalid_type_error: 'Item name must be a string',
    })
    .trim()
    .min(1, 'Item name cannot be empty')
    .max(100, 'Item name cannot exceed 100 characters'),
  unit: z
    .string({
      required_error: 'Unit is required',
      invalid_type_error: 'Unit must be a string',
    })
    .trim()
    .min(1, 'Unit cannot be empty')
    .max(50, 'Unit cannot exceed 50 characters'),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .default(0)
    .optional(),
  initialQuantity: z
    .number({ invalid_type_error: 'Initial quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(0, 'Initial quantity cannot be negative')
    .optional(),
  reorderLevel: z
    .number({ invalid_type_error: 'Reorder level must be a number' })
    .int('Reorder level must be a whole number')
    .min(0, 'Reorder level cannot be negative')
    .default(0)
    .optional(),
});

// Schema for updating an inventory item
// Note: quantity is strictly NOT updatable here per requirement
const updateInventoryItemSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'Item name must be a string' })
      .trim()
      .min(1, 'Item name cannot be empty')
      .max(100, 'Item name cannot exceed 100 characters')
      .optional(),
    unit: z
      .string({ invalid_type_error: 'Unit must be a string' })
      .trim()
      .min(1, 'Unit cannot be empty')
      .max(50, 'Unit cannot exceed 50 characters')
      .optional(),
    reorderLevel: z
      .number({ invalid_type_error: 'Reorder level must be a number' })
      .int('Reorder level must be a whole number')
      .min(0, 'Reorder level cannot be negative')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const updatableKeys = ['name', 'unit', 'reorderLevel'];
    const hasAnyField = updatableKeys.some((k) => data[k] !== undefined);
    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No changes provided',
      });
    }
  });

// Schema for listing inventory items
const listInventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  lowStockOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return false;
    }),
  page: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
});

// Schema for Stock IN transaction
const stockInSchema = z.object({
  quantity: z
    .number({
      required_error: 'Quantity is required',
      invalid_type_error: 'Quantity must be a number',
    })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  note: z
    .string({ invalid_type_error: 'Note must be a string' })
    .trim()
    .max(1000, 'Note cannot exceed 1000 characters')
    .nullable()
    .optional(),
});

// Schema for Stock OUT transaction
const stockOutSchema = z.object({
  quantity: z
    .number({
      required_error: 'Quantity is required',
      invalid_type_error: 'Quantity must be a number',
    })
    .int('Quantity must be a whole number')
    .positive('Quantity must be greater than 0'),
  note: z
    .string({ invalid_type_error: 'Note must be a string' })
    .trim()
    .max(1000, 'Note cannot exceed 1000 characters')
    .nullable()
    .optional(),
  assetId: z
    .string({ invalid_type_error: 'assetId must be a string' })
    .uuid({ message: 'Invalid asset id' })
    .nullable()
    .optional(),
});

module.exports = {
  idParamSchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  listInventoryQuerySchema,
  stockInSchema,
  stockOutSchema,
};
