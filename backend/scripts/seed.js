/**
 * Development Seed Script
 *
 * Populates the database with development data for testing: users across
 * every role/status, customers across every tier/status, the full product
 * catalog, and a business-object graph (quotations, approvals, negotiations,
 * sales orders, fulfillment, billing, subscriptions, deal health, etc.)
 * that touches every CHECK-constrained status/type value in the schema.
 *
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

/** Select-then-insert-if-missing. Keeps re-runs of this script a no-op. */
async function getOrInsert(client, selectSql, selectParams, insertSql, insertParams) {
  const existing = await client.query(selectSql, selectParams);
  if (existing.rows[0]) {
    return { id: existing.rows[0].id, created: false };
  }
  const { rows } = await client.query(insertSql, insertParams);
  return { id: rows[0].id, created: true };
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function isoDaysFromNow(n) {
  return daysFromNow(n).toISOString();
}

async function seedUser(client, { name, email, roleName, status = 'ACTIVE' }) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, Number(process.env.BCRYPT_ROUNDS) || 10);

  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, status, role_id)
     SELECT $1, $2, $3, $4, roles.id FROM roles WHERE roles.name = $5
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, passwordHash, status, roleName],
  );

  if (rows[0]) {
    return rows[0].id;
  }
  // Already existed — look it up so callers (e.g. the customer link below) still work.
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  return existing.rows[0].id;
}

async function seedCustomer(client, { companyName, code, tierName, status = 'ACTIVE' }) {
  const result = await client.query(
    `INSERT INTO customers (company_name, customer_code, customer_tier_id, status)
     SELECT $1, $2, customer_tiers.id, $3
     FROM customer_tiers WHERE customer_tiers.name = $4
     ON CONFLICT (customer_code) DO NOTHING
     RETURNING id`,
    [companyName, code, status, tierName],
  );
  if (result.rows[0]) {
    return result.rows[0].id;
  }
  const existing = await client.query('SELECT id FROM customers WHERE customer_code = $1', [code]);
  return existing.rows[0].id;
}

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

async function seedCategory(client, name, parentId, description) {
  return getOrInsert(
    client,
    'SELECT id FROM product_categories WHERE name = $1 AND parent_category_id IS NOT DISTINCT FROM $2',
    [name, parentId],
    `INSERT INTO product_categories (name, description, parent_category_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, description ?? null, parentId],
  );
}

async function seedProduct(client, p) {
  return getOrInsert(
    client,
    'SELECT id FROM products WHERE sku = $1',
    [p.sku],
    `INSERT INTO products (sku, name, description, category_id, product_type, base_price, cost_price, unit, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [p.sku, p.name, p.description ?? null, p.categoryId, p.productType, p.basePrice, p.costPrice ?? null, p.unit, p.status ?? 'ACTIVE'],
  );
}

async function seedPriceList(client, pl) {
  return getOrInsert(
    client,
    'SELECT id FROM price_lists WHERE name = $1',
    [pl.name],
    `INSERT INTO price_lists (name, currency, customer_tier_id, valid_from, valid_until, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [pl.name, pl.currency, pl.tierId ?? null, pl.validFrom, pl.validUntil ?? null, pl.status],
  );
}

async function seedPriceListItem(client, pli) {
  return getOrInsert(
    client,
    'SELECT id FROM price_list_items WHERE price_list_id = $1 AND product_id = $2',
    [pli.priceListId, pli.productId],
    `INSERT INTO price_list_items (price_list_id, product_id, price, min_quantity, max_quantity)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [pli.priceListId, pli.productId, pli.price, pli.minQty ?? null, pli.maxQty ?? null],
  );
}

async function seedAddress(client, a) {
  return getOrInsert(
    client,
    'SELECT id FROM addresses WHERE customer_id = $1 AND type = $2',
    [a.customerId, a.type],
    `INSERT INTO addresses (customer_id, type, address_line_1, address_line_2, city, state, country, postal_code, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [a.customerId, a.type, a.line1, a.line2 ?? null, a.city, a.state, a.country, a.postalCode, a.isDefault ?? false],
  );
}

async function seedWarehouse(client, w) {
  return getOrInsert(
    client,
    'SELECT id FROM warehouses WHERE code = $1',
    [w.code],
    `INSERT INTO warehouses (name, code, address_id, manager_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [w.name, w.code, w.addressId ?? null, w.managerId ?? null, w.status ?? 'ACTIVE'],
  );
}

async function seedInventory(client, inv) {
  return getOrInsert(
    client,
    'SELECT id FROM inventory WHERE warehouse_id = $1 AND product_id = $2',
    [inv.warehouseId, inv.productId],
    `INSERT INTO inventory (warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_level)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [inv.warehouseId, inv.productId, inv.onHand, inv.reserved ?? 0, inv.reorderLevel ?? 0],
  );
}

async function seedDiscountRule(client, r) {
  return getOrInsert(
    client,
    'SELECT id FROM discount_rules WHERE name = $1',
    [r.name],
    `INSERT INTO discount_rules (name, priority, product_id, category_id, customer_tier_id, sales_role, min_discount, max_discount, approval_required, approval_level, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      r.name, r.priority ?? 0, r.productId ?? null, r.categoryId ?? null, r.tierId ?? null,
      r.salesRole ?? null, r.minDiscount, r.maxDiscount, r.approvalRequired ?? false, r.approvalLevel ?? null, r.active ?? true,
    ],
  );
}

async function seedRecommendationRule(client, r) {
  return getOrInsert(
    client,
    'SELECT id FROM recommendation_rules WHERE source_product_id = $1 AND recommended_product_id = $2 AND recommendation_type = $3',
    [r.sourceId, r.recommendedId, r.type],
    `INSERT INTO recommendation_rules (source_product_id, recommended_product_id, recommendation_type, priority, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [r.sourceId, r.recommendedId, r.type, r.priority ?? 0, r.reason ?? null, r.status ?? 'ACTIVE'],
  );
}

// ---------------------------------------------------------------------------
// Quotation graph helpers
// ---------------------------------------------------------------------------

async function seedQuotation(client, q) {
  const { id, created } = await getOrInsert(
    client,
    'SELECT id FROM quotations WHERE quotation_number = $1',
    [q.number],
    `INSERT INTO quotations (quotation_number, customer_id, sales_rep_id, price_list_id, status, currency, valid_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [q.number, q.customerId, q.salesRepId, q.priceListId ?? null, q.status, q.currency ?? 'INR', q.validUntil ?? null],
  );
  let itemIds = [];
  if (created) {
    for (const item of q.items) {
      const { rows } = await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, description, quantity, unit_price, discount_percent, tax_percent, billing_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [id, item.productId, item.description ?? null, item.quantity, item.unitPrice, item.discountPercent ?? 0, item.taxPercent ?? 0, item.billingType],
      );
      itemIds.push(rows[0].id);
    }
  } else {
    const existing = await client.query('SELECT id FROM quotation_items WHERE quotation_id = $1 ORDER BY id', [id]);
    itemIds = existing.rows.map((r) => r.id);
  }
  return { id, created, itemIds };
}

async function seedSalesOrder(client, so) {
  const { id, created } = await getOrInsert(
    client,
    'SELECT id FROM sales_orders WHERE order_number = $1',
    [so.number],
    `INSERT INTO sales_orders (order_number, quotation_id, customer_id, sales_rep_id, status, order_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [so.number, so.quotationId, so.customerId, so.salesRepId, so.status, so.orderDate ?? dateOnly(new Date())],
  );
  let itemIds = [];
  if (created) {
    for (const item of so.items) {
      const { rows } = await client.query(
        `INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, discount, tax_percent, fulfilled_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [id, item.productId, item.quantity, item.unitPrice, item.discount ?? 0, item.taxPercent ?? 0, item.fulfilledQuantity ?? 0],
      );
      itemIds.push(rows[0].id);
    }
  } else {
    const existing = await client.query('SELECT id FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id', [id]);
    itemIds = existing.rows.map((r) => r.id);
  }
  return { id, created, itemIds };
}

