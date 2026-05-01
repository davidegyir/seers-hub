import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString, {
  ssl: 'require',
});

async function main() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free'
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS reason TEXT
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, feature_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS features (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      feature_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price NUMERIC(12,2) DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_access_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      tier_to_grant TEXT,
      feature_key TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(product_id, tier_to_grant, feature_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      flutterwave_tx_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  const defaultFeatures = [
    { feature_key: 'pc_course', name: 'Purpose Compass Course', description: 'Access to Purpose Compass course materials' },
    { feature_key: 'gwb_program', name: 'GWB Programme', description: 'Access to Graduate Wealth Builder programme' },
    { feature_key: 'ai_workshop', name: 'AI Workshop', description: 'Access to AI workshop materials' },
    { feature_key: 'midweek_live', name: 'Midweek Live', description: 'Access to Midweek Live sessions' },
    { feature_key: 'premium_articles', name: 'Premium Articles', description: 'Access to premium article content' },
    { feature_key: 'sbc_tools', name: 'SBC Tools', description: 'Access to Smart Business Card tools' },
  ];

  for (const feature of defaultFeatures) {
    await sql`
      INSERT INTO features (feature_key, name, description, is_active, created_at, updated_at)
      VALUES (${feature.feature_key}, ${feature.name}, ${feature.description}, true, NOW(), NOW())
      ON CONFLICT (feature_key)
      DO NOTHING
    `;
  }

  const defaultProducts = [
    { product_key: 'premium_membership', name: 'Premium Membership', description: 'Premium access tier', price: 99, currency: 'USD' },
    { product_key: 'pc_course_purchase', name: 'Purpose Compass Purchase', description: 'Single-product access to Purpose Compass', price: 49, currency: 'USD' },
    { product_key: 'ai_workshop_ticket', name: 'AI Workshop Ticket', description: 'Single-product access to AI Workshop', price: 29, currency: 'USD' },
  ];

  for (const product of defaultProducts) {
    await sql`
      INSERT INTO products (product_key, name, description, price, currency, is_active, created_at, updated_at)
      VALUES (
        ${product.product_key},
        ${product.name},
        ${product.description},
        ${product.price},
        ${product.currency},
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (product_key)
      DO NOTHING
    `;
  }

  const products = await sql`
    SELECT id, product_key
    FROM products
  `;

  const productMap = new Map(products.map((p) => [p.product_key, p.id]));

  const defaultRules = [
    { product_key: 'premium_membership', tier_to_grant: 'premium', feature_key: null },
    { product_key: 'pc_course_purchase', tier_to_grant: null, feature_key: 'pc_course' },
    { product_key: 'ai_workshop_ticket', tier_to_grant: null, feature_key: 'ai_workshop' },
  ];

  for (const rule of defaultRules) {
    const productId = productMap.get(rule.product_key);
    if (!productId) continue;

    await sql`
      INSERT INTO product_access_rules (product_id, tier_to_grant, feature_key, created_at)
      VALUES (${productId}, ${rule.tier_to_grant}, ${rule.feature_key}, NOW())
      ON CONFLICT DO NOTHING
    `;
  }

  console.log('Database setup completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});