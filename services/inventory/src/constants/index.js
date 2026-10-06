export const SERVICE_NAME = 'inventory-service';
export const DATABASE = 'inventory_db';
export const DEFAULT_PORT = 9083;
export const CONSUMER_GROUP = 'inventory-service';

/** Which vehicles a part fits. Consumables such as coolant are UNIVERSAL. */
export const Fitment = Object.freeze({ CAR: 'CAR', BIKE: 'BIKE', UNIVERSAL: 'UNIVERSAL' });

export const ReservationStatus = Object.freeze({ RESERVED: 'RESERVED', CONSUMED: 'CONSUMED', RELEASED: 'RELEASED' });

export const MAX_RESTOCK_QUANTITY = 10_000;
