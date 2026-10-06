import path from 'node:path';
import {
  EventTypes, Topics, createApp, createKafka, createLogger, createPool, ensureTopics, migrate, processOnce,
  runConsumer, startOutboxRelay,
} from '@gearbay/common';
import { CONSUMER_GROUP, DATABASE, DEFAULT_PORT, SERVICE_NAME } from './constants/index.js';
import { createInventoryService } from './inventoryService.js';
import { inventoryRoutes } from './routes.js';

const logger = createLogger(SERVICE_NAME);
const pool = createPool({ database: DATABASE });
await migrate(pool, path.join(import.meta.dirname, '../migrations'));

const kafka = createKafka(SERVICE_NAME);
await ensureTopics(kafka);
const producer = kafka.producer({ idempotent: true });
await producer.connect();
startOutboxRelay({ pool, producer, logger });

const service = createInventoryService({ pool, logger });
// Repair-order events are keyed by repair-order id, so a request, completion and cancellation for
// the same order land on one partition and are handled in the order they happened.
const handlers = {
  [EventTypes.PARTS_RESERVATION_REQUESTED]: (client, e) => service.reserve(client, e),
  [EventTypes.REPAIR_ORDER_COMPLETED]: (client, e) => service.consumeFor(client, e.repairOrderId),
  [EventTypes.REPAIR_ORDER_CANCELLED]: (client, e) => service.releaseFor(client, e.repairOrderId),
};
await runConsumer({
  kafka, producer, logger, groupId: CONSUMER_GROUP, topics: [Topics.REPAIR_ORDER_EVENTS],
  handle: async (event) => {
    const handler = handlers[event.eventType];
    if (handler) await processOnce(pool, event.eventId, (client) => handler(client, event.payload));
  },
});

const app = createApp({ logger, routes: inventoryRoutes({ service }), health: () => pool.query('select 1') });
const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => logger.info({ port }, `${SERVICE_NAME} listening`));
