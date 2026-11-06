const { readMlApiTimeout } = require('./ml-timeout');
const { readAiReviewThreshold } = require('./ai-review');

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}

// Where report photos are stored: 'local' (backend/uploads, for dev and tests) or 'cloudinary' (production).
const STORAGE_DRIVERS = ['local', 'cloudinary'];
const storageDriver = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
if (!STORAGE_DRIVERS.includes(storageDriver)) {
  throw new Error(`STORAGE_DRIVER must be one of: ${STORAGE_DRIVERS.join(', ')}.`);
}
if (storageDriver === 'cloudinary' && !process.env.CLOUDINARY_URL) {
  throw new Error('CLOUDINARY_URL must be set when STORAGE_DRIVER=cloudinary.');
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
  // Reports with AI confidence below this need an admin's review (default 0.70)
  aiReviewThreshold: readAiReviewThreshold(process.env.AI_REVIEW_THRESHOLD),
  // Number of reverse proxies in front of the API (e.g. 1 on Render/Railway), so req.ip is the client's IP
  // for rate limiting. Leave unset when clients connect directly.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  // Browser origins allowed to call the API (comma-separated). Empty = no CORS headers (same-origin only).
  webOrigins: (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  storageDriver,
  // Cloudinary folder for report photos (only used with STORAGE_DRIVER=cloudinary). The SDK reads
  // CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>) by itself.
  cloudinaryFolder: (process.env.CLOUDINARY_FOLDER || 'swms').trim().replace(/^\/+|\/+$/g, ''),
};
