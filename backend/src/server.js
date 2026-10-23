'use strict';

const fs = require('fs');
const config = require('./config/env');
const app = require('./app');
const { pool, ping } = require('./config/database');
const logger = require('./utils/logger');

fs.mkdirSync(config.uploads.dir, { recursive: true });

async function start() {
  try {
    await ping();
    logger.info(`Connected to MySQL at ${config.db.host}:${config.db.port}/${config.db.database}`);
  } catch (err) {
    logger.error(`Could not connect to MySQL (${err.code || err.message}). Check DB_* settings in .env and run "npm run db:setup".`);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info(`Dashboard Builder running at http://localhost:${config.port}`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));

start();
