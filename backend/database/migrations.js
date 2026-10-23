'use strict';

/**
 * Incremental schema changes for databases created with an older schema.sql.
 * Fresh installs already get these from schema.sql; every migration therefore
 * checks the current state first, so running them repeatedly is safe.
 */

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [database, table, column],
  );
  return rows.length > 0;
}

module.exports = [
  {
    id: '001_dashboard_sort_order',
    description: 'Add dashboards.sort_order for drag-and-drop ordering',
    async up(conn, database) {
      if (await columnExists(conn, database, 'dashboards', 'sort_order')) return false;
      await conn.query(`ALTER TABLE \`${database}\`.dashboards
        ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER version,
        ADD KEY idx_dashboards_user_order (user_id, sort_order)`);
      // Keep the previous visible order (most recently updated first).
      await conn.query(`UPDATE \`${database}\`.dashboards d
        JOIN (SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) - 1 AS pos
                FROM \`${database}\`.dashboards) ranked ON ranked.id = d.id
         SET d.sort_order = ranked.pos, d.updated_at = d.updated_at`);
      return true;
    },
  },
];
