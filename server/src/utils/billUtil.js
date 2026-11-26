const { z } = require('zod');
const { PAYMENT_MODES, normalizeDateToUtcMidnight } = require('./financeUtil');

// Strict YYYY-MM pattern matching months 01 to 12
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// Schema for UUID route parameter
const idParamSchema = z.string().uuid({ message: 'Invalid bill id' });

// Schema for Generate Monthly Bills (POST /api/bills/generate)
const generateBillsSchema = z
  .object({
    month: z
      .string({
        required_error: 'month is required',
        invalid_type_error: 'month must be a string',
      })
      .trim()
      .regex(MONTH_REGEX, 'month must be in YYYY-MM format (e.g. 2026-11)'),
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

module.exports = {
  MONTH_REGEX,
  PAYMENT_MODES,
  idParamSchema,
  generateBillsSchema,
  payBillSchema,
  normalizeDateToUtcMidnight,
};
