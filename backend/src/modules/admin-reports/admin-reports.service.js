const { pool, query } = require('../../db/pool');
const { TIME_ZONE } = require('../../config/constants');
const { likePattern } = require('../../utils/like-pattern');
const HttpError = require('../../utils/http-error');
const { reportIdSchema } = require('../reports/reports.schema');

// Same report columns as reports.service.js (prefixed with r.), plus the reporter's name and email.
const ADMIN_REPORT_COLUMNS = `r.id, r.user_id, r.description, r.category, r.status, r.image_url,
  r.latitude::float8 AS latitude, r.longitude::float8 AS longitude, r.address,
  r.ai_predicted_category, r.ai_confidence::float8 AS ai_confidence, r.ai_model_version,
  r.admin_note, r.created_at, r.updated_at,
  u.full_name AS reporter_name, u.email AS reporter_email`;

// Allowed status changes. completed and rejected are final: nothing about the report can change any more.
const STATUS_TRANSITIONS = {
  pending: ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

// Every filter is optional: a NULL parameter means "don't filter on this".
// $1 status, $2 category, $3 from date, $4 to date (inclusive), $5 time zone, $6 search pattern
const LIST_FILTERS = `($1::text IS NULL OR r.status = $1)
  AND ($2::text IS NULL OR r.category = $2)
  AND ($3::date IS NULL OR r.created_at >= ($3::date::timestamp AT TIME ZONE $5::text))
  AND ($4::date IS NULL OR r.created_at < (($4::date + 1)::timestamp AT TIME ZONE $5::text))
  AND ($6::text IS NULL OR r.description ILIKE $6 OR r.address ILIKE $6)`;

async function listReports({ page, limit, status, category, from, to, q }) {
  const filterParams = [status ?? null, category ?? null, from ?? null, to ?? null, TIME_ZONE, likePattern(q)];

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM waste_reports r WHERE ${LIST_FILTERS}`, filterParams);

  const { rows } = await query(
    `SELECT ${ADMIN_REPORT_COLUMNS}
     FROM waste_reports r
     JOIN users u ON u.id = r.user_id
     WHERE ${LIST_FILTERS}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $7 OFFSET $8`,
    [...filterParams, limit, (page - 1) * limit]
  );

  return { reports: rows, pagination: { page, limit, total: countResult.rows[0].total } };
}

// One report with its reporter and full status history (including who made each change).
async function getReport(reportId) {
  if (!reportIdSchema.safeParse(reportId).success) {
    throw new HttpError(404, 'Report not found');
  }

  const { rows } = await query(
    `SELECT ${ADMIN_REPORT_COLUMNS}
     FROM waste_reports r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`,
    [reportId]
  );
  const report = rows[0];
  if (!report) {
    throw new HttpError(404, 'Report not found');
  }

  const history = await query(
    `SELECT h.old_status, h.new_status, h.note, h.created_at, h.changed_by, cu.full_name AS changed_by_name
     FROM report_status_history h
     JOIN users cu ON cu.id = h.changed_by
     WHERE h.report_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [reportId]
  );

  return { ...report, status_history: history.rows };
}

// Changes status, category and/or admin_note. ai_predicted_category is never changed.
// A status change also writes a status-history row (note = admin_note) in the same transaction.
async function updateReport(reportId, adminId, { status, category, admin_note }) {
  if (!reportIdSchema.safeParse(reportId).success) {
    throw new HttpError(404, 'Report not found');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE locks the row, so two admins cannot change the same report at the same time.
    const { rows } = await client.query('SELECT status FROM waste_reports WHERE id = $1 FOR UPDATE', [reportId]);
    if (!rows[0]) {
      throw new HttpError(404, 'Report not found');
    }

    const currentStatus = rows[0].status;
    const allowedStatuses = STATUS_TRANSITIONS[currentStatus];

    if (allowedStatuses.length === 0) {
      throw new HttpError(409, `Report is ${currentStatus} and can no longer be changed`);
    }
    if (status !== undefined && !allowedStatuses.includes(status)) {
      throw new HttpError(409, `Cannot change status from ${currentStatus} to ${status}`, [
        { field: 'status', message: `Allowed: ${allowedStatuses.join(', ')}` },
      ]);
    }

    // COALESCE keeps the current value for fields that were not sent.
    await client.query(
      `UPDATE waste_reports
       SET status = COALESCE($2, status),
           category = COALESCE($3, category),
           admin_note = COALESCE($4, admin_note)
       WHERE id = $1`,
      [reportId, status ?? null, category ?? null, admin_note ?? null]
    );

    if (status !== undefined) {
      await client.query(
        `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [reportId, currentStatus, status, adminId, admin_note ?? null]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getReport(reportId);
}

module.exports = { listReports, getReport, updateReport };
