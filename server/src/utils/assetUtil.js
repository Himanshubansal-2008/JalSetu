const { z } = require('zod');

// Allowed enums matching Prisma schema
const ASSET_TYPES = [
  'SOURCE',
  'PUMP',
  'PIPELINE',
  'VALVE',
  'TANK',
  'TREATMENT_PLANT',
  'STANDPOST',
];

const ASSET_STATUSES = ['WORKING', 'FAULTY', 'UNDER_REPAIR'];

// Allowed attribute definitions per asset type
const ATTRIBUTE_DEFINITIONS = {
  PUMP: {
    hp: (v) => typeof v === 'number' && v > 0,
    make: (v) => typeof v === 'string' && v.trim().length <= 100,
    model: (v) => typeof v === 'string' && v.trim().length <= 100,
    serialNo: (v) => typeof v === 'string' && v.trim().length <= 100,
  },
  TANK: {
    capacityL: (v) => typeof v === 'number' && v > 0,
    material: (v) => typeof v === 'string' && v.trim().length <= 100,
  },
  PIPELINE: {
    lengthM: (v) => typeof v === 'number' && v > 0,
    material: (v) => typeof v === 'string' && v.trim().length <= 100,
    diameterMm: (v) => typeof v === 'number' && v > 0,
  },
  VALVE: {
    valveType: (v) => typeof v === 'string' && v.trim().length <= 100,
    diameterMm: (v) => typeof v === 'number' && v > 0,
  },
  SOURCE: {
    sourceType: (v) => typeof v === 'string' && v.trim().length <= 100,
    depthM: (v) => typeof v === 'number' && v > 0,
  },
  TREATMENT_PLANT: {
    treatmentType: (v) => typeof v === 'string' && v.trim().length <= 100,
    capacityLPD: (v) => typeof v === 'number' && v > 0,
  },
  STANDPOST: {},
};

// Helper function to sanitize and keep only allowed attributes for the asset type
function sanitizeAttributes(type, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const allowed = ATTRIBUTE_DEFINITIONS[type];
  if (!allowed) {
    return null;
  }

  const result = {};
  for (const [key, validator] of Object.entries(allowed)) {
    if (key in raw) {
      const val = raw[key];
      if (validator(val)) {
        result[key] = typeof val === 'string' ? val.trim() : val;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// Helper to validate and convert date strings for create (defaults undefined/null to null)
const dateSchema = (fieldName, rejectFuture = false) =>
  z
    .string({ invalid_type_error: 'Invalid ' + fieldName })
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined || val === null) return;
      if (typeof val !== 'string' || val.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ' + fieldName });
        return;
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ' + fieldName });
        return;
      }
      if (rejectFuture && d.getTime() > Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: fieldName + ' cannot be in the future',
        });
        return;
      }
    })
    .transform((val) => {
      if (!val) return null;
      return new Date(val);
    });

// Helper to validate and convert date strings for update (preserves undefined if not passed)
const updateDateSchema = (fieldName, rejectFuture = false) =>
  z
    .string({ invalid_type_error: 'Invalid ' + fieldName })
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined || val === null) return;
      if (typeof val !== 'string' || val.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ' + fieldName });
        return;
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ' + fieldName });
        return;
      }
      if (rejectFuture && d.getTime() > Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: fieldName + ' cannot be in the future',
        });
        return;
      }
    })
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null || val === '') return null;
      return new Date(val);
    });

// Schema for validating base64 photo data
const photoSchema = z
  .string({
    invalid_type_error: 'Photo must be a JPEG, PNG or WebP image',
  })
  .superRefine((val, ctx) => {
    // Empty string check
    if (val === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Photo data is not valid',
      });
      return;
    }

    // Maximum length 1,000,000 characters
    if (val.length > 1000000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Photo is too large. Please use a smaller image',
      });
      return;
    }

    // Must match data URI prefix for allowed image types
    const match = val.match(/^data:image\/(jpeg|png|webp);base64,(.*)$/s);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Photo must be a JPEG, PNG or WebP image',
      });
      return;
    }

    const type = match[1];
    const base64Data = match[2];

    // Must be valid base64 with length multiple of 4 and max 2 '=' padding chars
    if (
      base64Data.length === 0 ||
      base64Data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64Data)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Photo data is not valid',
      });
      return;
    }

    // Decode first header bytes to verify magic bytes against declared type
    const headerBuffer = Buffer.from(base64Data.slice(0, 32), 'base64');

    if (type === 'jpeg') {
      if (
        headerBuffer.length < 3 ||
        headerBuffer[0] !== 0xff ||
        headerBuffer[1] !== 0xd8 ||
        headerBuffer[2] !== 0xff
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Photo data is not a valid image',
        });
        return;
      }
    } else if (type === 'png') {
      if (
        headerBuffer.length < 4 ||
        headerBuffer[0] !== 0x89 ||
        headerBuffer[1] !== 0x50 ||
        headerBuffer[2] !== 0x4e ||
        headerBuffer[3] !== 0x47
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Photo data is not a valid image',
        });
        return;
      }
    } else if (type === 'webp') {
      if (
        headerBuffer.length < 12 ||
        headerBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
        headerBuffer.toString('ascii', 8, 12) !== 'WEBP'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Photo data is not a valid image',
        });
        return;
      }
    }
  });

