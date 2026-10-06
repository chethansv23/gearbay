/** Every API call goes through this prefix; Vite (dev) and nginx (Docker) proxy it to the gateway. */
export const API_BASE_URL = '/api';

/** Sent with bookings so a retried request returns the original booking instead of creating a second one. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** How many sent messages the activity feed shows. */
export const NOTIFICATIONS_LIMIT = 40;
