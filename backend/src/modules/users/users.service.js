const { query } = require('../../db/pool');
const { likePattern } = require('../../utils/like-pattern');
const HttpError = require('../../utils/http-error');
const { userIdSchema } = require('./users.schema');

// password_hash is never selected.
const USER_COLUMNS = `u.id, u.full_name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
  (SELECT COUNT(*)::int FROM waste_reports r WHERE r.user_id = u.id) AS report_count`;

// Every filter is optional: a NULL parameter means "don't filter on this".
// $1 role, $2 is_active, $3 search pattern (name or email)
const LIST_FILTERS = `($1::text IS NULL OR u.role = $1)
  AND ($2::boolean IS NULL OR u.is_active = $2)
  AND ($3::text IS NULL OR u.full_name ILIKE $3 OR u.email ILIKE $3)`;

async function listUsers({ page, limit, role, is_active, q }) {
  const filterParams = [role ?? null, is_active ?? null, likePattern(q)];

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM users u WHERE ${LIST_FILTERS}`, filterParams);

  const { rows } = await query(
    `SELECT ${USER_COLUMNS}
     FROM users u
     WHERE ${LIST_FILTERS}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $4 OFFSET $5`,
    [...filterParams, limit, (page - 1) * limit]
  );

  return { users: rows, pagination: { page, limit, total: countResult.rows[0].total } };
}

// Activates or deactivates a user. A deactivated user's token stops working immediately,
// because `authenticate` checks is_active on every request.
async function updateUser(userId, adminId, { is_active }) {
  if (!userIdSchema.safeParse(userId).success) {
    throw new HttpError(404, 'User not found');
  }
  if (userId === adminId && is_active === false) {
    throw new HttpError(400, 'You cannot deactivate your own account');
  }

  const updated = await query('UPDATE users SET is_active = $2 WHERE id = $1 RETURNING id', [userId, is_active]);
  if (updated.rowCount === 0) {
    throw new HttpError(404, 'User not found');
  }

  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [userId]);
  return rows[0];
}

module.exports = { listUsers, updateUser };
