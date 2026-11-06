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

module.exports = { readMlApiTimeout, ML_API_TIMEOUT_DEFAULT_MS, ML_API_TIMEOUT_MAX_MS };
