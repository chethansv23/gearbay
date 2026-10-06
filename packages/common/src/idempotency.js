import { withTransaction } from './db.js';

/**
 * Idempotent consumer. Records the event id in `processed_event` in the same transaction as the
 * handler's work, so a redelivered event (outbox retry, consumer rebalance) is skipped instead of
 * being applied twice. The handler receives the transaction's client and must use it.
 *
 * @returns true if the handler ran, false if the event had already been processed
 */
export async function processOnce(pool, eventId, handler) {
  return withTransaction(pool, async (client) => {
    const { rowCount } = await client.query(
      'insert into processed_event (event_id) values ($1) on conflict do nothing', [eventId]);
    if (rowCount === 0) return false;
    await handler(client);
    return true;
  });
}
