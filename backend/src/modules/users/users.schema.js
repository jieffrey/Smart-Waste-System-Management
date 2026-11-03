const { z } = require('zod');
const { paginationFields } = require('../../utils/pagination');

const USER_ROLES = ['admin', 'user'];

// Query string for GET /api/admin/users (all values arrive as text).
const listUsersSchema = z.object({
  ...paginationFields,
  role: z.enum(USER_ROLES, { error: `Role must be one of: ${USER_ROLES.join(', ')}` }).optional(),
  is_active: z
    .enum(['true', 'false'], { error: 'is_active must be true or false' })
    .transform((value) => value === 'true')
    .optional(),
  q: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
});

// Body for PATCH /api/admin/users/:id
const updateUserSchema = z.object({
  is_active: z.boolean({ error: 'is_active must be true or false' }),
});

// A malformed user id is treated like an unknown one (404).
const userIdSchema = z.uuid();

module.exports = { listUsersSchema, updateUserSchema, userIdSchema };
