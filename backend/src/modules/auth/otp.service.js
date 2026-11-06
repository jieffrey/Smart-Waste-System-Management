const crypto = require('node:crypto');
const { pool, query } = require('../../db/pool');
const { jwtSecret } = require('../../config/env');
const HttpError = require('../../utils/http-error');
const { sendVerificationEmail } = require('./emailjs');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const INVALID_CODE = 'Invalid or expired code';

// 6 random digits (crypto-grade), e.g. "048213".
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Only an HMAC of the code is stored (keyed with the server secret), so a database leak doesn't reveal codes.
function hashCode(code) {
  return crypto.createHmac('sha256', jwtSecret).update(code).digest('hex');
}

function sameHash(a, b) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Stores a fresh code for the user (replacing any older one, attempts back to 0) and emails it.
// `db` is the pool or a transaction client.
async function issueCode(db, user) {
  const code = generateCode();
  await db.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at, attempts, last_sent_at)
     VALUES ($1, $2, NOW() + make_interval(mins => $3), 0, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, last_sent_at = NOW()`,
    [user.id, hashCode(code), CODE_TTL_MINUTES]
  );
  await sendVerificationEmail({ toEmail: user.email, toName: user.full_name, code, expiresMinutes: CODE_TTL_MINUTES });
}

// Checks the code for an unverified account. Returns the verified user, or throws 400. Every wrong code
// counts; after MAX_ATTEMPTS the code is dead and a new one must be requested. Unknown emails get the same
// answer as a wrong code, so this can't be used to find accounts.
async function verifyCode(email, code, userColumns) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT u.id, c.code_hash, c.attempts, c.expires_at < NOW() AS expired
       FROM users u
       JOIN email_verification_codes c ON c.user_id = u.id
       WHERE LOWER(u.email) = $1 AND u.email_verified = false
       FOR UPDATE OF c`,
      [email]
    );
    const found = rows[0];
    if (!found) {
      throw new HttpError(400, INVALID_CODE, [{ field: 'code', message: INVALID_CODE }]);
    }
    if (found.attempts >= MAX_ATTEMPTS) {
      throw new HttpError(400, 'Too many wrong codes. Request a new code', [{ field: 'code', message: 'Too many wrong codes. Request a new code' }]);
    }
    if (found.expired) {
      throw new HttpError(400, 'Code expired. Request a new code', [{ field: 'code', message: 'Code expired. Request a new code' }]);
    }
    if (!sameHash(hashCode(code), found.code_hash)) {
      await client.query('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE user_id = $1', [found.id]);
      await client.query('COMMIT'); // the failed attempt must count even though we throw
      throw new HttpError(400, INVALID_CODE, [{ field: 'code', message: INVALID_CODE }]);
    }

    const verified = await client.query(
      `UPDATE users SET email_verified = true WHERE id = $1 RETURNING ${userColumns}`,
      [found.id]
    );
    await client.query('DELETE FROM email_verification_codes WHERE user_id = $1', [found.id]);
    await client.query('COMMIT');
    return verified.rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Sends a new code to an unverified account, at most once per RESEND_COOLDOWN_SECONDS. For an unknown or
// already verified email nothing happens and the answer is the same as a success (no account probing).
async function resendCode(email) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.last_sent_at + make_interval(secs => $2) - NOW()))))::int AS wait_seconds
     FROM users u
     LEFT JOIN email_verification_codes c ON c.user_id = u.id
     WHERE LOWER(u.email) = $1 AND u.email_verified = false`,
    [email, RESEND_COOLDOWN_SECONDS]
  );
  const user = rows[0];
  if (!user) {
    return;
  }
  if (user.wait_seconds > 0) {
    const error = new HttpError(429, `Please wait ${user.wait_seconds} seconds before requesting a new code`);
    error.retryAfterSeconds = user.wait_seconds;
    throw error;
  }
  await issueCode(pool, user);
}

module.exports = { issueCode, verifyCode, resendCode, CODE_TTL_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS };
