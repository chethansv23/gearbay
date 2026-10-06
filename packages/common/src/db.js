import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Pool, types } = pg;

// bigint ids (bigserial) fit comfortably in a JS number here; return them as numbers, not strings.
types.setTypeParser(20, Number);

export function createPool({ database, max = 10, connectionString } = {}) {
  if (connectionString) return new Pool({ connectionString, max });
  return new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5434),
    user: process.env.DB_USER ?? 'gearbay',
    password: process.env.DB_PASSWORD ?? 'gearbay',
    database,
    max,
  });
}

/** Runs `work(client)` in a transaction: commit on success, rollback on any error. */
export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Minimal migration runner: applies `NNN_name.sql` files in order, once each, recording them in
 * `schema_migrations`. An advisory lock stops two instances migrating at the same time.
 */
export async function migrate(pool, migrationsDir) {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  await withTransaction(pool, async (client) => {
    await client.query('select pg_advisory_xact_lock(424242)');
    await client.query(`create table if not exists schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`);
    const { rows } = await client.query('select name from schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files.filter((f) => !applied.has(f))) {
      await client.query(await readFile(path.join(migrationsDir, file), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
    }
  });
}

export function hasSqlState(error, sqlState) {
  return error?.code === sqlState;
}
