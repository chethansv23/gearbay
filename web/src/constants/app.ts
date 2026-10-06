export const TABS = [
  { id: 'book', label: 'Book service', who: 'Customer' },
  { id: 'workshop', label: 'Workshop', who: 'Service advisor' },
  { id: 'inventory', label: 'Inventory', who: 'Parts desk' },
] as const;

/** localStorage key remembering the branch the user picked. */
export const DEALER_STORAGE_KEY = 'gearbay.dealer';

/** Number of days, starting today, offered in the date strips. */
export const BOOKING_DAYS_AHEAD = 8;

/** Polling intervals in milliseconds. Shorter where users watch asynchronous saga steps land. */
export const POLL_INTERVAL_MS = {
  notificationBadge: 3000,
  activityDrawer: 2000,
  appointments: 3000,
  repairOrders: 1500,
  inventory: 3000,
  partsPicker: 5000,
} as const;

/** Most services a customer can combine into one booking; must match MAX_SERVICES_PER_BOOKING on the server. */
export const MAX_SERVICES_PER_BOOKING = 5;

/** Selected when the booking page opens. */
export const DEFAULT_SERVICE = 'GENERAL_SERVICE';
