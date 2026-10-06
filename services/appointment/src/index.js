import path from 'node:path';
import {
  createApp, createKafka, createLogger, createPool, ensureTopics, migrate, startOutboxRelay,
} from '@gearbay/common';
import { Redis } from 'ioredis';
import { createAppointmentService } from './appointmentService.js';
import { createBusySlotCache } from './busySlotCache.js';
import { DATABASE, DEFAULT_PORT, SERVICE_NAME } from './constants/index.js';
import { appointmentRoutes } from './routes.js';

const logger = createLogger(SERVICE_NAME);
const pool = createPool({ database: DATABASE });
await migrate(pool, path.join(import.meta.dirname, '../migrations'));

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6380),
  maxRetriesPerRequest: 1,
  commandTimeout: 500,
});
redis.on('error', (error) => logger.warn({ err: error.message }, 'Redis error'));

const kafka = createKafka(SERVICE_NAME);
await ensureTopics(kafka);
const producer = kafka.producer({ idempotent: true });
await producer.connect();
startOutboxRelay({ pool, producer, logger });

const cache = createBusySlotCache({ redis, logger });
const service = createAppointmentService({ pool, cache, logger });
const app = createApp({ logger, routes: appointmentRoutes({ pool, service }), health: () => pool.query('select 1') });
const port = Number(process.env.PORT ?? DEFAULT_PORT);
app.listen(port, () => logger.info({ port }, `${SERVICE_NAME} listening`));
