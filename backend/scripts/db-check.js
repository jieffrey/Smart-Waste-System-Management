// Read-only connection check: `npm run db:check` (from backend/).
// Prints no credentials; exits 0 on success, 1 on failure.

const { pool, query } = require('../src/db/pool');

const EXPECTED = ['report_status_history', 'users', 'waste_reports'];

async function main() {
  const {
    rows: [info],
  } = await query('SELECT current_database() AS db, version() AS version, NOW() AS server_time');
  console.log(`Connected to "${info.db}" at ${info.server_time.toISOString()}`);
  console.log(info.version.split(',')[0]);

  const { rows } = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])
     ORDER BY table_name`,
    [EXPECTED]
  );
  const found = rows.map((r) => r.table_name);
  const missing = EXPECTED.filter((t) => !found.includes(t));

  console.log('Tables found:', found.join(', ') || '(none)');
  if (missing.length) {
    console.error('Missing tables:', missing.join(', '));
    process.exitCode = 1;
  } else {
    console.log('Database check passed.');
  }
}

main()
  .catch((err) => {
    console.error('Database check failed:', err.message); // message only, never the URL
    process.exitCode = 1;
  })
  .finally(() => pool.end());
