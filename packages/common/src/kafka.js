import { setTimeout as sleep } from 'node:timers/promises';
import { Kafka, logLevel } from 'kafkajs';
import { ALL_TOPICS, CONSUMER_RETRY, DLT_SUFFIX, EventHeaders } from './constants/index.js';

export function createKafka(clientId) {
  return new Kafka({
    clientId,
    brokers: (process.env.KAFKA_BOOTSTRAP_SERVERS ?? 'localhost:9094').split(','),
    logLevel: logLevel.WARN,
    retry: { retries: 10 },
  });
}

/** Creates the topics if they are missing, so consumers can subscribe before anything is published. */
export async function ensureTopics(kafka) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: ALL_TOPICS.flatMap((topic) => [
        { topic, numPartitions: 3, replicationFactor: 1 },
        { topic: topic + DLT_SUFFIX, numPartitions: 1, replicationFactor: 1 },
      ]),
    });
  } finally {
    await admin.disconnect();
  }
}

/** Decodes the envelope of a consumed message. */
export function decode(message) {
  const header = (name) => {
    const value = message.headers?.[name];
    if (value == null) throw new Error(`Missing header '${name}'`);
    return value.toString();
  };
  return {
    eventId: header(EventHeaders.EVENT_ID),
    eventType: header(EventHeaders.EVENT_TYPE),
    payload: JSON.parse(message.value.toString()),
  };
}

/**
 * Consumes `topics` with `handle(event)`. A failing message is retried a few times, then parked on
 * the dead-letter topic with the error attached, so one bad message cannot block its partition.
 */
export async function runConsumer({ kafka, groupId, topics, handle, logger, producer }) {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  for (const topic of topics) await consumer.subscribe({ topic, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let lastError;
      for (let attempt = 0; attempt <= CONSUMER_RETRY.ATTEMPTS; attempt++) {
        try {
          await handle(decode(message));
          return;
        } catch (error) {
          lastError = error;
          if (attempt < CONSUMER_RETRY.ATTEMPTS) await sleep(CONSUMER_RETRY.BACKOFF_MS);
        }
      }
      logger.error({ err: lastError.message, topic, partition, offset: message.offset }, 'Sending message to DLT');
      await producer.send({
        topic: topic + DLT_SUFFIX,
        messages: [{ key: message.key, value: message.value,
          headers: { ...message.headers, error: String(lastError.message) } }],
      });
    },
  });
  return consumer;
}
