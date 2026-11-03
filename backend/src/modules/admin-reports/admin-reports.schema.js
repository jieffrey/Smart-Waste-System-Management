const { z } = require('zod');
const { paginationFields } = require('../../utils/pagination');
const { statusField, categoryField } = require('../reports/reports.schema');

function dateField(label) {
  return z.iso.date({ error: `${label} must be a date (YYYY-MM-DD)` });
}

// Query string for GET /api/admin/reports. `from` and `to` are calendar dates in Asia/Jakarta; `to` is inclusive.
const listReportsSchema = z
  .object({
    ...paginationFields,
    status: statusField.optional(),
    category: categoryField.optional(),
    from: dateField('From').optional(),
    to: dateField('To').optional(),
    q: z.string().trim().max(100, 'Search must be at most 100 characters').optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'To must be on or after From',
    path: ['to'],
  });

module.exports = { listReportsSchema };