async function seedInvoice(client, inv) {
  const { id, created } = await getOrInsert(
    client,
    'SELECT id FROM invoices WHERE invoice_number = $1',
    [inv.number],
    `INSERT INTO invoices (invoice_number, customer_id, sales_order_id, quotation_id, invoice_type, status, due_date, issued_at, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      inv.number, inv.customerId, inv.salesOrderId ?? null, inv.quotationId ?? null,
      inv.type, inv.status, inv.dueDate ?? null, inv.issuedAt ?? null, inv.paidAt ?? null,
    ],
  );
  if (created) {
    for (const item of inv.items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, tax_percent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, item.productId ?? null, item.description, item.quantity, item.unitPrice, item.taxPercent ?? 0],
      );
    }
  }
  return { id, created };
}

async function seedSubscriptionPlan(client, p) {
  return getOrInsert(
    client,
    'SELECT id FROM subscription_plans WHERE name = $1',
    [p.name],
    `INSERT INTO subscription_plans (name, description, billing_frequency, price, trial_days, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [p.name, p.description ?? null, p.frequency, p.price, p.trialDays ?? 0, p.status ?? 'ACTIVE'],
  );
}

async function seedSubscription(client, s) {
  const { id, created } = await getOrInsert(
    client,
    'SELECT id FROM subscriptions WHERE customer_id = $1 AND plan_id = $2 AND start_date = $3',
    [s.customerId, s.planId, s.startDate],
    `INSERT INTO subscriptions (customer_id, sales_order_id, quotation_id, plan_id, status, start_date, end_date, next_billing_date, current_price)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      s.customerId, s.salesOrderId ?? null, s.quotationId ?? null, s.planId,
      s.status, s.startDate, s.endDate ?? null, s.nextBillingDate ?? null, s.currentPrice,
    ],
  );
  if (created) {
    for (const item of s.items) {
      await client.query(
        `INSERT INTO subscription_items (subscription_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [id, item.productId, item.quantity, item.unitPrice],
      );
    }
  }
  return { id, created };
}

