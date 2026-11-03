const HttpError = require('../utils/http-error');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new HttpError(400, 'Validation failed', details);
    }

    req.body = result.data;
    next();
  };
}

module.exports = validate;
