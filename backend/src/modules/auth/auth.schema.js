const { z } = require('zod');

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(255, 'Email must be at most 255 characters')
  .pipe(z.email('Email is invalid'));

const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

const registerSchema = z.object({
  full_name: z
    .string({ error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
  email,
  password,
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };
