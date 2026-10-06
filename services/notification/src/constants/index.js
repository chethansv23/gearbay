export const SERVICE_NAME = 'notification-service';
export const DATABASE = 'notification_db';
export const DEFAULT_PORT = 9084;
export const CONSUMER_GROUP = 'notification-service';

export const Channel = Object.freeze({ SMS: 'SMS', EMAIL: 'EMAIL' });

/** Service-manager inbox that receives stock alerts, e.g. manager+GB-BLR-IND@gearbay.dev */
export const managerEmail = (dealerId) => `manager+${dealerId}@gearbay.dev`;

/** Times in customer messages are shown in IST because all seeded dealers are in Bengaluru. */
export const DISPLAY_ZONE = 'Asia/Kolkata';

/** e.g. "Mon 7 Jan, 10:00 AM" */
export const MESSAGE_DATE_TIME_FORMAT = 'ccc d LLL, h:mm a';

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
