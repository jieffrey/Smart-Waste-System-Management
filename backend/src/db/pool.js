const { Pool } = require('pg');
const { databaseUrl, dbPoolMax } = require('../config/env');

const pool = new Pool({
  connectionString: databaseUrl, // SSL comes from ?sslmode=require in the URL
  max: dbPoolMax, // max open connections from this process (default 10)
  idleTimeoutMillis: 30_000, // close idle connections after 30s
  connectionTimeoutMillis: 10_000, // Neon may need a few seconds to wake from idle
});

// Prevents a dropped idle connection (e.g. Neon suspending) from crashing the process.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Always use $1, $2 ... placeholders with a params array — never concatenate input into SQL.
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
