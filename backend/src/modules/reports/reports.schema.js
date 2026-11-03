const { z } = require('zod');
const { paginationFields } = require('../../utils/pagination');

// Multipart form fields always arrive as text, so coordinates are converted to numbers here.
function coordinate(name, min, max) {
  return z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`)
    .pipe(
      z.coerce
        .number({ error: `${name} must be a number` })
        .min(min, `${name} must be between ${min} and ${max}`)
        .max(max, `${name} must be between ${min} and ${max}`)
    );
}

// `category` is not accepted from the client: it always comes from the ML prediction.
// Unknown fields (including category) are dropped by z.object.
const createReportSchema = z.object({
  description: z
    .string({ error: 'Description is required' })
    .trim()
    .min(1, 'Description is required')
    .max(1000, 'Description must be at most 1000 characters'),
  latitude: coordinate('Latitude', -90, 90),
  longitude: coordinate('Longitude', -180, 180),
  address: z.string().trim().max(255, 'Address must be at most 255 characters').optional(),
});

const REPORT_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'];
const REPORT_CATEGORIES = ['organic', 'paper', 'plastic'];

const statusField = z.enum(REPORT_STATUSES, { error: `Status must be one of: ${REPORT_STATUSES.join(', ')}` });
const categoryField = z.enum(REPORT_CATEGORIES, {
  error: `Category must be one of: ${REPORT_CATEGORIES.join(', ')}`,
});

// Query string for GET /api/reports/me (all values arrive as text).
const listMyReportsSchema = z.object({
  ...paginationFields,
  status: statusField.optional(),
});

// Report ids are UUIDs. A malformed id is treated like an unknown one (404), not as a validation error.
const reportIdSchema = z.uuid();

module.exports = {
  createReportSchema,
  listMyReportsSchema,
  reportIdSchema,
  statusField,
  categoryField,
  REPORT_STATUSES,
  REPORT_CATEGORIES,
};
