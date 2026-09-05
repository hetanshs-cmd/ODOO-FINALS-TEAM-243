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
const bcrypt = require('bcrypt');
require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seed script must not run in production!');
  process.exit(1);
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Dev-only password for every seeded user below. Never used outside a
// local/dev database — do not reuse this pattern for real credentials.
const DEV_PASSWORD = 'DevPassword123!';

async function seedUser(client, { name, email, roleName }) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, Number(process.env.BCRYPT_ROUNDS) || 10);

  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, status, role_id)
     SELECT $1, $2, $3, 'ACTIVE', roles.id FROM roles WHERE roles.name = $4
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, passwordHash, roleName],
  );

  if (rows[0]) {
    return rows[0].id;
  }
  // Already existed — look it up so callers (e.g. the customer link below) still work.
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  return existing.rows[0].id;
}

async function seed() {
  const client = await db.connect();

  try {
    console.log('🌱 Running seeds...');

    // One internal user per role that logs in via POST /auth/login.
    await seedUser(client, { name: 'Dev Admin', email: 'admin@dev.local', roleName: 'ADMIN' });
    await seedUser(client, { name: 'Dev Sales Rep', email: 'rep@dev.local', roleName: 'SALES_REP' });
    await seedUser(client, {
      name: 'Dev Sales Manager',
      email: 'manager@dev.local',
      roleName: 'SALES_MANAGER',
    });

    // One customer + a portal user linked to it, for POST /portal/request-link.
    const customerResult = await client.query(
      `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
       SELECT 'Dev Test Customer', 'DEV-CUST-001', customer_tiers.id, 'ACTIVE'
       FROM customer_tiers WHERE customer_tiers.name = 'SILVER'
       ON CONFLICT (customer_code) DO NOTHING
       RETURNING id`,
    );
    const customerId = customerResult.rows[0]
      ? customerResult.rows[0].id
      : (await client.query("SELECT id FROM customers WHERE customer_code = 'DEV-CUST-001'")).rows[0].id;

    const portalUserId = await seedUser(client, {
      name: 'Dev Portal Customer',
      email: 'portal@dev.local',
      roleName: 'CUSTOMER',
    });

    await client.query(
      `INSERT INTO customer_users (customer_id, user_id, designation, status)
       VALUES ($1, $2, 'Primary Contact', 'ACTIVE')
       ON CONFLICT (customer_id, user_id) DO NOTHING`,
      [customerId, portalUserId],
    );

    console.log(`✅ Seeds complete. Dev password for all seeded users: ${DEV_PASSWORD}`);
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
