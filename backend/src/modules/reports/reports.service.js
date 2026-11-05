const { pool, query } = require('../../db/pool');
const { classifyImage } = require('../ml/ml.service');
const uploads = require('../uploads/uploads.service');
const HttpError = require('../../utils/http-error');
const { reportIdSchema } = require('./reports.schema');

// NUMERIC columns are cast to float8 so they are returned as JSON numbers, not strings.
const REPORT_COLUMNS = `id, user_id, description, category, status, image_url,
  latitude::float8 AS latitude, longitude::float8 AS longitude, address,
  ai_predicted_category, ai_confidence::float8 AS ai_confidence, ai_model_version,
  admin_note, created_at, updated_at`;

// A failed cleanup is logged, never thrown: the caller needs the original error.
async function deleteImageQuietly(imageUrl) {
  try {
    await uploads.deleteImage(imageUrl);
  } catch (err) {
    console.error(`Could not delete orphaned image ${imageUrl}: ${err.message}`);
  }
}

async function createReport(userId, { description, latitude, longitude, address }, image) {
  // 1. Classify first. If the ML API fails this throws 503 and nothing has been saved yet.
  const prediction = await classifyImage(image.buffer, image.mimeType);

  // 2. Strip metadata (EXIF/GPS) and store the cleaned image (local disk or Cloudinary).
  const cleanImage = await uploads.sanitizeImage(image);
  const imageUrl = await uploads.saveImage(cleanImage.buffer, cleanImage.extension);

  // 3. The report and its first status-history row in one transaction. If anything fails from here on
  //    (including getting a connection), the stored image is deleted again.
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO waste_reports
         (user_id, description, category, image_url, latitude, longitude, address,
          ai_predicted_category, ai_confidence, ai_model_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $3, $8, $9)
       RETURNING ${REPORT_COLUMNS}`,
      [
        userId,
        description,
        prediction.category,
        imageUrl,
        latitude,
        longitude,
        address || null,
        prediction.confidence,
        prediction.modelVersion,
      ]
    );
    const report = rows[0];

    await client.query(
      `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by)
       VALUES ($1, NULL, $2, $3)`,
      [report.id, report.status, userId]
    );

    await client.query('COMMIT');
    return report;
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {}); // a broken connection must not skip the cleanup
    }
    await deleteImageQuietly(imageUrl); // don't leave an orphaned image behind
    throw err;
  } finally {
    client?.release();
  }
}

// A user's own reports, newest first. `status` is optional (null = all statuses).
async function listUserReports(userId, { page, limit, status }) {
  const statusFilter = status || null;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM waste_reports
     WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)`,
    [userId, statusFilter]
  );

  const { rows } = await query(
    `SELECT ${REPORT_COLUMNS}
     FROM waste_reports
     WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
     ORDER BY created_at DESC, id DESC
     LIMIT $3 OFFSET $4`,
    [userId, statusFilter, limit, (page - 1) * limit]
  );

  return { reports: rows, pagination: { page, limit, total: countResult.rows[0].total } };
}

// One report with its status history. Only the owner or an admin can see it; everyone else gets 404
// (not 403), so report ids cannot be probed.
async function getReportForViewer(reportId, viewer) {
  if (!reportIdSchema.safeParse(reportId).success) {
    throw new HttpError(404, 'Report not found');
  }

  const { rows } = await query(
    `SELECT ${REPORT_COLUMNS}
     FROM waste_reports
     WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')`,
    [reportId, viewer.id, viewer.role]
  );
  const report = rows[0];
  if (!report) {
    throw new HttpError(404, 'Report not found');
  }

  // changed_by is left out on purpose: users don't need to see which admin changed the status.
  const history = await query(
    `SELECT old_status, new_status, note, created_at
     FROM report_status_history
     WHERE report_id = $1
     ORDER BY created_at ASC, id ASC`,
    [reportId]
  );

  return { ...report, status_history: history.rows };
}

module.exports = { createReport, listUserReports, getReportForViewer };
