import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createPool, migrate } from '@gearbay/common';

/**
 * Starts a throwaway Postgres in Docker and applies a service's migrations. Integration tests use a
 * real database because the guarantees under test (exclusion constraints, advisory and row locks)
 * live in Postgres and cannot be faked.
 */
export async function startPostgres(migrationsDir, { maxConnections = 10 } = {}) {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const pool = createPool({ connectionString: container.getConnectionUri(), max: maxConnections });
  await migrate(pool, migrationsDir);
  return {
    pool,
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
}

export const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

/** Cache that always reads through, for tests that don't need Redis. */
export const noCache = { get: (_dealer, _date, load) => load(), evict: async () => {} };
