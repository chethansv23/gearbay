/** Kafka header names of the event envelope. */
export const EventHeaders = Object.freeze({
  EVENT_ID: 'eventId',
  EVENT_TYPE: 'eventType',
});

/** Aggregate names recorded on outbox rows, so events can be traced back to what produced them. */
export const AggregateTypes = Object.freeze({
  APPOINTMENT: 'Appointment',
  REPAIR_ORDER: 'RepairOrder',
  RESERVATION: 'Reservation',
  PART: 'Part',
});

export const OUTBOX_DEFAULTS = Object.freeze({
  POLL_INTERVAL_MS: 500,
  BATCH_SIZE: 100,
  PURGE_INTERVAL_MS: 60 * 60 * 1000,
  RETENTION_DAYS: 7,
});

/** A failing message is retried this many times, this far apart, before going to the dead-letter topic. */
export const CONSUMER_RETRY = Object.freeze({ ATTEMPTS: 3, BACKOFF_MS: 1000 });
