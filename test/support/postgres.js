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
      // pool.end() resolves once every connection has been asked to close, not once they have closed.
      // Stopping Postgres in that window kills the open connections, and each one raises an unhandled
      // 57P01 (admin_shutdown) that fails the run even though every test passed. So wait for them all.
      await closeAllConnections(pool);
      await container.stop();
    },
  };
}

/** Ends the pool and resolves only when every connection has really closed (the pool emits `remove` for each). */
async function closeAllConnections(pool) {
  let open = pool.totalCount;
  const closed = new Promise((resolve) => {
    if (open === 0) resolve();
    pool.on('remove', () => { if (--open === 0) resolve(); });
  });
  await pool.end();
  await closed;
}

export const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

/** Cache that always reads through, for tests that don't need Redis. */
export const noCache = { get: (_dealer, _date, load) => load(), evict: async () => {} };
