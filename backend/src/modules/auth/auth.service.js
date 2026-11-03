const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../db/pool');
const { jwtSecret, jwtExpiresIn } = require('../../config/env');
const HttpError = require('../../utils/http-error');

const SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';
const USER_COLUMNS = 'id, full_name, email, role, is_active, created_at, updated_at';

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

  const passwordMatches = found && (await bcrypt.compare(password, found.password_hash));
  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }
  if (!found.is_active) {
    throw new HttpError(403, 'Account is deactivated');
  }

  const { password_hash, ...user } = found;
  return { user, token: createToken(user) };
}

async function getUserById(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { hashPassword, registerUser, loginUser, getUserById };
