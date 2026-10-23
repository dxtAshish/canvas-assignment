'use strict';

const { pool } = require('../config/database');

const COLUMNS = 'd.id, d.user_id, d.name, d.description, d.canvas_width, d.background_color, d.version, d.sort_order, d.created_at, d.updated_at';

const toDashboard = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description,
  canvasWidth: row.canvas_width,
  backgroundColor: row.background_color,
  version: row.version,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.section_count !== undefined && {
    sectionCount: Number(row.section_count),
    elementCount: Number(row.element_count),
  }),
});

async function listByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS},
            (SELECT COUNT(*) FROM sections s WHERE s.dashboard_id = d.id) AS section_count,
            (SELECT COUNT(*) FROM elements e JOIN sections s ON s.id = e.section_id
              WHERE s.dashboard_id = d.id) AS element_count
       FROM dashboards d
      WHERE d.user_id = ?
      ORDER BY d.sort_order ASC, d.updated_at DESC, d.id DESC`,
    [userId],
  );
  return rows.map(toDashboard);
}

/**
 * Ownership is enforced in the query itself: a dashboard owned by someone
 * else is indistinguishable from a missing one (no ID enumeration).
 */
async function findByIdForUser(id, userId, executor = pool, { forUpdate = false } = {}) {
  const [rows] = await executor.execute(
    `SELECT ${COLUMNS} FROM dashboards d WHERE d.id = ? AND d.user_id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, userId],
  );
  return toDashboard(rows[0]) || null;
}

/** New dashboards are placed first (before the user's current first item). */
async function create(userId, { name, description, canvasWidth, backgroundColor }) {
  const [result] = await pool.execute(
    `INSERT INTO dashboards (user_id, name, description, canvas_width, background_color, sort_order)
     SELECT ?, ?, ?, ?, ?, COALESCE(MIN(sort_order), 1) - 1 FROM dashboards WHERE user_id = ?`,
    [userId, name, description, canvasWidth, backgroundColor, userId],
  );
  return findByIdForUser(result.insertId, userId);
}

const UPDATABLE = {
  name: 'name',
  description: 'description',
  canvasWidth: 'canvas_width',
  backgroundColor: 'background_color',
};

async function update(id, userId, fields, executor = pool) {
  const entries = Object.entries(fields).filter(([key]) => key in UPDATABLE);
  const assignments = entries.map(([key]) => `${UPDATABLE[key]} = ?`);
  assignments.push('version = version + 1');
  await executor.execute(
    `UPDATE dashboards SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    [...entries.map(([, value]) => value), id, userId],
  );
  return findByIdForUser(id, userId, executor);
}

async function remove(id, userId) {
  const [result] = await pool.execute('DELETE FROM dashboards WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

/** Returns which of `ids` belong to the user. */
async function filterOwnedIds(ids, userId, executor = pool) {
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await executor.query(
    `SELECT id FROM dashboards WHERE user_id = ? AND id IN (${placeholders})`,
    [userId, ...ids],
  );
  return new Set(rows.map((row) => row.id));
}

/**
 * Sets sort_order = position in `ids` with one statement. `updated_at = updated_at`
 * keeps the timestamp unchanged: reordering is not a content edit.
 */
async function updateSortOrder(ids, userId, executor = pool) {
  const cases = ids.map(() => 'WHEN ? THEN ?').join(' ');
  const placeholders = ids.map(() => '?').join(', ');
  await executor.query(
    `UPDATE dashboards SET sort_order = CASE id ${cases} END, updated_at = updated_at
      WHERE user_id = ? AND id IN (${placeholders})`,
    [...ids.flatMap((id, index) => [id, index]), userId, ...ids],
  );
}

module.exports = {
  listByUser, findByIdForUser, create, update, remove, filterOwnedIds, updateSortOrder,
};
