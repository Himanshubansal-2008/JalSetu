const { z } = require('zod');

// Strict YYYY-MM pattern matching months 01 to 12
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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

module.exports = {
  MONTH_REGEX,
  generateBillsSchema,
};
