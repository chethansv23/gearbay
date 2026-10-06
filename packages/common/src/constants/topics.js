/** Kafka topic names. Events are keyed by aggregate id so one aggregate's events stay in order. */
export const Topics = Object.freeze({
  APPOINTMENT_EVENTS: 'gearbay.appointment.events',
  REPAIR_ORDER_EVENTS: 'gearbay.repair-order.events',
  INVENTORY_EVENTS: 'gearbay.inventory.events',
});

export const ALL_TOPICS = Object.values(Topics);

/** Suffix for dead-letter topics: a message that keeps failing is parked on `<topic>.dlt`. */
export const DLT_SUFFIX = '.dlt';
