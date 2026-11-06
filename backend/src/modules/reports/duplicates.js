// "Possible duplicate": an open report (pending or in progress) with the same category, created in the last
// 24 hours, within 50 m of the new one. Nothing is blocked: the new report is saved and linked to the
// nearest such report (newest first on a tie).
const DUPLICATE_RADIUS_M = 50;
const DUPLICATE_WINDOW_HOURS = 24;
const EARTH_RADIUS_M = 6371000;

// Great-circle distance in metres (haversine) between (lat1, lon1) and (lat2, lon2), all in degrees.
function haversineSql(lat1, lon1, lat2, lon2) {
  return `(${EARTH_RADIUS_M} * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(${lat2} - ${lat1}) / 2), 2)
    + COS(RADIANS(${lat1})) * COS(RADIANS(${lat2})) * POWER(SIN(RADIANS(${lon2} - ${lon1}) / 2), 2)
  )))`;
}

// `db` is the pool or a transaction client. The bounding box (a little wider than 50 m) lets Postgres skip
// far-away rows before computing the exact distance.
async function findPossibleDuplicate(db, { category, latitude, longitude }) {
  const distance = haversineSql('$2::float8', '$3::float8', 'latitude::float8', 'longitude::float8');
  const { rows } = await db.query(
    `SELECT id, ${distance} AS distance_m
     FROM waste_reports
     WHERE category = $1
       AND status IN ('pending', 'in_progress')
       AND created_at >= NOW() - make_interval(hours => $5)
       AND latitude BETWEEN $2::float8 - $6::float8 AND $2::float8 + $6::float8
       AND longitude BETWEEN $3::float8 - $6::float8 / GREATEST(COS(RADIANS($2::float8)), 0.01)
                         AND $3::float8 + $6::float8 / GREATEST(COS(RADIANS($2::float8)), 0.01)
       AND ${distance} <= $4
     ORDER BY distance_m ASC, created_at DESC
     LIMIT 1`,
    [category, latitude, longitude, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_HOURS, (DUPLICATE_RADIUS_M * 1.2) / 111320]
  );
  return rows[0] ? rows[0].id : null;
}

module.exports = { findPossibleDuplicate, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_HOURS };
