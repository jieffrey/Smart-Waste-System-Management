const HttpError = require('../utils/http-error');

// Every error response has the same shape: { error: { message, details } }, with details null when there are none.
function sendError(res, status, message, details = null) {
  res.status(status).json({ error: { message, details: details ?? null } });
}

function notFound(req, res) {
  sendError(res, 404, 'Route not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.message, err.details);
  }

  // JSON body over express.json()'s 100 KB limit: the client's fault, not a server error
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'Request body is too large');
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Request body must be valid JSON');
  }

  console.error(err);
  sendError(res, 500, 'Internal server error');
}

module.exports = { notFound, errorHandler };
