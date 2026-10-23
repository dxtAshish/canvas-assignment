'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const limitMessage = (message) => ({ error: { code: 'TOO_MANY_REQUESTS', message } });

/** Brute-force protection for credential endpoints. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: limitMessage('Too many attempts. Please wait 15 minutes and try again.'),
});

/** General API ceiling to absorb abusive clients. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 10000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: limitMessage('Too many requests. Please slow down.'),
});

module.exports = { authLimiter, apiLimiter };
