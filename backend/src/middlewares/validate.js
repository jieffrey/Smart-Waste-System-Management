const HttpError = require('../utils/http-error');

// Validates req.body (default) or req.query with a zod schema.
// - 'body':  the parsed result replaces req.body
// - 'query': the parsed result is stored in req.validatedQuery (Express 5 does not allow replacing req.query)
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new HttpError(400, 'Validation failed', details);
    }

    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req.body = result.data;
    }
    next();
  };
}

module.exports = validate;
