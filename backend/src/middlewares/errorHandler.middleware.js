'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const isApiRequest = (req) => req.originalUrl.startsWith('/api/');

/** Maps known library/framework errors to ApiError so clients get useful messages. */
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiError.payloadTooLarge(`Image is too large. Maximum size is ${config.uploads.maxBytes / 1024 / 1024} MB.`);
    }
    return ApiError.badRequest(`Upload failed: ${err.message}.`, [{ field: err.field || 'image', message: err.message }]);
  }
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Request body contains invalid JSON.');
  if (err.type === 'entity.too.large') return ApiError.payloadTooLarge('Request body is too large.');
  if (err.code === 'ER_DUP_ENTRY') return ApiError.conflict('This record already exists.');
  if (['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(err.code)) {
    const unavailable = new ApiError(503, 'DATABASE_UNAVAILABLE', 'The database is currently unavailable. Please try again shortly.');
    unavailable.cause = err;
    return unavailable;
  }
  return null;
}

function notFound(req, _res, next) {
  next(ApiError.notFound(isApiRequest(req) ? `Route ${req.method} ${req.path} does not exist.` : 'Page not found.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const known = normalize(err);
  const status = known?.status || 500;

  if (!known || status >= 500) logger.error(`${req.method} ${req.originalUrl}`, known?.cause || err);

  const body = {
    error: {
      code: known?.code || 'INTERNAL_ERROR',
      // Internal error details are never leaked to clients.
      message: known?.message || 'Something went wrong on our side. Please try again.',
      ...(known?.details && { details: known.details }),
    },
  };

  if (res.headersSent) return undefined;
  if (isApiRequest(req)) return res.status(status).json(body);

  // Browser navigation: use the frontend's 404 page when the build is present.
  const notFoundPage = path.join(config.frontendDist, '404.html');
  if (status === 404 && fs.existsSync(notFoundPage)) return res.status(404).sendFile(notFoundPage);
  return res.status(status).type('text/plain').send(`${status} - ${body.error.message}`);
}

module.exports = { notFound, errorHandler };
