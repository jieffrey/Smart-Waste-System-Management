const { z } = require('zod');
const { paginationFields } = require('../../utils/pagination');
const { statusField, categoryField } = require('../reports/reports.schema');

// Body for PATCH /api/admin/reports/:id
const updateReportSchema = z
  .object({
    status: statusField.optional(),
    category: categoryField.optional(),
    admin_note: z
      .string({ error: 'Admin note must be text' })
      .trim()
      .min(1, 'Admin note cannot be empty')
      .max(1000, 'Admin note must be at most 1000 characters')
      .optional(),
  })
  .refine((body) => body.status !== undefined || body.category !== undefined || body.admin_note !== undefined, {
    message: 'Provide at least one of: status, category, admin_note',
  })
  .refine((body) => body.status !== 'rejected' || body.admin_note !== undefined, {
    message: 'A note is required when rejecting a report',
    path: ['admin_note'],
  });

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
    // ?needs_review=true: only reports the AI was unsure about that no admin has confirmed or corrected yet
    needs_review: z
      .enum(['true', 'false'], { error: 'needs_review must be true or false' })
      .transform((value) => value === 'true')
      .optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'To must be on or after From',
    path: ['to'],
  });

module.exports = { listReportsSchema, updateReportSchema };
