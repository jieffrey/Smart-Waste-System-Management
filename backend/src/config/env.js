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
  port: Number(process.env.PORT) || 3000,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
};
