'use strict';

const config = require('../config/env');
const authService = require('../services/auth.service');

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true, // not readable from JavaScript (XSS cannot steal the session)
  sameSite: 'strict', // not sent on cross-site requests (CSRF)
  secure: config.cookie.secure,
  path: '/',
});

function startSession(res, user) {
  res.cookie(config.cookie.name, authService.signToken(user), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

async function register(req, res) {
  const user = await authService.register(req.body);
  startSession(res, user);
  res.status(201).json({ data: user });
}

async function login(req, res) {
  const user = await authService.login(req.body);
  startSession(res, user);
  res.json({ data: user });
}

function logout(_req, res) {
  res.clearCookie(config.cookie.name, cookieOptions());
  res.status(204).end();
}

function me(req, res) {
  res.json({ data: req.user });
}

module.exports = { register, login, logout, me };
