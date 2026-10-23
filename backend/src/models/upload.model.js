'use strict';

const { pool } = require('../config/database');

async function create({ userId, storedName, originalName, mimeType, sizeBytes }) {
  const [result] = await pool.execute(
    `INSERT INTO uploads (user_id, stored_name, original_name, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, storedName, originalName, mimeType, sizeBytes],
  );
  return { id: result.insertId, storedName, originalName, mimeType, sizeBytes };
}

async function findByStoredNameForUser(storedName, userId) {
  const [rows] = await pool.execute(
    'SELECT id, stored_name, mime_type FROM uploads WHERE stored_name = ? AND user_id = ? LIMIT 1',
    [storedName, userId],
  );
  return rows[0] ? { id: rows[0].id, storedName: rows[0].stored_name, mimeType: rows[0].mime_type } : null;
}

/** Returns the subset of `storedNames` that belong to the user. */
async function filterOwnedNames(storedNames, userId, executor = pool) {
  if (storedNames.length === 0) return new Set();
  const placeholders = storedNames.map(() => '?').join(', ');
  const [rows] = await executor.query(
    `SELECT stored_name FROM uploads WHERE user_id = ? AND stored_name IN (${placeholders})`,
    [userId, ...storedNames],
  );
  return new Set(rows.map((row) => row.stored_name));
}

module.exports = { create, findByStoredNameForUser, filterOwnedNames };
