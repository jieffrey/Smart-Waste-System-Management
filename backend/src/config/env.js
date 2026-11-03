const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}

module.exports = {
  databaseUrl,
  port: Number(process.env.PORT) || 3000,
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
};
