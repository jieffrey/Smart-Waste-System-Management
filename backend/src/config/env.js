const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}

// ML API timeout. The mobile app gives up on a report upload after 45 s (Mobile/src/lib/api.ts), so the backend
// must answer before that: at most 40 s, leaving time for storing the photo and the database insert.
const ML_API_TIMEOUT_DEFAULT_MS = 30_000;
const ML_API_TIMEOUT_MIN_MS = 100;
const ML_API_TIMEOUT_MAX_MS = 40_000;

function readMlApiTimeout(value) {
  if (value === undefined || value.trim() === '') {
    return ML_API_TIMEOUT_DEFAULT_MS;
  }
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms < ML_API_TIMEOUT_MIN_MS || ms > ML_API_TIMEOUT_MAX_MS) {
    throw new Error(
      `ML_API_TIMEOUT_MS must be a whole number from ${ML_API_TIMEOUT_MIN_MS} to ${ML_API_TIMEOUT_MAX_MS} ` +
        '(the mobile app waits 45 s for a report upload).'
    );
  }
  return ms;
}

module.exports = {
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  port: Number(process.env.PORT) || 4000,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  // ML API (optional): without ML_API_URL the server still starts, but report creation returns 503
  mlApiUrl: process.env.ML_API_URL ? process.env.ML_API_URL.replace(/\/+$/, '') : null,
  mlApiKey: process.env.ML_API_KEY || null,
  mlApiTimeoutMs: readMlApiTimeout(process.env.ML_API_TIMEOUT_MS),
  // Number of reverse proxies in front of the API (e.g. 1 on Render/Railway), so req.ip is the client's IP
  // for rate limiting. Leave unset when clients connect directly.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  // Browser origins allowed to call the API (comma-separated). Empty = no CORS headers (same-origin only).
  webOrigins: (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
};
