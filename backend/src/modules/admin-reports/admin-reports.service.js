const { query } = require('../../db/pool');
const { TIME_ZONE } = require('../../config/constants');
const { likePattern } = require('../../utils/like-pattern');

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

module.exports = { listReports };