async function seed() {
  const client = await db.connect();

  try {
    console.log('🌱 Running seeds...');

    // -------------------------------------------------------------------
    // Users — one per role, plus one non-ACTIVE user to cover every
    // users.status value (ACTIVE / INACTIVE / SUSPENDED).
    // -------------------------------------------------------------------
    const adminId = await seedUser(client, { name: 'Dev Admin', email: 'admin@dev.local', roleName: 'ADMIN' });
    const repId = await seedUser(client, { name: 'Dev Sales Rep', email: 'rep@dev.local', roleName: 'SALES_REP' });
    const managerId = await seedUser(client, {
      name: 'Dev Sales Manager',
      email: 'manager@dev.local',
      roleName: 'SALES_MANAGER',
    });
    const financeId = await seedUser(client, { name: 'Dev Finance', email: 'finance@dev.local', roleName: 'FINANCE' });
    const opsId = await seedUser(client, { name: 'Dev Operations', email: 'ops@dev.local', roleName: 'OPERATIONS' });
    await seedUser(client, {
      name: 'Dev Suspended Rep',
      email: 'suspended.rep@dev.local',
      roleName: 'SALES_REP',
      status: 'SUSPENDED',
    });
    await seedUser(client, {
      name: 'Dev Inactive Finance',
      email: 'inactive.finance@dev.local',
      roleName: 'FINANCE',
      status: 'INACTIVE',
    });

    // -------------------------------------------------------------------
    // Customers — one per tier, plus INACTIVE/SUSPENDED to cover every
    // customers.status value. Each gets a portal user linked via
    // users.customer_id.
    // -------------------------------------------------------------------
    const customerId = await seedCustomer(client, {
      companyName: 'Dev Test Customer',
      code: 'DEV-CUST-001',
      tierName: 'SILVER',
    });
    const portalUserId = await seedUser(client, { name: 'Dev Portal Customer', email: 'portal@dev.local', roleName: 'CUSTOMER' });
    // customer_users was folded into users.customer_id by the 2026-09-05
    // schema refactor — link the portal user directly on the users row.
    await client.query('UPDATE users SET customer_id = $1 WHERE id = $2', [customerId, portalUserId]);

    // Second demo customer + portal user for the "Customer (Meridian)" quick
    // login button — a distinct tenant so the demo shows real per-customer
    // portal scoping instead of reusing the DEV-CUST-001 account.
    const meridianId = await seedCustomer(client, { companyName: 'Meridian Industrial', code: 'MERIDIAN-001', tierName: 'GOLD' });
    const meridianUserId = await seedUser(client, {
      name: 'Priya Nair',
      email: 'priya.nair@meridianindustrial.com',
      roleName: 'CUSTOMER',
    });
    await client.query('UPDATE users SET customer_id = $1 WHERE id = $2', [meridianId, meridianUserId]);

    // Third demo customer + portal user for the "Customer (Acme Corp)" quick
    // login button.
    const acmeId = await seedCustomer(client, { companyName: 'Acme Corp', code: 'ACME-001', tierName: 'BRONZE' });
    const acmeUserId = await seedUser(client, { name: 'Vikram Mehta', email: 'v.mehta@acmecorp.com', roleName: 'CUSTOMER' });
    await client.query('UPDATE users SET customer_id = $1 WHERE id = $2', [acmeId, acmeUserId]);

    // Fourth and fifth customers, non-ACTIVE, so customers.status hits
    // every value (ACTIVE / INACTIVE / SUSPENDED) and the PLATINUM tier is
    // exercised at least once.
    const northwindId = await seedCustomer(client, {
      companyName: 'Northwind Trading',
      code: 'NORTHWIND-001',
      tierName: 'PLATINUM',
      status: 'INACTIVE',
    });
    const globexId = await seedCustomer(client, {
      companyName: 'Globex Ltd',
      code: 'GLOBEX-001',
      tierName: 'BRONZE',
      status: 'SUSPENDED',
    });
    void northwindId;
    void globexId;

    await seedAddress(client, {
      customerId,
      type: 'BILLING',
      line1: '100 Ledger Ave',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      postalCode: '78701',
      isDefault: true,
    });
    await seedAddress(client, {
      customerId,
      type: 'SHIPPING',
      line1: '200 Dock St',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      postalCode: '78702',
    });
    await seedAddress(client, {
      customerId,
      type: 'OFFICE',
      line1: '300 Suite Blvd',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      postalCode: '78703',
    });

    // -------------------------------------------------------------------
    // Everything below (catalog + full business-object graph) is guarded
    // by a single marker check so re-running this script is a no-op.
    // -------------------------------------------------------------------
    const marker = await client.query("SELECT 1 FROM quotations WHERE quotation_number = 'Q-SEED-DRAFT'");
    if (marker.rows.length > 0) {
      console.log('ℹ️  Extended demo dataset already present — skipping catalog/business-object seeding.');
      console.log(`✅ Seeds complete. Dev password for all seeded users: ${DEV_PASSWORD}`);
      return;
    }

    // ---------------------------------------------------------------
    // Product categories (nested)
    // ---------------------------------------------------------------
    const hardware = (await seedCategory(client, 'Hardware', null)).id;
    const servers = (await seedCategory(client, 'Servers', hardware)).id;
    const networking = (await seedCategory(client, 'Networking', hardware)).id;
    const software = (await seedCategory(client, 'Software', null)).id;
    const licenses = (await seedCategory(client, 'Licenses', software)).id;
    const services = (await seedCategory(client, 'Services', null)).id;
    const consulting = (await seedCategory(client, 'Consulting', services)).id;
    const support = (await seedCategory(client, 'Support', services)).id;
    const subscriptionsCat = (await seedCategory(client, 'Subscriptions', null)).id;
    const saasPlans = (await seedCategory(client, 'SaaS Plans', subscriptionsCat)).id;

    // ---------------------------------------------------------------
    // Products — covers product_type (ONE_TIME/RECURRING) and status
    // (ACTIVE/INACTIVE/DISCONTINUED) across every category.
    // ---------------------------------------------------------------
    const srv100 = (await seedProduct(client, {
      sku: 'SKU-SRV-100', name: 'Rack Server X100', categoryId: servers,
      productType: 'ONE_TIME', basePrice: 373500, costPrice: 265600, unit: 'unit', status: 'ACTIVE',
    })).id;
    const srv200 = (await seedProduct(client, {
      sku: 'SKU-SRV-200', name: 'Blade Server X200', categoryId: servers,
      productType: 'ONE_TIME', basePrice: 680600, costPrice: 506300, unit: 'unit', status: 'ACTIVE',
    })).id;
    const net100 = (await seedProduct(client, {
      sku: 'SKU-NET-100', name: 'Enterprise Switch 48-port', categoryId: networking,
      productType: 'ONE_TIME', basePrice: 99600, costPrice: 66400, unit: 'unit', status: 'ACTIVE',
    })).id;
    const net200 = (await seedProduct(client, {
      sku: 'SKU-NET-200', name: 'Legacy Router R1', categoryId: networking,
      productType: 'ONE_TIME', basePrice: 24900, costPrice: 12450, unit: 'unit', status: 'DISCONTINUED',
    })).id;
    const lic100 = (await seedProduct(client, {
      sku: 'SKU-LIC-100', name: 'ERP Suite License', categoryId: licenses,
      productType: 'ONE_TIME', basePrice: 207500, costPrice: 74700, unit: 'seat', status: 'ACTIVE',
    })).id;
    const lic200 = (await seedProduct(client, {
      sku: 'SKU-LIC-200', name: 'Analytics Add-on License', categoryId: licenses,
      productType: 'ONE_TIME', basePrice: 62250, costPrice: 20750, unit: 'seat', status: 'INACTIVE',
    })).id;
    const con100 = (await seedProduct(client, {
      sku: 'SKU-CON-100', name: 'Implementation Consulting', categoryId: consulting,
      productType: 'ONE_TIME', basePrice: 14940, costPrice: 7470, unit: 'hour', status: 'ACTIVE',
    })).id;
    const sup100 = (await seedProduct(client, {
      sku: 'SKU-SUP-100', name: 'Premium Support Plan', categoryId: support,
      productType: 'RECURRING', basePrice: 41500, costPrice: 16600, unit: 'month', status: 'ACTIVE',
    })).id;
    const sup200 = (await seedProduct(client, {
      sku: 'SKU-SUP-200', name: 'Standard Support Plan', categoryId: support,
      productType: 'RECURRING', basePrice: 16600, costPrice: 6640, unit: 'month', status: 'ACTIVE',
    })).id;
    const saas100 = (await seedProduct(client, {
      sku: 'SKU-SAAS-100', name: 'CloudSuite Pro', categoryId: saasPlans,
      productType: 'RECURRING', basePrice: 8217, costPrice: 2490, unit: 'seat', status: 'ACTIVE',
    })).id;
    const saas200 = (await seedProduct(client, {
      sku: 'SKU-SAAS-200', name: 'CloudSuite Basic', categoryId: saasPlans,
      productType: 'RECURRING', basePrice: 3237, costPrice: 996, unit: 'seat', status: 'ACTIVE',
    })).id;
    const saas300 = (await seedProduct(client, {
      sku: 'SKU-SAAS-300', name: 'CloudSuite Legacy', categoryId: saasPlans,
      productType: 'RECURRING', basePrice: 1577, costPrice: 415, unit: 'seat', status: 'DISCONTINUED',
    })).id;

    // ---------------------------------------------------------------
    // Price lists — covers price_lists.status (ACTIVE/INACTIVE/EXPIRED).
    // ---------------------------------------------------------------
    const standardList = (await seedPriceList(client, {
      name: 'Standard Price List', currency: 'INR', validFrom: '2025-01-01', status: 'ACTIVE',
    })).id;
    const goldList = (await seedPriceList(client, {
      name: 'Gold Tier Pricing', currency: 'INR', tierId: null, validFrom: '2025-01-01', status: 'ACTIVE',
    })).id;
    // Resolve GOLD tier id for scoping (kept separate from the insert above
    // to avoid an extra join in the helper).
    const goldTier = await client.query("SELECT id FROM customer_tiers WHERE name = 'GOLD'");
    await client.query('UPDATE price_lists SET customer_tier_id = $1 WHERE id = $2', [goldTier.rows[0].id, goldList]);
    const legacyList = (await seedPriceList(client, {
      name: '2024 Legacy Pricing', currency: 'INR', validFrom: '2024-01-01', validUntil: '2024-12-31', status: 'INACTIVE',
    })).id;
    const promoList = (await seedPriceList(client, {
      name: 'Q1 2025 Promo', currency: 'INR', validFrom: '2025-01-01', validUntil: '2025-03-31', status: 'EXPIRED',
    })).id;

    await seedPriceListItem(client, { priceListId: standardList, productId: srv100, price: 356900, minQty: 1 });
    await seedPriceListItem(client, { priceListId: standardList, productId: lic100, price: 195050, minQty: 1, maxQty: 50 });
    await seedPriceListItem(client, { priceListId: goldList, productId: srv100, price: 323700 });
    await seedPriceListItem(client, { priceListId: goldList, productId: lic100, price: 174300, minQty: 5 });
    await seedPriceListItem(client, { priceListId: legacyList, productId: net200, price: 23240 });
    await seedPriceListItem(client, { priceListId: promoList, productId: saas100, price: 6557, minQty: 1, maxQty: 20 });

    // ---------------------------------------------------------------
    // Warehouses & inventory — covers warehouses.status and a spread of
    // stock levels (healthy, low/below-reorder, and out-of-stock).
    // ---------------------------------------------------------------
    const mainWh = (await seedWarehouse(client, { name: 'Main Distribution Center', code: 'WH-MAIN', managerId: opsId, status: 'ACTIVE' })).id;
    const westWh = (await seedWarehouse(client, { name: 'West Coast Hub', code: 'WH-WEST', managerId: opsId, status: 'ACTIVE' })).id;
    const oldWh = (await seedWarehouse(client, { name: 'Retired Facility', code: 'WH-OLD', status: 'INACTIVE' })).id;
    void oldWh;

    await seedInventory(client, { warehouseId: mainWh, productId: srv100, onHand: 50, reserved: 10, reorderLevel: 20 });
    await seedInventory(client, { warehouseId: mainWh, productId: srv200, onHand: 5, reserved: 5, reorderLevel: 10 });
    await seedInventory(client, { warehouseId: mainWh, productId: net100, onHand: 0, reserved: 0, reorderLevel: 15 });
    await seedInventory(client, { warehouseId: westWh, productId: srv100, onHand: 20, reserved: 0, reorderLevel: 10 });
    await seedInventory(client, { warehouseId: westWh, productId: net100, onHand: 100, reserved: 20, reorderLevel: 30 });

    // ---------------------------------------------------------------
    // Discount rules — global, category, tier, and product scoped, plus
    // one inactive rule.
    // ---------------------------------------------------------------
    await seedDiscountRule(client, { name: 'Global Default Ceiling', priority: 0, minDiscount: 0, maxDiscount: 15 });
    await seedDiscountRule(client, {
      name: 'Servers Category Ceiling', priority: 1, categoryId: servers,
      minDiscount: 0, maxDiscount: 20, approvalRequired: true, approvalLevel: 1,
    });
    await seedDiscountRule(client, {
      name: 'Gold Tier Ceiling', priority: 1, tierId: goldTier.rows[0].id,
      minDiscount: 0, maxDiscount: 25, approvalRequired: true, approvalLevel: 2,
    });
    await seedDiscountRule(client, { name: 'ERP License Product Rule', priority: 2, productId: lic100, minDiscount: 0, maxDiscount: 10 });
    await seedDiscountRule(client, {
      name: 'Deprecated Promo Rule', priority: 0, minDiscount: 0, maxDiscount: 50,
      approvalRequired: true, approvalLevel: 3, active: false,
    });

    // ---------------------------------------------------------------
    // Recommendation rules — UPSELL / CROSS_SELL, ACTIVE / INACTIVE.
    // ---------------------------------------------------------------
    await seedRecommendationRule(client, { sourceId: srv100, recommendedId: srv200, type: 'UPSELL', priority: 1, reason: 'Higher capacity for growing workloads' });
    await seedRecommendationRule(client, { sourceId: srv100, recommendedId: sup100, type: 'CROSS_SELL', priority: 2, reason: 'Attach a support plan' });
    await seedRecommendationRule(client, { sourceId: lic100, recommendedId: con100, type: 'CROSS_SELL', priority: 1, reason: 'Implementation help for new licenses' });
    await seedRecommendationRule(client, { sourceId: saas200, recommendedId: saas100, type: 'UPSELL', priority: 1, reason: 'More seats and features', status: 'INACTIVE' });

    // ---------------------------------------------------------------
    // Approval levels (from migration 022 reference data).
    // ---------------------------------------------------------------
    const levels = await client.query('SELECT id, level FROM approval_levels ORDER BY level');
    const level1 = levels.rows.find((l) => l.level === 1).id;
    const level2 = levels.rows.find((l) => l.level === 2).id;
    const level3 = levels.rows.find((l) => l.level === 3).id;

    // ---------------------------------------------------------------
    // Quotations — one per status, covering all 12 CHECK values.
    // ---------------------------------------------------------------
    const qDraft = await seedQuotation(client, {
      number: 'Q-SEED-DRAFT', customerId, salesRepId: repId, priceListId: standardList,
      status: 'DRAFT', validUntil: dateOnly(daysFromNow(30)),
      items: [{ productId: lic100, quantity: 2, unitPrice: 207500, discountPercent: 5, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSubmitted = await seedQuotation(client, {
      number: 'Q-SEED-SUBMITTED', customerId, salesRepId: repId, priceListId: standardList,
      status: 'SUBMITTED', validUntil: dateOnly(daysFromNow(30)),
      items: [{ productId: srv100, quantity: 1, unitPrice: 373500, discountPercent: 8, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qPendingApproval = await seedQuotation(client, {
      number: 'Q-SEED-PENDING-APPROVAL', customerId, salesRepId: repId, priceListId: goldList,
      status: 'PENDING_APPROVAL', validUntil: dateOnly(daysFromNow(30)),
      items: [{ productId: srv200, quantity: 2, unitPrice: 680600, discountPercent: 22, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qApproved = await seedQuotation(client, {
      number: 'Q-SEED-APPROVED', customerId: meridianId, salesRepId: repId,
      status: 'APPROVED', validUntil: dateOnly(daysFromNow(30)),
      items: [{ productId: sup100, quantity: 12, unitPrice: 41500, discountPercent: 5, taxPercent: 0, billingType: 'RECURRING' }],
    });
    const qRejected = await seedQuotation(client, {
      number: 'Q-SEED-REJECTED', customerId: acmeId, salesRepId: repId,
      status: 'REJECTED', validUntil: dateOnly(daysFromNow(30)),
      items: [{ productId: srv200, quantity: 3, unitPrice: 680600, discountPercent: 35, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSent = await seedQuotation(client, {
      number: 'Q-SEED-SENT', customerId, salesRepId: repId,
      status: 'SENT_TO_CUSTOMER', validUntil: dateOnly(daysFromNow(20)),
      items: [{ productId: con100, quantity: 40, unitPrice: 14940, discountPercent: 0, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qNegotiation = await seedQuotation(client, {
      number: 'Q-SEED-NEGOTIATION', customerId: meridianId, salesRepId: repId,
      status: 'NEGOTIATION', validUntil: dateOnly(daysFromNow(15)),
      items: [{ productId: lic100, quantity: 10, unitPrice: 207500, discountPercent: 12, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qAccepted = await seedQuotation(client, {
      number: 'Q-SEED-ACCEPTED', customerId: acmeId, salesRepId: repId,
      status: 'ACCEPTED', validUntil: dateOnly(daysFromNow(10)),
      items: [{ productId: saas100, quantity: 25, unitPrice: 8217, discountPercent: 10, taxPercent: 0, billingType: 'RECURRING' }],
    });
    const qDeclined = await seedQuotation(client, {
      number: 'Q-SEED-DECLINED', customerId, salesRepId: repId,
      status: 'DECLINED', validUntil: dateOnly(daysFromNow(10)),
      items: [{ productId: net200, quantity: 4, unitPrice: 24900, discountPercent: 0, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qExpired = await seedQuotation(client, {
      number: 'Q-SEED-EXPIRED', customerId, salesRepId: repId,
      status: 'EXPIRED', validUntil: dateOnly(daysFromNow(-30)),
      items: [{ productId: saas200, quantity: 15, unitPrice: 3237, discountPercent: 0, taxPercent: 0, billingType: 'RECURRING' }],
    });
    const qCancelled = await seedQuotation(client, {
      number: 'Q-SEED-CANCELLED', customerId, salesRepId: repId,
      status: 'CANCELLED', validUntil: dateOnly(daysFromNow(10)),
      items: [{ productId: net100, quantity: 2, unitPrice: 99600, discountPercent: 5, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qConverted = await seedQuotation(client, {
      number: 'Q-SEED-CONVERTED', customerId, salesRepId: repId,
      status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: srv100, quantity: 1, unitPrice: 373500, discountPercent: 5, taxPercent: 8, billingType: 'ONE_TIME' }],
    });

    // Five more CONVERTED-status quotations dedicated to sales orders in the
    // other five order statuses (a quotation converts to at most one order).
    const qSoPending = await seedQuotation(client, {
      number: 'Q-SEED-SO-PENDING', customerId, salesRepId: repId, status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: srv100, quantity: 1, unitPrice: 373500, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSoConfirmed = await seedQuotation(client, {
      number: 'Q-SEED-SO-CONFIRMED', customerId: meridianId, salesRepId: repId, status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: net100, quantity: 3, unitPrice: 99600, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSoProcessing = await seedQuotation(client, {
      number: 'Q-SEED-SO-PROCESSING', customerId: acmeId, salesRepId: repId, status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: srv100, quantity: 2, unitPrice: 373500, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSoPartial = await seedQuotation(client, {
      number: 'Q-SEED-SO-PARTIAL', customerId, salesRepId: repId, status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: net100, quantity: 10, unitPrice: 99600, taxPercent: 8, billingType: 'ONE_TIME' }],
    });
    const qSoCancelled = await seedQuotation(client, {
      number: 'Q-SEED-SO-CANCELLED', customerId: acmeId, salesRepId: repId, status: 'CONVERTED', validUntil: dateOnly(daysFromNow(5)),
      items: [{ productId: lic100, quantity: 1, unitPrice: 207500, taxPercent: 8, billingType: 'ONE_TIME' }],
    });

    // ---------------------------------------------------------------
    // Discount evaluations — covers decision (AUTO_APPROVED /
    // REQUIRES_APPROVAL / REJECTED) and risk_level (LOW/MEDIUM/HIGH).
    // ---------------------------------------------------------------
    if (qPendingApproval.created) {
      await client.query(
        `INSERT INTO discount_evaluations (quotation_id, quotation_item_id, requested_discount, allowed_discount, risk_score, risk_level, decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [qPendingApproval.id, qPendingApproval.itemIds[0], 22, 20, 55, 'MEDIUM', 'REQUIRES_APPROVAL'],
      );
    }
    if (qApproved.created) {
      await client.query(
        `INSERT INTO discount_evaluations (quotation_id, quotation_item_id, requested_discount, allowed_discount, risk_score, risk_level, decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [qApproved.id, qApproved.itemIds[0], 5, 15, 10, 'LOW', 'AUTO_APPROVED'],
      );
    }
    if (qRejected.created) {
      await client.query(
        `INSERT INTO discount_evaluations (quotation_id, quotation_item_id, requested_discount, allowed_discount, risk_score, risk_level, decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [qRejected.id, qRejected.itemIds[0], 35, 20, 88, 'HIGH', 'REJECTED'],
      );
    }
    if (qNegotiation.created) {
      await client.query(
        `INSERT INTO discount_evaluations (quotation_id, quotation_item_id, requested_discount, allowed_discount, risk_score, risk_level, decision)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [qNegotiation.id, qNegotiation.itemIds[0], 12, 10, 62, 'HIGH', 'REQUIRES_APPROVAL'],
      );
    }

    // ---------------------------------------------------------------
    // Approval requests/actions — covers approval_requests.status
    // (PENDING/APPROVED/REJECTED/ESCALATED/CANCELLED) and
    // approval_actions.action (APPROVED/REJECTED/ESCALATED/COMMENTED/CANCELLED).
    // ---------------------------------------------------------------
    if (qPendingApproval.created) {
      const { rows } = await client.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, assigned_to, approval_level_id, status, reason)
         VALUES ($1, $2, $3, $4, 'PENDING', $5) RETURNING id`,
        [qPendingApproval.id, repId, managerId, level1, 'Discount exceeds sales rep authority'],
      );
      await client.query(
        `INSERT INTO approval_actions (approval_request_id, user_id, action, comment) VALUES ($1, $2, 'COMMENTED', $3)`,
        [rows[0].id, managerId, 'Reviewing customer history before deciding.'],
      );
    }
    if (qApproved.created) {
      const { rows } = await client.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, assigned_to, approval_level_id, status, reason, responded_at)
         VALUES ($1, $2, $3, $4, 'APPROVED', $5, now()) RETURNING id`,
        [qApproved.id, repId, managerId, level1, 'Standard discount, within Gold tier ceiling'],
      );
      await client.query(
        `INSERT INTO approval_actions (approval_request_id, user_id, action, comment) VALUES ($1, $2, 'APPROVED', $3)`,
        [rows[0].id, managerId, 'Looks good, approved.'],
      );
    }
    if (qRejected.created) {
      const { rows } = await client.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, assigned_to, approval_level_id, status, reason, responded_at)
         VALUES ($1, $2, $3, $4, 'REJECTED', $5, now()) RETURNING id`,
        [qRejected.id, repId, financeId, level2, 'Discount well beyond policy ceiling'],
      );
      await client.query(
        `INSERT INTO approval_actions (approval_request_id, user_id, action, comment) VALUES ($1, $2, 'REJECTED', $3)`,
        [rows[0].id, financeId, 'Margin too thin at this discount level.'],
      );
    }
    if (qSent.created) {
      const { rows } = await client.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, assigned_to, approval_level_id, status, reason)
         VALUES ($1, $2, $3, $4, 'ESCALATED', $5) RETURNING id`,
        [qSent.id, repId, adminId, level3, 'Manager unavailable, escalated to executive review'],
      );
      await client.query(
        `INSERT INTO approval_actions (approval_request_id, user_id, action, comment) VALUES ($1, $2, 'ESCALATED', $3)`,
        [rows[0].id, managerId, 'Escalating — outside my approval window.'],
      );
    }
    if (qCancelled.created) {
      const { rows } = await client.query(
        `INSERT INTO approval_requests (quotation_id, requested_by, assigned_to, approval_level_id, status, reason)
         VALUES ($1, $2, $3, $4, 'CANCELLED', $5) RETURNING id`,
        [qCancelled.id, repId, managerId, level1, 'Customer cancelled before approval completed'],
      );
      await client.query(
        `INSERT INTO approval_actions (approval_request_id, user_id, action, comment) VALUES ($1, $2, 'CANCELLED', $3)`,
        [rows[0].id, repId, 'Withdrawing — customer pulled out.'],
      );
    }

    // ---------------------------------------------------------------
    // Negotiations — covers negotiations.status (OPEN/IN_PROGRESS/
    // ACCEPTED/REJECTED/CLOSED) and negotiation_messages.message_type
    // (TEXT/COUNTER_OFFER/SYSTEM).
    // ---------------------------------------------------------------
    if (qNegotiation.created) {
      const { rows } = await client.query(
        `INSERT INTO negotiations (quotation_id, initiated_by, status) VALUES ($1, $2, 'IN_PROGRESS') RETURNING id`,
        [qNegotiation.id, meridianUserId],
      );
      const negId = rows[0].id;
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'SYSTEM')`,
        [negId, repId, 'Negotiation thread opened for Q-SEED-NEGOTIATION.'],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'TEXT')`,
        [negId, meridianUserId, 'Can we get a better rate on the license bundle?'],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'COUNTER_OFFER')`,
        [negId, repId, 'We can offer 15% off if you commit to 10 seats.'],
      );
      await client.query(
        `INSERT INTO negotiation_changes (negotiation_id, quotation_item_id, field_name, old_value, new_value, changed_by)
         VALUES ($1, $2, 'discount_percent', '12', '15', $3)`,
        [negId, qNegotiation.itemIds[0], repId],
      );
    }
    if (qSent.created) {
      const { rows } = await client.query(
        `INSERT INTO negotiations (quotation_id, initiated_by, status) VALUES ($1, $2, 'OPEN') RETURNING id`,
        [qSent.id, portalUserId],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'TEXT')`,
        [rows[0].id, portalUserId, "We'd like to discuss the consulting hours before signing."],
      );
    }
    if (qAccepted.created) {
      const { rows } = await client.query(
        `INSERT INTO negotiations (quotation_id, initiated_by, status, closed_at) VALUES ($1, $2, 'ACCEPTED', now()) RETURNING id`,
        [qAccepted.id, acmeUserId],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'TEXT')`,
        [rows[0].id, acmeUserId, 'Terms look good, accepting as-is.'],
      );
    }
    if (qDeclined.created) {
      const { rows } = await client.query(
        `INSERT INTO negotiations (quotation_id, initiated_by, status, closed_at) VALUES ($1, $2, 'REJECTED', now()) RETURNING id`,
        [qDeclined.id, portalUserId],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'TEXT')`,
        [rows[0].id, portalUserId, 'Going with another vendor for the router refresh.'],
      );
    }
    if (qCancelled.created) {
      const { rows } = await client.query(
        `INSERT INTO negotiations (quotation_id, initiated_by, status, closed_at) VALUES ($1, $2, 'CLOSED', now()) RETURNING id`,
        [qCancelled.id, repId],
      );
      await client.query(
        `INSERT INTO negotiation_messages (negotiation_id, sender_user_id, message, message_type) VALUES ($1, $2, $3, 'SYSTEM')`,
        [rows[0].id, repId, 'Thread closed — quotation was cancelled.'],
      );
    }

    // ---------------------------------------------------------------
    // Sales orders — one per status (PENDING/CONFIRMED/PROCESSING/
    // PARTIALLY_FULFILLED/FULFILLED/CANCELLED).
    // ---------------------------------------------------------------
    const soPending = await seedSalesOrder(client, {
      number: 'SO-SEED-PENDING', quotationId: qSoPending.id, customerId, salesRepId: repId, status: 'PENDING',
      items: [{ productId: srv100, quantity: 1, unitPrice: 373500, taxPercent: 8 }],
    });
    const soConfirmed = await seedSalesOrder(client, {
      number: 'SO-SEED-CONFIRMED', quotationId: qSoConfirmed.id, customerId: meridianId, salesRepId: repId, status: 'CONFIRMED',
      items: [{ productId: net100, quantity: 3, unitPrice: 99600, taxPercent: 8 }],
    });
    const soProcessing = await seedSalesOrder(client, {
      number: 'SO-SEED-PROCESSING', quotationId: qSoProcessing.id, customerId: acmeId, salesRepId: repId, status: 'PROCESSING',
      items: [{ productId: srv100, quantity: 2, unitPrice: 373500, taxPercent: 8, fulfilledQuantity: 1 }],
    });
    const soPartial = await seedSalesOrder(client, {
      number: 'SO-SEED-PARTIAL', quotationId: qSoPartial.id, customerId, salesRepId: repId, status: 'PARTIALLY_FULFILLED',
      items: [{ productId: net100, quantity: 10, unitPrice: 99600, taxPercent: 8, fulfilledQuantity: 6 }],
    });
    const soFulfilled = await seedSalesOrder(client, {
      number: 'SO-SEED-FULFILLED', quotationId: qConverted.id, customerId, salesRepId: repId, status: 'FULFILLED',
      items: [{ productId: srv100, quantity: 1, unitPrice: 373500, discount: 18675, taxPercent: 8, fulfilledQuantity: 1 }],
    });
    const soCancelled = await seedSalesOrder(client, {
      number: 'SO-SEED-CANCELLED', quotationId: qSoCancelled.id, customerId: acmeId, salesRepId: repId, status: 'CANCELLED',
      items: [{ productId: lic100, quantity: 1, unitPrice: 207500, taxPercent: 8 }],
    });

    // ---------------------------------------------------------------
    // Fulfillments/items — covers fulfillments.status and
    // fulfillment_items.status (both 5-value enums).
    // ---------------------------------------------------------------
    if (soConfirmed.created) {
      const { rows } = await client.query(
        `INSERT INTO fulfillments (sales_order_id, warehouse_id, status, scheduled_date) VALUES ($1, $2, 'PENDING', $3) RETURNING id`,
        [soConfirmed.id, mainWh, dateOnly(daysFromNow(3))],
      );
      await client.query(
        `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity, status) VALUES ($1, $2, $3, 'PENDING')`,
        [rows[0].id, soConfirmed.itemIds[0], 3],
      );
    }
    if (soProcessing.created) {
      const { rows } = await client.query(
        `INSERT INTO fulfillments (sales_order_id, warehouse_id, status, scheduled_date) VALUES ($1, $2, 'IN_PROGRESS', $3) RETURNING id`,
        [soProcessing.id, mainWh, dateOnly(daysFromNow(1))],
      );
      await client.query(
        `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity, status) VALUES ($1, $2, $3, 'PACKED')`,
        [rows[0].id, soProcessing.itemIds[0], 1],
      );
    }
    if (soPartial.created) {
      const { rows } = await client.query(
        `INSERT INTO fulfillments (sales_order_id, warehouse_id, status, scheduled_date, fulfilled_date) VALUES ($1, $2, 'SHIPPED', $3, $4) RETURNING id`,
        [soPartial.id, westWh, dateOnly(daysFromNow(-2)), dateOnly(daysFromNow(-1))],
      );
      await client.query(
        `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity, status) VALUES ($1, $2, $3, 'SHIPPED')`,
        [rows[0].id, soPartial.itemIds[0], 6],
      );
      // Remainder becomes a backorder — covers backorders.status values.
      await client.query(
        `INSERT INTO backorders (sales_order_id, sales_order_item_id, product_id, quantity, status, expected_date)
         VALUES ($1, $2, $3, 4, 'OPEN', $4)`,
        [soPartial.id, soPartial.itemIds[0], net100, dateOnly(daysFromNow(14))],
      );
      await client.query(
        `INSERT INTO backorders (sales_order_id, sales_order_item_id, product_id, quantity, status, expected_date)
         VALUES ($1, $2, $3, 2, 'PARTIALLY_FULFILLED', $4)`,
        [soPartial.id, soPartial.itemIds[0], net100, dateOnly(daysFromNow(7))],
      );
      await client.query(
        `INSERT INTO backorders (sales_order_id, sales_order_item_id, product_id, quantity, status, fulfilled_at)
         VALUES ($1, $2, $3, 1, 'FULFILLED', now())`,
        [soPartial.id, soPartial.itemIds[0], net100],
      );
      await client.query(
        `INSERT INTO backorders (sales_order_id, sales_order_item_id, product_id, quantity, status)
         VALUES ($1, $2, $3, 1, 'CANCELLED')`,
        [soPartial.id, soPartial.itemIds[0], net100],
      );
    }
    if (soFulfilled.created) {
      const { rows } = await client.query(
        `INSERT INTO fulfillments (sales_order_id, warehouse_id, status, scheduled_date, fulfilled_date) VALUES ($1, $2, 'DELIVERED', $3, $4) RETURNING id`,
        [soFulfilled.id, mainWh, dateOnly(daysFromNow(-5)), dateOnly(daysFromNow(-3))],
      );
      await client.query(
        `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity, status) VALUES ($1, $2, $3, 'DELIVERED')`,
        [rows[0].id, soFulfilled.itemIds[0], 1],
      );
    }
    if (soCancelled.created) {
      const { rows } = await client.query(
        `INSERT INTO fulfillments (sales_order_id, warehouse_id, status) VALUES ($1, $2, 'CANCELLED') RETURNING id`,
        [soCancelled.id, mainWh],
      );
      await client.query(
        `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity, status) VALUES ($1, $2, $3, 'CANCELLED')`,
        [rows[0].id, soCancelled.itemIds[0], 1],
      );
    }
    void soPending;

    // ---------------------------------------------------------------
    // Invoices/items — covers invoice_type (ONE_TIME/RECURRING) and
    // status (DRAFT/ISSUED/PARTIALLY_PAID/PAID/OVERDUE/VOID).
    // ---------------------------------------------------------------
    const invDraft = await seedInvoice(client, {
      number: 'INV-SEED-DRAFT', customerId, salesOrderId: soPending.id, type: 'ONE_TIME', status: 'DRAFT',
      items: [{ productId: srv100, description: 'Rack Server X100', quantity: 1, unitPrice: 373500, taxPercent: 8 }],
    });
    const invIssued = await seedInvoice(client, {
      number: 'INV-SEED-ISSUED', customerId: meridianId, salesOrderId: soConfirmed.id, type: 'ONE_TIME', status: 'ISSUED',
      dueDate: dateOnly(daysFromNow(30)), issuedAt: isoDaysFromNow(0),
      items: [{ productId: net100, description: 'Enterprise Switch 48-port', quantity: 3, unitPrice: 99600, taxPercent: 8 }],
    });
    const invPartial = await seedInvoice(client, {
      number: 'INV-SEED-PARTIAL', customerId: acmeId, salesOrderId: soProcessing.id, type: 'ONE_TIME', status: 'PARTIALLY_PAID',
      dueDate: dateOnly(daysFromNow(15)), issuedAt: isoDaysFromNow(-10),
      items: [{ productId: srv100, description: 'Rack Server X100', quantity: 2, unitPrice: 373500, taxPercent: 8 }],
    });
    const invPaid = await seedInvoice(client, {
      number: 'INV-SEED-PAID', customerId, salesOrderId: soFulfilled.id, type: 'ONE_TIME', status: 'PAID',
      dueDate: dateOnly(daysFromNow(-5)), issuedAt: isoDaysFromNow(-20), paidAt: isoDaysFromNow(-15),
      items: [{ productId: srv100, description: 'Rack Server X100', quantity: 1, unitPrice: 373500, taxPercent: 8 }],
    });
    const invOverdue = await seedInvoice(client, {
      number: 'INV-SEED-OVERDUE', customerId, salesOrderId: soPartial.id, type: 'ONE_TIME', status: 'OVERDUE',
      dueDate: dateOnly(daysFromNow(-20)), issuedAt: isoDaysFromNow(-50),
      items: [{ productId: net100, description: 'Enterprise Switch 48-port', quantity: 10, unitPrice: 99600, taxPercent: 8 }],
    });
    const invVoid = await seedInvoice(client, {
      number: 'INV-SEED-VOID', customerId, type: 'RECURRING', status: 'VOID',
      dueDate: dateOnly(daysFromNow(-1)), issuedAt: isoDaysFromNow(-3),
      items: [{ productId: sup100, description: 'Premium Support Plan', quantity: 1, unitPrice: 41500, taxPercent: 0 }],
    });

    // ---------------------------------------------------------------
    // Payments — covers status (PENDING/SUCCESS/FAILED/REFUNDED).
    // ---------------------------------------------------------------
    if (invIssued.created) {
      await client.query(
        `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [invIssued.id, meridianId, 322704, 'BANK_TRANSFER', 'SEED-TXN-ISSUED-1'],
      );
    }
    if (invPartial.created) {
      await client.query(
        `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, 'SUCCESS', now())`,
        [invPartial.id, acmeId, 332000, 'CREDIT_CARD', 'SEED-TXN-PARTIAL-1'],
      );
    }
    if (invPaid.created) {
      await client.query(
        `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, 'SUCCESS', $6)`,
        [invPaid.id, customerId, 403380, 'CREDIT_CARD', 'SEED-TXN-PAID-1', isoDaysFromNow(-15)],
      );
      await client.query(
        `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, 'REFUNDED', $6)`,
        [invPaid.id, customerId, 403380, 'CREDIT_CARD', 'SEED-TXN-PAID-REFUND-1', isoDaysFromNow(-2)],
      );
    }
    if (invOverdue.created) {
      await client.query(
        `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status)
         VALUES ($1, $2, $3, $4, $5, 'FAILED')`,
        [invOverdue.id, customerId, 1075680, 'BANK_TRANSFER', 'SEED-TXN-OVERDUE-1'],
      );
    }
    void invDraft;
    void invVoid;

    // ---------------------------------------------------------------
    // Subscriptions — covers billing_frequency (MONTHLY/QUARTERLY/
    // YEARLY), plan status (ACTIVE/INACTIVE), and subscription status
    // (ACTIVE/CANCELLED/MODIFIED).
    // ---------------------------------------------------------------
    const proMonthly = (await seedSubscriptionPlan(client, {
      name: 'Pro Monthly', frequency: 'MONTHLY', price: 8217, trialDays: 14, status: 'ACTIVE',
    })).id;
    const proQuarterly = (await seedSubscriptionPlan(client, {
      name: 'Pro Quarterly', frequency: 'QUARTERLY', price: 22410, status: 'ACTIVE',
    })).id;
    const legacyYearly = (await seedSubscriptionPlan(client, {
      name: 'Legacy Yearly', frequency: 'YEARLY', price: 74700, status: 'INACTIVE',
    })).id;

    const subActive = await seedSubscription(client, {
      customerId, planId: proMonthly, status: 'ACTIVE',
      startDate: dateOnly(daysFromNow(-60)), nextBillingDate: dateOnly(daysFromNow(5)), currentPrice: 8217,
      items: [{ productId: saas100, quantity: 1, unitPrice: 8217 }],
    });
    const subCancelled = await seedSubscription(client, {
      customerId: meridianId, planId: proQuarterly, status: 'CANCELLED',
      startDate: dateOnly(daysFromNow(-200)), endDate: dateOnly(daysFromNow(-10)), currentPrice: 22410,
      items: [{ productId: saas200, quantity: 2, unitPrice: 3237 }],
    });
    const subModified = await seedSubscription(client, {
      customerId: acmeId, planId: legacyYearly, status: 'MODIFIED',
      startDate: dateOnly(daysFromNow(-400)), currentPrice: 70550,
      items: [{ productId: saas300, quantity: 1, unitPrice: 1577 }],
    });

    // ---------------------------------------------------------------
    // Billing schedules — covers status (SCHEDULED/INVOICED/PAID/
    // FAILED/CANCELLED).
    // ---------------------------------------------------------------
    if (subActive.created) {
      await client.query(
        `INSERT INTO billing_schedules (subscription_id, billing_date, amount, status) VALUES ($1, $2, 8217, 'PAID')`,
        [subActive.id, dateOnly(daysFromNow(-25))],
      );
      await client.query(
        `INSERT INTO billing_schedules (subscription_id, billing_date, amount, status, invoice_id) VALUES ($1, $2, 8217, 'INVOICED', $3)`,
        [subActive.id, dateOnly(daysFromNow(0)), invIssued.id],
      );
      await client.query(
        `INSERT INTO billing_schedules (subscription_id, billing_date, amount, status) VALUES ($1, $2, 8217, 'SCHEDULED')`,
        [subActive.id, dateOnly(daysFromNow(35))],
      );
      await client.query(
        `INSERT INTO billing_schedules (subscription_id, billing_date, amount, status) VALUES ($1, $2, 8217, 'FAILED')`,
        [subActive.id, dateOnly(daysFromNow(-55))],
      );
    }
    if (subCancelled.created) {
      await client.query(
        `INSERT INTO billing_schedules (subscription_id, billing_date, amount, status) VALUES ($1, $2, 22410, 'CANCELLED')`,
        [subCancelled.id, dateOnly(daysFromNow(-15))],
      );
    }

    // ---------------------------------------------------------------
    // Credit notes — covers status (PENDING/APPLIED/VOIDED).
    // ---------------------------------------------------------------
    if (subCancelled.created) {
      await client.query(
        `INSERT INTO credit_notes (subscription_id, customer_id, amount, reason, status) VALUES ($1, $2, 7470, $3, 'APPLIED')`,
        [subCancelled.id, meridianId, 'Mid-cycle cancellation refund'],
      );
      await client.query(
        `INSERT INTO credit_notes (subscription_id, customer_id, amount, reason, status) VALUES ($1, $2, 1660, $3, 'VOIDED')`,
        [subCancelled.id, meridianId, 'Duplicate charge reversal, voided in error'],
      );
    }
    if (subModified.created) {
      await client.query(
        `INSERT INTO credit_notes (subscription_id, customer_id, amount, reason, status) VALUES ($1, $2, 4150, $3, 'PENDING')`,
        [subModified.id, acmeId, 'Downgrade credit pending finance review'],
      );
    }

    // ---------------------------------------------------------------
    // Deal health — covers risk_level (LOW/MEDIUM/HIGH) on scores, and
    // alert_type / severity / status on alerts.
    // ---------------------------------------------------------------
    if (qNegotiation.created) {
      await client.query(
        `INSERT INTO deal_health_scores (quotation_id, score, risk_level, discount_risk, negotiation_risk, delay_risk, fulfillment_risk)
         VALUES ($1, 45, 'HIGH', 70, 80, 20, 10)`,
        [qNegotiation.id],
      );
      await client.query(
        `INSERT INTO deal_alerts (quotation_id, alert_type, severity, message, status) VALUES ($1, 'STALLED', 'HIGH', $2, 'OPEN')`,
        [qNegotiation.id, 'No customer response in 10 days.'],
      );
      await client.query(
        `INSERT INTO deal_alerts (quotation_id, alert_type, severity, message, status) VALUES ($1, 'DISCOUNT_ANOMALY', 'CRITICAL', $2, 'ESCALATED')`,
        [qNegotiation.id, 'Requested discount far exceeds historical norm for this account.'],
      );
    }
    if (qApproved.created) {
      await client.query(
        `INSERT INTO deal_health_scores (quotation_id, score, risk_level, discount_risk, negotiation_risk, delay_risk, fulfillment_risk)
         VALUES ($1, 78, 'MEDIUM', 30, 20, 15, 10)`,
        [qApproved.id],
      );
    }
    if (qAccepted.created) {
      await client.query(
        `INSERT INTO deal_health_scores (quotation_id, score, risk_level, discount_risk, negotiation_risk, delay_risk, fulfillment_risk)
         VALUES ($1, 92, 'LOW', 5, 5, 5, 5)`,
        [qAccepted.id],
      );
    }
    if (qConverted.created) {
      await client.query(
        `INSERT INTO deal_alerts (quotation_id, alert_type, severity, message, status, resolved_at)
         VALUES ($1, 'DELIVERY_SLIPPAGE', 'MEDIUM', $2, 'NUDGED', NULL)`,
        [qConverted.id, 'Fulfillment scheduled later than the quoted delivery window.'],
      );
    }
    if (qPendingApproval.created) {
      await client.query(
        `INSERT INTO deal_alerts (quotation_id, alert_type, severity, message, status, resolved_at)
         VALUES ($1, 'DISCOUNT_ANOMALY', 'LOW', $2, 'RESOLVED', now())`,
        [qPendingApproval.id, 'Minor deviation from tier ceiling, cleared on review.'],
      );
    }

    // ---------------------------------------------------------------
    // Notifications — mix of types and read states across users.
    // ---------------------------------------------------------------
    if (qPendingApproval.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'APPROVAL_REQUESTED', 'New approval request', $2, 'quotation', $3, false)`,
        [managerId, 'Q-SEED-PENDING-APPROVAL needs your approval.', qPendingApproval.id],
      );
    }
    if (qSubmitted.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'QUOTATION_SUBMITTED', 'Quotation submitted', $2, 'quotation', $3, true)`,
        [managerId, 'Q-SEED-SUBMITTED was submitted for review.', qSubmitted.id],
      );
    }
    if (invOverdue.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'INVOICE_OVERDUE', 'Invoice overdue', $2, 'invoice', $3, false)`,
        [financeId, 'INV-SEED-OVERDUE is past due.', invOverdue.id],
      );
    }
    if (qSent.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'QUOTATION_SENT', 'New quotation', $2, 'quotation', $3, false)`,
        [portalUserId, 'You have a new quotation to review.', qSent.id],
      );
    }
    if (qNegotiation.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'NEGOTIATION_MESSAGE', 'New negotiation message', $2, 'quotation', $3, true)`,
        [meridianUserId, 'Your sales rep countered your offer.', qNegotiation.id],
      );
    }
    if (soFulfilled.created) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, is_read)
         VALUES ($1, 'ORDER_SHIPPED', 'Order shipped', $2, 'sales_order', $3, false)`,
        [repId, 'SO-SEED-FULFILLED has been delivered.', soFulfilled.id],
      );
    }

    // ---------------------------------------------------------------
    // Audit logs — append-only, a handful of representative entries.
    // ---------------------------------------------------------------
    if (qDraft.created) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'CREATE', 'quotation', $2, NULL, $3)`,
        [repId, qDraft.id, JSON.stringify({ status: 'DRAFT' })],
      );
    }
    if (qApproved.created) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'STATUS_CHANGE', 'quotation', $2, $3, $4)`,
        [managerId, qApproved.id, JSON.stringify({ status: 'PENDING_APPROVAL' }), JSON.stringify({ status: 'APPROVED' })],
      );
    }
    if (soFulfilled.created) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'STATUS_CHANGE', 'sales_order', $2, $3, $4)`,
        [opsId, soFulfilled.id, JSON.stringify({ status: 'PROCESSING' }), JSON.stringify({ status: 'FULFILLED' })],
      );
    }
    if (invPaid.created) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'STATUS_CHANGE', 'invoice', $2, $3, $4)`,
        [financeId, invPaid.id, JSON.stringify({ status: 'ISSUED' }), JSON.stringify({ status: 'PAID' })],
      );
    }
    if (subCancelled.created) {
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, 'STATUS_CHANGE', 'subscription', $2, $3, $4)`,
        [adminId, subCancelled.id, JSON.stringify({ status: 'ACTIVE' }), JSON.stringify({ status: 'CANCELLED' })],
      );
    }

    console.log('✅ Extended demo dataset seeded: catalog, quotations, approvals, negotiations, orders, fulfillment, billing, subscriptions, deal health.');
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
