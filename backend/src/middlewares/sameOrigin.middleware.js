'use strict';

const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Strict cookies): state-changing
 * requests that carry an Origin header must come from this host or from one of
 * the configured client origins (e.g. the Vite dev server).
 */
module.exports = function sameOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients (curl, tests) do not send Origin
  try {
    if (new URL(origin).host === req.get('host') || config.clientOrigins.includes(origin)) return next();
  } catch {
    /* malformed origin falls through to rejection */
  }
  return next(ApiError.forbidden('Cross-origin request blocked.'));
};
