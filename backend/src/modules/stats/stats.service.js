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

// For each of the last 30 days (today included, Asia/Jakarta calendar days):
// - count:           reports created that day
// - completed_count: reports whose status became `completed` that day (from the status history)
// Days without any are included with 0.
async function getReportsPerDay() {
  const { rows } = await query(
    `WITH days AS (
       SELECT (NOW() AT TIME ZONE $1)::date - offset_days AS day
       FROM generate_series(29, 0, -1) AS offset_days
     ),
     created AS (
       SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS count
       FROM waste_reports
       WHERE created_at >= ((NOW() AT TIME ZONE $1)::date - 29)::timestamp AT TIME ZONE $1
       GROUP BY 1
     ),
     completed AS (
       SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(DISTINCT report_id)::int AS count
       FROM report_status_history
       WHERE new_status = 'completed'
         AND created_at >= ((NOW() AT TIME ZONE $1)::date - 29)::timestamp AT TIME ZONE $1
       GROUP BY 1
     )
     SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
            COALESCE(created.count, 0) AS count,
            COALESCE(completed.count, 0) AS completed_count
     FROM days
     LEFT JOIN created ON created.day = days.day
     LEFT JOIN completed ON completed.day = days.day
     ORDER BY days.day`,
    [TIME_ZONE]
  );
  return rows;
}

// How the AI's category relates to the current category, for every report that has an AI prediction:
// one entry per (ai_category, category) pair, all 9 pairs always present (count 0 when none).
// Entries where the two differ are reports an admin corrected.
async function getAiFlow() {
  const { rows } = await query(
    `SELECT ai_predicted_category AS ai_category, category, COUNT(*)::int AS count
     FROM waste_reports
     WHERE ai_predicted_category IS NOT NULL
     GROUP BY 1, 2`
  );
  const counts = new Map(rows.map((row) => [`${row.ai_category}>${row.category}`, row.count]));
  return REPORT_CATEGORIES.flatMap((aiCategory) =>
    REPORT_CATEGORIES.map((category) => ({
      ai_category: aiCategory,
      category,
      count: counts.get(`${aiCategory}>${category}`) ?? 0,
    }))
  );
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
    ai_flow: await getAiFlow(),
  };
}

module.exports = { getStats };
