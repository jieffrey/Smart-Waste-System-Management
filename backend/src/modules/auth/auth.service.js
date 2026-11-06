const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db/pool');
const { jwtSecret, jwtExpiresIn } = require('../../config/env');
const HttpError = require('../../utils/http-error');

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';
const USER_COLUMNS = 'id, full_name, email, role, is_active, created_at, updated_at';
// Compared against when the email has no account, so a login takes the same time either way
// (otherwise the response time reveals which emails are registered).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-account-timing-placeholder', SALT_ROUNDS);

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: jwtExpiresIn,
  });
}

// Used by registration and by the seed script, so every password is hashed the same way.
function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function registerUser({ full_name, email, password }) {
  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING ${USER_COLUMNS}`,
      [full_name, email, passwordHash]
    );
    const user = rows[0];
    return { user, token: createToken(user) };
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new HttpError(409, 'Email is already registered');
    }
    throw err;
  }
}

async function loginUser({ email, password }) {
  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE LOWER(email) = $1`,
    [email]
  );
  const found = rows[0];

  // Always run exactly one bcrypt comparison, whether or not the account exists.
  const passwordMatches = await bcrypt.compare(password, found ? found.password_hash : DUMMY_PASSWORD_HASH);
  if (!found || !passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!found.is_active) {
    throw new HttpError(403, 'Account is deactivated');
  }

  const { password_hash, ...user } = found;
  return { user, token: createToken(user) };
}

// Changes the signed-in user's name and/or email. The token stays valid (it carries the id, not the email).
async function updateProfile(userId, { full_name, email }) {
  try {
    const { rows } = await query(
      `UPDATE users
       SET full_name = COALESCE($2, full_name),
           email = COALESCE($3, email)
       WHERE id = $1
       RETURNING ${USER_COLUMNS}`,
      [userId, full_name ?? null, email ?? null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new HttpError(409, 'Email is already registered');
    }
    throw err;
  }
}

// Checks the current password, then stores a hash of the new one. A wrong current password is a 400 (not
// 401): the session itself is fine, and a 401 would sign the user out in the apps.
// Existing tokens stay valid until they expire (JWTs are stateless; there is no session list to revoke).
async function changePassword(userId, { current_password, new_password }) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const matches = rows[0] && (await bcrypt.compare(current_password, rows[0].password_hash));
  if (!matches) {
    throw new HttpError(400, 'Current password is incorrect', [
      { field: 'current_password', message: 'Current password is incorrect' },
    ]);
  }
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, await hashPassword(new_password)]);
}

async function getUserById(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { hashPassword, registerUser, loginUser, getUserById, updateProfile, changePassword };
