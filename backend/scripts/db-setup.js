'use strict';

/**
 * Creates the database, applies the schema and loads sample data.
 *   npm run db:setup         -> idempotent (safe to run repeatedly)
 *   npm run db:reset         -> drops the database first (DESTROYS DATA)
 *   node scripts/db-setup.js --no-seed   -> schema only
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config/env');
const migrations = require('../database/migrations');

const args = new Set(process.argv.slice(2));
const DB_DIR = path.join(__dirname, '../database');
const SAMPLE_IMAGE = { from: path.join(DB_DIR, 'assets/sample-banner.png'), name: 'sample-banner-0001.png' };

/** The SQL files target `dashboard_builder`; rewrite to the configured DB_NAME (validated as [A-Za-z0-9_]). */
const readSql = (file) => fs.readFileSync(path.join(DB_DIR, file), 'utf8')
  .replace(/\bdashboard_builder\b/g, config.db.database);

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    if (args.has('--reset')) {
      console.log(`Dropping database "${config.db.database}"...`);
      await connection.query(`DROP DATABASE IF EXISTS \`${config.db.database}\``);
    }

    console.log('Applying schema...');
    await connection.query(readSql('schema.sql'));

    // Upgrade databases created with an older schema (each migration is idempotent).
    for (const migration of migrations) {
      if (await migration.up(connection, config.db.database)) console.log(`Migrated: ${migration.description}`);
    }

    if (!args.has('--no-seed')) {
      console.log('Loading sample data...');
      await connection.query(readSql('seed.sql'));

      fs.mkdirSync(config.uploads.dir, { recursive: true });
      const target = path.join(config.uploads.dir, SAMPLE_IMAGE.name);
      fs.copyFileSync(SAMPLE_IMAGE.from, target);
      const { size } = fs.statSync(target);
      await connection.query(
        `UPDATE \`${config.db.database}\`.uploads SET size_bytes = ? WHERE stored_name = ?`,
        [size, SAMPLE_IMAGE.name],
      );
      console.log('Demo account: demo@example.com / Demo@1234');
    }
    console.log(`Database "${config.db.database}" is ready.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(`Database setup failed: ${err.code || ''} ${err.message}`);
  process.exit(1);
});
