import './env';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const targetDb = process.env.PGDATABASE ?? 'yoruba_learner';
const baseConfig = {
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
};

async function ensureDatabase() {
  // Connect to the maintenance DB — you can't create/check a database from
  // within a connection to that same database.
  const admin = new Client({ ...baseConfig, database: 'postgres' });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (rowCount === 0) {
      const quotedName = `"${targetDb.replace(/"/g, '""')}"`;
      await admin.query(`CREATE DATABASE ${quotedName}`);
      console.log(`Created database "${targetDb}"`);
    } else {
      console.log(`Database "${targetDb}" already exists`);
    }
  } finally {
    await admin.end();
  }
}

async function applySchema() {
  const client = new Client({ ...baseConfig, database: targetDb });
  await client.connect();
  try {
    const sql = readFileSync(path.join(dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('Applied schema.sql');
  } finally {
    await client.end();
  }
}

await ensureDatabase();
await applySchema();
console.log('Database setup complete.');
