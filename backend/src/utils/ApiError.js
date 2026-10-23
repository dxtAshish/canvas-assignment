'use strict';

/**
 * Operational error with an HTTP status, a stable machine-readable code and
 * optional field-level details. Anything that is not an ApiError is treated
 * as an unexpected failure and reported as a generic 500.
 */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Please sign in to continue.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'The requested resource was not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static validation(message, details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  static payloadTooLarge(message) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

module.exports = ApiError;
