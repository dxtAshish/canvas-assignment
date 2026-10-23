'use strict';

const { pool } = require('../config/database');

const toUser = (row) => row && ({
  id: row.id,
  name: row.name,
  email: row.email,
  createdAt: row.created_at,
});

async function findByEmailWithPassword(email) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  if (!rows[0]) return null;
  return { ...toUser(rows[0]), passwordHash: rows[0].password_hash };
}

async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1',
    [id],
  );
  return toUser(rows[0]) || null;
}

async function create({ name, email, passwordHash }) {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash],
  );
  return findById(result.insertId);
}

module.exports = { findByEmailWithPassword, findById, create };
