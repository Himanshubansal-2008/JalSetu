const { z } = require('zod');

// Schema for UUID route parameter
const idParamSchema = z.string().uuid({ message: 'Invalid entry id' });

// Allowed categories
const RECEIPT_CATEGORIES = ['Grant', 'Water tax', 'Donation', 'Other'];
const EXPENSE_CATEGORIES = [
  'Repair',
  'Purchase',
  'Electricity',
  'Salary',
  'Other',
];

// Allowed payment modes
const PAYMENT_MODES = ['Cash', 'UPI', 'Cheque'];

/**
 * Normalizes a date string ("YYYY-MM-DD" or ISO) to UTC midnight:
 * new Date(`${dateOnly}T00:00:00.000Z`)
 */
function normalizeDateToUtcMidnight(val) {
  if (!val) return null;
  let dateOnly = '';
  if (typeof val === 'string') {
    dateOnly = val.slice(0, 10);
  } else if (val instanceof Date) {
    const year = val.getUTCFullYear();
    const month = String(val.getUTCMonth() + 1).padStart(2, '0');
    const day = String(val.getUTCDate()).padStart(2, '0');
    dateOnly = `${year}-${month}-${day}`;
  } else {
    return null;
  }

  // Validate YYYY-MM-DD pattern
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }

  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  if (isNaN(d.getTime())) {
    return null;
  }
  return d;
}

/**
 * Normalizes an end date string ("YYYY-MM-DD" or ISO) to UTC end-of-day:
 * new Date(`${dateOnly}T23:59:59.999Z`)
 */
function normalizeDateToEndOfDay(val) {
  if (!val) return null;
  let dateOnly = '';
  if (typeof val === 'string') {
    dateOnly = val.slice(0, 10);
  } else if (val instanceof Date) {
    const year = val.getUTCFullYear();
    const month = String(val.getUTCMonth() + 1).padStart(2, '0');
    const day = String(val.getUTCDate()).padStart(2, '0');
    dateOnly = `${year}-${month}-${day}`;
  } else {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }

  const d = new Date(`${dateOnly}T23:59:59.999Z`);
  if (isNaN(d.getTime())) {
    return null;
  }
  return d;
}

// Zod custom validator for UTC midnight date
const dateSchema = z
  .string({
    required_error: 'Date is required',
    invalid_type_error: 'Date must be a string',
  })
  .trim()
  .min(1, 'Date is required')
  .refine((val) => normalizeDateToUtcMidnight(val) !== null, {
    message: 'Invalid date format (must be YYYY-MM-DD or ISO date)',
  })
  .transform((val) => normalizeDateToUtcMidnight(val));

// Schema for Add Receipt (POST /api/finance/receipts)
const createReceiptSchema = z
  .object({
    category: z.enum(RECEIPT_CATEGORIES, {
      errorMap: () => ({
        message: `Category must be one of: ${RECEIPT_CATEGORIES.join(', ')}`,
      }),
    }),
    amountPaise: z
      .number({
        required_error: 'amountPaise is required',
        invalid_type_error: 'amountPaise must be an integer',
      })
      .refine(
        (val) => Number.isInteger(val) && val > 0,
        'amountPaise must be a positive integer greater than 0'
      ),
    date: dateSchema,
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
    description: z
      .string({ invalid_type_error: 'description must be a string' })
      .trim()
      .max(500, 'description cannot exceed 500 characters')
      .optional()
      .nullable(),
  })
  .strict();

// Schema for Add Expense (POST /api/finance/expenses)
const createExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES, {
      errorMap: () => ({
        message: `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`,
      }),
    }),
    amountPaise: z
      .number({
        required_error: 'amountPaise is required',
        invalid_type_error: 'amountPaise must be an integer',
      })
      .refine(
        (val) => Number.isInteger(val) && val > 0,
        'amountPaise must be a positive integer greater than 0'
      ),
    date: dateSchema,
    mode: z.enum(PAYMENT_MODES, {
      errorMap: () => ({
        message: `Mode must be one of: ${PAYMENT_MODES.join(', ')}`,
      }),
    }),
    description: z
      .string({ invalid_type_error: 'description must be a string' })
      .trim()
      .max(500, 'description cannot exceed 500 characters')
      .optional()
      .nullable(),
    reference: z
      .string({ invalid_type_error: 'reference must be a string' })
      .trim()
      .max(100, 'reference cannot exceed 100 characters')
      .optional()
      .nullable(),
    assetId: z
      .string({ invalid_type_error: 'assetId must be a string' })
      .trim()
      .uuid('assetId must be a valid UUID')
      .optional()
      .nullable(),
  })
  .strict();

