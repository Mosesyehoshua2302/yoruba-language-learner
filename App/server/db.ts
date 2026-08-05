import './env';
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'yoruba_learner',
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
