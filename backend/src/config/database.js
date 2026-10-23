'use strict';

const mysql = require('mysql2/promise');
const config = require('./env');

/** Shared connection pool. All queries use placeholders (prepared statements). */
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
});

/**
 * Runs `work(connection)` inside a transaction, committing on success and
 * rolling back on any thrown error. The connection is always released.
 */
async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function ping() {
  await pool.query('SELECT 1');
}

module.exports = { pool, withTransaction, ping };
