const { query } = require('../../db/pool');
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

module.exports = { listReports, getReport };
