/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Client } = require('pg');

async function main() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !database) {
    console.error('Missing DB env vars. Need DB_HOST, DB_USER, DB_NAME (and usually DB_PASSWORD).');
    process.exit(1);
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: String(host).includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  const reg = await client.query("SELECT to_regclass('public.equipment') AS equipment;");
  const tableName = reg.rows?.[0]?.equipment ?? null;

  console.log('equipment:', tableName);

  if (tableName) {
    const cols = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='equipment' ORDER BY ordinal_position;"
    );

    console.log(
      'columns:',
      cols.rows.map((c) => `${c.column_name}:${c.data_type}${c.is_nullable === 'NO' ? '' : '?'}`).join(', ')
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error('DB check failed:', err?.message || err);
  process.exit(1);
});
