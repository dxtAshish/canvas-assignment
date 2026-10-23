'use strict';

const { pool } = require('../config/database');

const toSection = (row) => ({
  id: row.id,
  title: row.title,
  x: row.pos_x,
  y: row.pos_y,
  width: row.width,
  height: row.height,
  zIndex: row.z_index,
  backgroundColor: row.background_color,
});

async function listByDashboard(dashboardId, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, title, pos_x, pos_y, width, height, z_index, background_color
       FROM sections WHERE dashboard_id = ? ORDER BY z_index, id`,
    [dashboardId],
  );
  return rows.map(toSection);
}

async function deleteByDashboard(dashboardId, executor = pool) {
  await executor.execute('DELETE FROM sections WHERE dashboard_id = ?', [dashboardId]);
}

async function create(dashboardId, section, executor = pool) {
  const [result] = await executor.execute(
    `INSERT INTO sections (dashboard_id, title, pos_x, pos_y, width, height, z_index, background_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [dashboardId, section.title, section.x, section.y, section.width, section.height, section.zIndex, section.backgroundColor],
  );
  return result.insertId;
}

module.exports = { listByDashboard, deleteByDashboard, create };
