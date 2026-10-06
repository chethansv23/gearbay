import path from 'node:path';
import {
  EventTypes, Topics, createApp, createKafka, createLogger, createPool, ensureTopics, migrate, processOnce,
  runConsumer, startOutboxRelay,
} from '@gearbay/common';
import { CONSUMER_GROUP, DATABASE, DEFAULT_PORT, SERVICE_NAME } from './constants/index.js';
import { createRepairOrderService } from './repairOrderService.js';
import { repairOrderRoutes } from './routes.js';

const logger = createLogger(SERVICE_NAME);
const pool = createPool({ database: DATABASE });
await migrate(pool, path.join(import.meta.dirname, '../migrations'));

const kafka = createKafka(SERVICE_NAME);
await ensureTopics(kafka);
const producer = kafka.producer({ idempotent: true });
await producer.connect();
startOutboxRelay({ pool, producer, logger });

const service = createRepairOrderService({ pool, logger });
const handlers = {
  [EventTypes.APPOINTMENT_CHECKED_IN]: service.openFromCheckIn,
  [EventTypes.PARTS_RESERVED]: service.onPartsReserved,
  [EventTypes.PARTS_RESERVATION_FAILED]: service.onPartsReservationFailed,
};
await runConsumer({
  kafka, producer, logger, groupId: CONSUMER_GROUP,
  topics: [Topics.APPOINTMENT_EVENTS, Topics.INVENTORY_EVENTS],
  handle: async (event) => {
    const handler = handlers[event.eventType];
    if (handler) await processOnce(pool, event.eventId, (client) => handler(client, event.payload));
  },
});

const app = createApp({ logger, routes: repairOrderRoutes({ service }), health: () => pool.query('select 1') });
const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => logger.info({ port }, `${SERVICE_NAME} listening`));
