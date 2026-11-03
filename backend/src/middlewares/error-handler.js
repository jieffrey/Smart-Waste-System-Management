const HttpError = require('../utils/http-error');

function notFound(req, res) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body must be valid JSON' } });
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}

module.exports = { notFound, errorHandler };
