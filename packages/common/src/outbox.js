import { randomUUID } from 'node:crypto';
import { EventHeaders, OUTBOX_DEFAULTS } from './constants/index.js';

/**
 * Transactional outbox: instead of publishing to Kafka directly (which can succeed while the DB
 * commit fails, or vice versa), the event is written to `outbox_event` with the same client, inside
 * the same transaction as the state change. The relay ships it to Kafka afterwards.
 */
export async function appendOutbox(client, { topic, aggregateType, aggregateId, eventType, payload }) {
  await client.query(
    `insert into outbox_event (id, topic, aggregate_type, aggregate_id, event_type, payload)
     values ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), topic, aggregateType, String(aggregateId), eventType, JSON.stringify(payload)],
  );
}

/**
 * Polls unpublished rows and sends them to Kafka. `FOR UPDATE SKIP LOCKED` lets several instances
 * relay in parallel without sending the same row twice at once. Delivery is at-least-once: if a
 * send fails the batch is rolled back and retried, which is why every consumer is idempotent.
 */
export function startOutboxRelay({ pool, producer, logger,
  intervalMs = OUTBOX_DEFAULTS.POLL_INTERVAL_MS, batchSize = OUTBOX_DEFAULTS.BATCH_SIZE }) {
  let stopped = false;
  let timer;

  async function relayBatch() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `select id, topic, aggregate_id, event_type, payload::text as payload
         from outbox_event where published_at is null
         order by created_at limit $1 for update skip locked`, [batchSize]);
      if (rows.length > 0) {
        const byTopic = Map.groupBy(rows, (r) => r.topic);
        await producer.sendBatch({
          acks: -1,
          topicMessages: [...byTopic].map(([topic, events]) => ({
            topic,
            messages: events.map((e) => ({
              key: e.aggregate_id,
              value: e.payload,
              headers: { [EventHeaders.EVENT_ID]: e.id, [EventHeaders.EVENT_TYPE]: e.event_type },
            })),
          })),
        });
        await client.query('update outbox_event set published_at = now() where id = any($1)', [rows.map((r) => r.id)]);
      }
      await client.query('commit');
      return rows.length;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function tick() {
    if (stopped) return;
    try {
      const sent = await relayBatch();
      if (sent > 0) logger.debug({ sent }, 'Relayed outbox events');
    } catch (error) {
      logger.warn({ err: error.message }, 'Outbox relay failed, will retry');
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }

  const purge = setInterval(() => {
    pool.query(`delete from outbox_event where published_at < now() - make_interval(days => $1)`,
      [OUTBOX_DEFAULTS.RETENTION_DAYS]).catch(() => {});
  }, OUTBOX_DEFAULTS.PURGE_INTERVAL_MS);

  timer = setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
    clearInterval(purge);
  };
}
