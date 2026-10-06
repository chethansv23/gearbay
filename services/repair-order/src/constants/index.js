export const SERVICE_NAME = 'repair-order-service';
export const DATABASE = 'repair_order_db';
export const DEFAULT_PORT = 9082;
export const CONSUMER_GROUP = 'repair-order-service';

/** GST on vehicle servicing in India, in percent. */
export const GST_PERCENT = 18;

/** Repair-order number, e.g. RO-2026-001042: year and a zero-padded database sequence value. */
export const roNumber = (year, sequence) => `RO-${year}-${String(sequence).padStart(6, '0')}`;
export const RO_NUMBER_SEQUENCE_QUERY = "select nextval('ro_number_seq') as seq";

export const RepairOrderStatus = Object.freeze({
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PARTS_PENDING: 'PARTS_PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const PartLineStatus = Object.freeze({ REQUESTED: 'REQUESTED', RESERVED: 'RESERVED', REJECTED: 'REJECTED' });

/** Stable error codes returned by the repair-order API. */
export const RepairOrderErrorCodes = Object.freeze({ INVALID_TRANSITION: 'INVALID_TRANSITION' });
