'use strict';

const config = require('../config/env');

/* Minimal leveled logger; only errors are printed during automated tests. */
const write = (level, args) => {
  if (config.isTest && level !== 'error') return;
  // eslint-disable-next-line no-console
  console[level](`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args);
};

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
};