// Schema for List Entries Query (GET /api/finance/entries)
const listLedgerEntriesQuerySchema = z.object({
  startDate: z
    .string()
    .trim()
    .refine((val) => normalizeDateToUtcMidnight(val) !== null, {
      message: 'startDate must be YYYY-MM-DD or valid ISO date',
    })
    .transform((val) => normalizeDateToUtcMidnight(val))
    .optional(),
  endDate: z
    .string()
    .trim()
    .refine((val) => normalizeDateToEndOfDay(val) !== null, {
      message: 'endDate must be YYYY-MM-DD or valid ISO date',
    })
    .transform((val) => normalizeDateToEndOfDay(val))
    .optional(),
  type: z.enum(['RECEIPT', 'EXPENSE']).optional(),
  category: z.string().trim().min(1).optional(),
});

// Schema for Updating a Ledger Entry (PUT / PATCH /api/finance/entries/:id)
const updateLedgerEntrySchema = z
  .object({
    category: z
      .string({ invalid_type_error: 'Category must be a string' })
      .trim()
      .min(1, 'Category cannot be empty')
      .optional(),
    amountPaise: z
      .number({ invalid_type_error: 'amountPaise must be an integer' })
      .refine(
        (val) => Number.isInteger(val) && val > 0,
        'amountPaise must be a positive integer greater than 0'
      )
      .optional(),
    date: z
      .string({ invalid_type_error: 'Date must be a string' })
      .trim()
      .min(1)
      .refine((val) => normalizeDateToUtcMidnight(val) !== null, {
        message: 'Invalid date format (must be YYYY-MM-DD or ISO date)',
      })
      .transform((val) => normalizeDateToUtcMidnight(val))
      .optional(),
    mode: z.enum(PAYMENT_MODES, {
      errorMap: () => ({
        message: `Mode must be one of: ${PAYMENT_MODES.join(', ')}`,
      }),
    }).optional(),
    reference: z
      .string({ invalid_type_error: 'reference must be a string' })
      .trim()
      .max(100, 'reference cannot exceed 100 characters')
      .optional()
      .nullable(),
    description: z
      .string({ invalid_type_error: 'description must be a string' })
      .trim()
      .max(500, 'description cannot exceed 500 characters')
      .optional()
      .nullable(),
    assetId: z
      .string({ invalid_type_error: 'assetId must be a string' })
      .trim()
      .uuid('assetId must be a valid UUID')
      .optional()
      .nullable(),
  })
  .strict();

const { getIstMonthBounds } = require('./dateUtil');

/**
 * Resolves a month string ("YYYY-MM") into Asia/Kolkata (+05:30) start and end Date boundaries.
 * Defaults to current month in IST if omitted.
 */
const resolveMonthRange = getIstMonthBounds;

// Schema for Cash Book Query (GET /api/finance/cashbook)
const cashBookQuerySchema = z
  .object({
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    month: z.string().trim().optional(),
    page: z.union([z.string(), z.number()]).optional(),
    limit: z.union([z.string(), z.number()]).optional(),
  })
  .refine(
    (data) => {
      // If either startDate or endDate is provided, both must be provided
      if ((data.startDate && !data.endDate) || (!data.startDate && data.endDate)) {
        return false;
      }
      return true;
    },
    {
      message: 'Both startDate and endDate must be provided together',
    }
  );

// Schema for Monthly Summary Query (GET /api/finance/summary)
const monthlySummaryQuerySchema = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .optional(),
});

module.exports = {
  idParamSchema,
  RECEIPT_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
  normalizeDateToUtcMidnight,
  normalizeDateToEndOfDay,
  getIstMonthBounds,
  resolveMonthRange,
  createReceiptSchema,
  createExpenseSchema,
  listLedgerEntriesQuerySchema,
  updateLedgerEntrySchema,
  cashBookQuerySchema,
  monthlySummaryQuerySchema,
};
