const { readMlApiTimeout } = require('./ml-timeout');

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
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
