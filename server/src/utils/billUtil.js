const { z } = require('zod');
const { PAYMENT_MODES, normalizeDateToUtcMidnight, getIstMonthBounds } = require('./financeUtil');

// Strict YYYY-MM pattern matching months 01 to 12
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// Schema for UUID route parameter
const idParamSchema = z.string().uuid({ message: 'Invalid bill id' });

// Schema for Generate Monthly Bills (POST /api/bills/generate)
const generateBillsSchema = z
  .object({
    month: z
      .string({
        invalid_type_error: 'month must be a string',
      })
      .trim()
      .regex(MONTH_REGEX, 'month must be in YYYY-MM format (e.g. 2026-11)')
      .optional()
      .nullable(),
  })
  .strict();

// Schema for Pay Bill (POST /api/bills/:id/pay)
const payBillSchema = z
  .object({
    mode: z.enum(PAYMENT_MODES, {
      errorMap: () => ({
        message: `Mode must be one of: ${PAYMENT_MODES.join(', ')}`,
      }),
    }),
    reference: z
      .string({ invalid_type_error: 'reference must be a string' })
      .trim()
      .max(100, 'reference cannot exceed 100 characters')
      .optional()
      .nullable(),
    paidAt: z
      .union([z.string(), z.date()])
      .optional()
      .nullable()
      .refine(
        (val) => {
          if (!val) return true;
          return normalizeDateToUtcMidnight(val) !== null;
        },
        { message: 'paidAt must be a valid date in YYYY-MM-DD or ISO format' }
      ),
  })
  .strict();

// Schema for List Bills Query (GET /api/bills)
const listBillsQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(MONTH_REGEX, 'month must be in YYYY-MM format')
    .optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
});

// Schema for Dues Summary Query (GET /api/bills/summary)
const duesSummaryQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(MONTH_REGEX, 'month must be in YYYY-MM format')
    .optional(),
});

// Schema for Edit Pending Bill (PATCH /api/bills/:id)
const editBillSchema = z
  .object({
    amountPaise: z
      .number({ invalid_type_error: 'amountPaise must be an integer' })
      .int('amountPaise must be an integer')
      .positive('amountPaise must be greater than 0')
      .optional(),
    notes: z
      .string({ invalid_type_error: 'notes must be a string' })
      .trim()
      .max(500, 'notes cannot exceed 500 characters')
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) => data.amountPaise !== undefined || data.notes !== undefined,
    { message: 'At least one of amountPaise or notes must be provided' }
  );

// Schema for Cancel / Waive Pending Bill (POST /api/bills/:id/cancel & waive)
const cancelWaiveBillSchema = z
  .object({
    reason: z
      .string({ invalid_type_error: 'reason must be a string' })
      .trim()
      .max(500, 'reason cannot exceed 500 characters')
      .optional()
      .nullable(),
    notes: z
      .string({ invalid_type_error: 'notes must be a string' })
      .trim()
      .max(500, 'notes cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .strict();

module.exports = {
  MONTH_REGEX,
  PAYMENT_MODES,
  idParamSchema,
  generateBillsSchema,
  payBillSchema,
  listBillsQuerySchema,
  duesSummaryQuerySchema,
  editBillSchema,
  cancelWaiveBillSchema,
  normalizeDateToUtcMidnight,
  getIstMonthBounds,
};
