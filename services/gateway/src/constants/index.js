export const SERVICE_NAME = 'gateway';
export const DEFAULT_PORT = 9080;

/** Which service owns which paths. URLs come from the environment so Docker and local runs both work. */
export const ROUTES = [
  { paths: ['/api/appointments', '/api/dealers'], target: process.env.APPOINTMENT_SERVICE_URL ?? 'http://localhost:9081' },
  { paths: ['/api/repair-orders'], target: process.env.REPAIR_ORDER_SERVICE_URL ?? 'http://localhost:9082' },
  { paths: ['/api/parts', '/api/reservations'], target: process.env.INVENTORY_SERVICE_URL ?? 'http://localhost:9083' },
  { paths: ['/api/notifications'], target: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:9084' },
];
