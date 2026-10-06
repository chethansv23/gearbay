import path from 'node:path';
import {
  ALL_TOPICS, createApp, createKafka, createLogger, createPool, ensureTopics, migrate, parse, processOnce, runConsumer,
} from '@gearbay/common';
import { z } from 'zod';
import { CONSUMER_GROUP, DATABASE, DEFAULT_LIST_LIMIT, DEFAULT_PORT, MAX_LIST_LIMIT, SERVICE_NAME } from './constants/index.js';
import { createNotificationService, loggingSender } from './notificationService.js';

const logger = createLogger(SERVICE_NAME);
const pool = createPool({ database: DATABASE });
await migrate(pool, path.join(import.meta.dirname, '../migrations'));

const kafka = createKafka(SERVICE_NAME);
await ensureTopics(kafka);
const producer = kafka.producer();
await producer.connect();

const service = createNotificationService({ pool, sender: loggingSender(logger) });
await runConsumer({
  kafka, producer, logger, groupId: CONSUMER_GROUP, topics: ALL_TOPICS,
  handle: (event) => processOnce(pool, event.eventId, (client) => service.handle(client, event)),
});

const ListQuery = z.object({
  recipient: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});
const routes = (app) => app.get('/api/notifications', async (req, res) => res.json(await service.list(parse(ListQuery, req.query))));
const app = createApp({ logger, routes, health: () => pool.query('select 1') });
const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => logger.info({ port }, `${SERVICE_NAME} listening`));
