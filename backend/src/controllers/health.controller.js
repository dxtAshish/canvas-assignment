'use strict';

const { ping } = require('../config/database');

/** Liveness + database connectivity check. */
async function check(_req, res) {
  await ping();
  res.json({ data: { status: 'ok', time: new Date().toISOString() } });
}

module.exports = { check };
