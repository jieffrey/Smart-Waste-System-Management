const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { getUserById } = require('../modules/auth/auth.service');
const HttpError = require('../utils/http-error');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const user = await getUserById(payload.sub);

  if (!user) {
    throw new HttpError(401, 'Invalid or expired token');
  }
  if (!user.is_active) {
    throw new HttpError(403, 'Account is deactivated');
  }

  req.user = user;
  next();
}

// Use after `authenticate`: req.user comes from the verified token + database, never from the request body or headers.
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = { authenticate, authorizeRole };
