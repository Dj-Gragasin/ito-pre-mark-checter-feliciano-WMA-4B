// add_missing_subscription_columns.js
// Run with: node scripts/add_missing_subscription_columns.js

require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE || process.env.DATABASE || process.env.DATABASE_URL && undefined,
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await pool.connect();

    const stmts = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end DATE;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(100);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_until DATE;",
      // Additional columns used by the subscription/payment flow
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_start DATE;",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_type VARCHAR(100);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_price NUMERIC(10,2);",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS next_payment DATE;",
    ];

    console.log('Applying migration statements...');
    for (const s of stmts) {
      console.log('> ' + s.trim());
      await pool.query(s);
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
