/**
 * Migration Runner Script
 *
 * Reads SQL files from /migrations in numeric order.
 * Skips already-applied migrations by checking schema_migrations table.
 *
 * Usage:
 *   node scripts/migrate.js
 *   npm run migrate
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const client = await db.connect();

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM schema_migrations WHERE filename = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Skipping (already applied): ${file}`);
        continue;
      }

      console.log(`🔄 Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log('\n✅ All migrations complete.');
  } finally {
    client.release();
    await db.end();
  }
}

runMigrations().catch((err) => {
  console.error('❌ Migration runner error:', err);
  process.exit(1);
});
