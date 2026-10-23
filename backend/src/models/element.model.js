'use strict';

const { pool } = require('../config/database');

const parseContent = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

const toElement = (row) => ({
  id: row.id,
  sectionId: row.section_id,
  type: row.type,
  x: row.pos_x,
  y: row.pos_y,
  width: row.width,
  height: row.height,
  zIndex: row.z_index,
  content: parseContent(row.content),
});

async function listByDashboard(dashboardId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT e.id, e.section_id, e.type, e.pos_x, e.pos_y, e.width, e.height, e.z_index, e.content
       FROM elements e
       JOIN sections s ON s.id = e.section_id
      WHERE s.dashboard_id = ?
      ORDER BY e.z_index, e.id`,
    [dashboardId],
  );
  return rows.map(toElement);
}

/** Inserts many elements with a single multi-row statement. */
async function bulkCreate(elements, executor = pool) {
  if (elements.length === 0) return;
  const placeholders = elements.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = elements.flatMap((el) => [
    el.sectionId, el.type, el.x, el.y, el.width, el.height, el.zIndex, JSON.stringify(el.content),
  ]);
  await executor.query(
    `INSERT INTO elements (section_id, type, pos_x, pos_y, width, height, z_index, content) VALUES ${placeholders}`,
    values,
  );
}

module.exports = { listByDashboard, bulkCreate };
