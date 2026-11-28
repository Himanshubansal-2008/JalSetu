const { z } = require('zod');

// Valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
const PHONE_REGEX = /^[6-9]\d{9}$/;

// Shared phone validator with whitespace/hyphen normalization
const phoneSchema = z
  .string({
    required_error: 'Phone number is required',
    invalid_type_error: 'Phone number must be a string',
  })
  .trim()
  .transform((val) => val.replace(/[\s-]+/g, ''))
  .refine(
    (val) => PHONE_REGEX.test(val),
    'Phone number must be a valid 10-digit Indian mobile number (e.g. 9820010101)'
  );

// Strong password validator: min 8 characters, at least 1 letter, at least 1 number
const strongPasswordSchema = z
  .string({
    required_error: 'Password is required',
    invalid_type_error: 'Password must be a string',
  })
  .min(8, 'Password must be at least 8 characters long')
  .refine(
    (pwd) => /[A-Za-z]/.test(pwd),
    'Password must contain at least one letter'
  )
  .refine(
    (pwd) => /[0-9]/.test(pwd),
    'Password must contain at least one number'
  );

module.exports = {
  PHONE_REGEX,
  phoneSchema,
  strongPasswordSchema,
};
