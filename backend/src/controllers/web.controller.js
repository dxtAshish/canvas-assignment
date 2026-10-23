'use strict';

const path = require('path');
const config = require('../config/env');

function home(_req, res) {
  res.redirect('/dashboards');
}

/** Sends one of the built frontend HTML pages (auth guarding happens client-side via /api/auth/me). */
const page = (file) => (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(config.frontendDist, file));
};

module.exports = { home, page };
