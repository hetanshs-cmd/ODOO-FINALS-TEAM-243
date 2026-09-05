/**
 * Development Seed Script
 *
 * Populates the database with development data for testing.
 * This must NEVER run in production.
 *
 * Usage:
 *   node scripts/seed.js
 *   npm run seed
 */

const { Pool } = require('pg');
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seed script must not run in production!');
  process.exit(1);
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await db.connect();

  try {
    console.log('🌱 Running seeds...');

    // TODO: Add seed data after Phase 0 defines the schema.
    // Example:
    //
    // await client.query(`
    //   INSERT INTO users (email, password, name, role)
    //   VALUES ($1, $2, $3, $4)
    //   ON CONFLICT (email) DO NOTHING
    // `, ['admin@example.com', '$2b$12$hashedpassword', 'Admin', 'admin']);

    console.log('✅ Seeds complete.');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

seed().catch((err) => {
  console.error('❌ Seed runner error:', err);
  process.exit(1);
});
