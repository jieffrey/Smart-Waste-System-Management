const { z } = require('zod');
const { isCommonPassword } = require('./common-passwords');

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(255, 'Email must be at most 255 characters')
  .pipe(z.email('Email is invalid'));

// Rules for a new password: length, and not one of the most common passwords (NIST SP 800-63B style;
// no "must contain a symbol" rules, which push people to predictable patterns like Password1!).
const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((value) => !isCommonPassword(value), 'This password is too common. Please choose a less predictable one');

const fullName = z
  .string({ error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name must be at most 100 characters');

const registerSchema = z.object({
  full_name: fullName,
  email,
  password,
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

// Body for PATCH /api/auth/me: change the name and/or email (same rules as registration).
const updateProfileSchema = z
  .object({ full_name: fullName.optional(), email: email.optional() })
  .refine((body) => body.full_name !== undefined || body.email !== undefined, {
    message: 'Provide at least one of: full_name, email',
  });

// Body for POST /api/auth/change-password: the current password, and a new one with the registration rules.
const changePasswordSchema = z
  .object({
    current_password: z.string({ error: 'Current password is required' }).min(1, 'Current password is required'),
    new_password: password,
  })
  .refine((body) => body.new_password !== body.current_password, {
    message: 'New password must be different from the current one',
    path: ['new_password'],
  });

module.exports = { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema };
