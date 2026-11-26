const { z } = require('zod');

// Schema for UUID route parameter
const idParamSchema = z.string().uuid({ message: 'Invalid consumer id' });

// Schema for Create Consumer (POST /api/consumers)
const createConsumerSchema = z
  .object({
    name: z
      .string({
        required_error: 'name is required',
        invalid_type_error: 'name must be a string',
      })
      .trim()
      .min(1, 'name cannot be empty'),
    houseNumber: z
      .string({
        required_error: 'houseNumber is required',
        invalid_type_error: 'houseNumber must be a string',
      })
      .trim()
      .min(1, 'houseNumber cannot be empty'),
    phone: z
      .string({
        required_error: 'phone is required',
        invalid_type_error: 'phone must be a string',
      })
      .trim()
      .min(1, 'phone cannot be empty'),
    monthlyChargePaise: z
      .number({
        required_error: 'monthlyChargePaise is required',
        invalid_type_error: 'monthlyChargePaise must be an integer',
      })
      .refine(
        (val) => Number.isInteger(val) && val > 0,
        'monthlyChargePaise must be a positive integer greater than 0'
      ),
  })
  .strict();

// Schema for Update Consumer (PUT / PATCH /api/consumers/:id)
const updateConsumerSchema = z
  .object({
    name: z
      .string({ invalid_type_error: 'name must be a string' })
      .trim()
      .min(1, 'name cannot be empty')
      .optional(),
    houseNumber: z
      .string({ invalid_type_error: 'houseNumber must be a string' })
      .trim()
      .min(1, 'houseNumber cannot be empty')
      .optional(),
    phone: z
      .string({ invalid_type_error: 'phone must be a string' })
      .trim()
      .min(1, 'phone cannot be empty')
      .optional(),
    monthlyChargePaise: z
      .number({
        invalid_type_error: 'monthlyChargePaise must be an integer',
      })
      .refine(
        (val) => Number.isInteger(val) && val > 0,
        'monthlyChargePaise must be a positive integer greater than 0'
      )
      .optional(),
    isActive: z
      .boolean({ invalid_type_error: 'isActive must be a boolean' })
      .optional(),
  })
  .strict();

module.exports = {
  idParamSchema,
  createConsumerSchema,
  updateConsumerSchema,
};
