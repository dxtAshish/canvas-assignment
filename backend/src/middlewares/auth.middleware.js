'use strict';

const config = require('../config/env');
const authService = require('../services/auth.service');
const userModel = require('../models/user.model');
const ApiError = require('../utils/ApiError');

/** Resolves the signed-in user from the httpOnly session cookie (or null). */
async function resolveUser(req) {
  const userId = authService.verifyToken(req.cookies?.[config.cookie.name]);
  if (!userId) return null;
  return userModel.findById(userId); // also rejects tokens of deleted users
}

/** API guard: responds 401 JSON when not authenticated. */
async function requireAuth(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) return next(ApiError.unauthorized());
  req.user = user;
  return next();
}

/**
 * Page guard for the server-served frontend pages: redirects to login when not
 * authenticated (avoids rendering a protected page shell for anonymous users).
 */
async function requirePageAuth(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    const target = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${target}`);
  }
  req.user = user;
  return next();
}

/** For login/register pages: signed-in users go straight to their dashboards. */
async function redirectIfAuthenticated(req, res, next) {
  const user = await resolveUser(req);
  if (user) return res.redirect('/dashboards');
  return next();
}

module.exports = { requireAuth, requirePageAuth, redirectIfAuthenticated };
