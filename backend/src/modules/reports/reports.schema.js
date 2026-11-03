const { z } = require('zod');

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

// Query string for GET /api/reports/me (all values arrive as text).
const listMyReportsSchema = z.object({
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
  status: z
    .enum(REPORT_STATUSES, { error: `Status must be one of: ${REPORT_STATUSES.join(', ')}` })
    .optional(),
});

module.exports = { createReportSchema, listMyReportsSchema, REPORT_STATUSES };
