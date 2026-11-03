const { query } = require('../../db/pool');
const { TIME_ZONE } = require('../../config/constants');
const { REPORT_STATUSES, REPORT_CATEGORIES } = require('../reports/reports.schema');

// Turns rows like [{ key: 'pending', count: 2 }] into { pending: 2, in_progress: 0, ... } (every key present).
function countsByKey(rows, keys) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) {
    counts[row.key] = row.count;
  }
  return counts;
}

async function getTotals() {
  const byStatus = await query('SELECT status AS key, COUNT(*)::int AS count FROM waste_reports GROUP BY status');
  const byCategory = await query('SELECT category AS key, COUNT(*)::int AS count FROM waste_reports GROUP BY category');

  const by_status = countsByKey(byStatus.rows, REPORT_STATUSES);
  const by_category = countsByKey(byCategory.rows, REPORT_CATEGORIES);
  const reports = Object.values(by_status).reduce((sum, count) => sum + count, 0);

  return { reports, by_status, by_category };
}

// Number of reports created on each of the last 30 days (today included), counted in Asia/Jakarta.
// Days without reports are included with count 0.
async function getReportsPerDay() {
  const { rows } = await query(
    `WITH days AS (
       SELECT (NOW() AT TIME ZONE $1)::date - offset_days AS day
       FROM generate_series(29, 0, -1) AS offset_days
     )
     SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COUNT(r.id)::int AS count
     FROM days
     LEFT JOIN waste_reports r ON (r.created_at AT TIME ZONE $1)::date = days.day
     GROUP BY days.day
     ORDER BY days.day`,
    [TIME_ZONE]
  );
  return rows;
}

// Share of reviewed reports (in_progress or completed, with an AI prediction) where the final category
// still equals the AI prediction. accuracy is null when nothing has been reviewed yet.
async function getAiAccuracy() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS reviewed,
            (COUNT(*) FILTER (WHERE category = ai_predicted_category))::int AS matching
     FROM waste_reports
     WHERE status IN ('in_progress', 'completed') AND ai_predicted_category IS NOT NULL`
  );
  const { reviewed, matching } = rows[0];
  const accuracy = reviewed === 0 ? null : Number((matching / reviewed).toFixed(4));

  return { reviewed, matching, accuracy };
}

async function getStats() {
  return {
    totals: await getTotals(),
    reports_per_day: await getReportsPerDay(),
    ai_accuracy: await getAiAccuracy(),
  };
}

module.exports = { getStats };
