'use strict';

const ApiError = require('../utils/ApiError');

const JOI_OPTIONS = { abortEarly: false, stripUnknown: true, convert: true };

/** Converts Joi error details into `[{ field, message }]` for clients. */
const formatDetails = (error) => error.details.map((d) => ({
  field: d.path.join('.'),
  message: d.message.replace(/"/g, ''),
}));

/**
 * Request validation middleware factory.
 * Usage: validate({ body: schema, params: schema, query: schema })
 * Validated (coerced + stripped) values are exposed on `req.validated`;
 * `req.body` is also replaced so controllers never see unvalidated input.
 */
module.exports = function validate(schemas) {
  return (req, _res, next) => {
    req.validated = req.validated || {};
    const details = [];

    for (const [part, schema] of Object.entries(schemas)) {
      const { value, error } = schema.validate(req[part] ?? {}, JOI_OPTIONS);
      if (error) {
        details.push(...formatDetails(error));
      } else {
        req.validated[part] = value;
      }
    }

    if (details.length) {
      return next(ApiError.validation('Some fields are invalid. Please review and try again.', details));
    }
    if (req.validated.body) req.body = req.validated.body;
    return next();
  };
};

module.exports.formatDetails = formatDetails;
