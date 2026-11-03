const { z } = require('zod');

// Shared `page` and `limit` query fields for list endpoints (query values arrive as text).
const paginationFields = {
  page: z.coerce
    .number({ error: 'Page must be a number' })
    .int('Page must be a whole number')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int('Limit must be a whole number')
    .min(1, 'Limit must be between 1 and 50')
    .max(50, 'Limit must be between 1 and 50')
    .default(20),
};

module.exports = { paginationFields };