// Schema for creating an asset
const createAssetSchema = z
  .object({
    name: z
      .string({
        required_error: 'Name is required',
        invalid_type_error: 'Name must be a string',
      })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters'),
    type: z.enum(ASSET_TYPES, {
      errorMap: () => ({ message: 'Invalid asset type' }),
    }),
    status: z
      .enum(ASSET_STATUSES, {
        errorMap: () => ({ message: 'Invalid asset status' }),
      })
      .optional()
      .default('WORKING'),
    lat: z
      .number({ invalid_type_error: 'Latitude must be a number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .nullable()
      .optional(),
    lng: z
      .number({ invalid_type_error: 'Longitude must be a number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .nullable()
      .optional(),
    installDate: dateSchema('install date', true),
    warrantyExpiry: dateSchema('warranty expiry date', false),
    cost: z
      .number({ invalid_type_error: 'Cost must be a number' })
      .int('Cost must be a whole number')
      .min(0, 'Cost cannot be negative')
      .nullable()
      .optional(),
    notes: z
      .string({ invalid_type_error: 'Notes must be a string' })
      .trim()
      .max(1000, 'Notes must be at most 1000 characters')
      .nullable()
      .optional(),
    attributes: z
      .record(
        z.string(),
        z.union([
          z.string().max(100, 'Attribute value cannot exceed 100 characters'),
          z.number(),
        ])
      )
      .nullable()
      .optional(),
    photo: photoSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.lat !== undefined && data.lat !== null;
    const hasLng = data.lng !== undefined && data.lng !== null;
    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must be given together',
      });
    }
  })
  .transform((data) => {
    const sanitized = {
      ...data,
      attributes: sanitizeAttributes(data.type, data.attributes),
    };
    if (sanitized.photo === null || sanitized.photo === undefined) {
      delete sanitized.photo;
    }
    return sanitized;
  });

// Schema for updating an asset (partial update)
const updateAssetSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'Name must be a string' })
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must be at most 100 characters')
      .optional(),
    type: z.string({ invalid_type_error: 'Invalid asset type' }).optional(),
    status: z
      .enum(ASSET_STATUSES, {
        errorMap: () => ({ message: 'Invalid asset status' }),
      })
      .optional(),
    lat: z
      .number({ invalid_type_error: 'Latitude must be a number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .nullable()
      .optional(),
    lng: z
      .number({ invalid_type_error: 'Longitude must be a number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .nullable()
      .optional(),
    installDate: updateDateSchema('install date', true),
    warrantyExpiry: updateDateSchema('warranty expiry date', false),
    cost: z
      .number({ invalid_type_error: 'Cost must be a number' })
      .int('Cost must be a whole number')
      .min(0, 'Cost cannot be negative')
      .nullable()
      .optional(),
    notes: z
      .string({ invalid_type_error: 'Notes must be a string' })
      .trim()
      .max(1000, 'Notes must be at most 1000 characters')
      .nullable()
      .optional(),
    attributes: z
      .record(
        z.string(),
        z.union([
          z.string().max(100, 'Attribute value cannot exceed 100 characters'),
          z.number(),
        ])
      )
      .nullable()
      .optional(),
    statusNote: z
      .string({ invalid_type_error: 'Status note must be a string' })
      .trim()
      .max(300, 'Status note must be at most 300 characters')
      .optional(),
    photo: photoSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // If either lat or lng is present, both must be present
    const hasLat = data.lat !== undefined;
    const hasLng = data.lng !== undefined;
    if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must be given together',
      });
    }

    // Require at least one updatable field
    const updatableKeys = [
      'name',
      'type',
      'status',
      'lat',
      'lng',
      'installDate',
      'warrantyExpiry',
      'cost',
      'notes',
      'attributes',
      'statusNote',
      'photo',
    ];
    const hasAnyField = updatableKeys.some((k) => data[k] !== undefined);
    if (!hasAnyField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No changes provided',
      });
    }
  });

// Schema for querying/listing assets
const listAssetsQuerySchema = z.object({
  type: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(ASSET_TYPES, { errorMap: () => ({ message: 'Invalid asset type' }) }).optional()
  ),
  status: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(ASSET_STATUSES, { errorMap: () => ({ message: 'Invalid asset status' }) }).optional()
  ),
  search: z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v),
    z.string().max(100, 'Search query cannot exceed 100 characters').optional()
  ),
  page: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return 1;
    const num = Number(val);
    return Number.isInteger(num) ? num : NaN;
  }, z.number({ invalid_type_error: 'Page must be an integer' }).int().min(1, 'Page must be at least 1').default(1)),
  limit: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return 50;
    const num = Number(val);
    return Number.isInteger(num) ? num : NaN;
  }, z.number({ invalid_type_error: 'Limit must be an integer' }).int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(50)),
});

module.exports = {
  ASSET_TYPES,
  ASSET_STATUSES,
  sanitizeAttributes,
  createAssetSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
  photoSchema,
};
