import { randomUUID } from 'node:crypto';
import { EventTypes } from '@gearbay/common';
import { Channel, managerEmail } from './constants/index.js';
import { templates } from './templates.js';

const sms = (phone, message) => ({ channel: Channel.SMS, recipient: phone, message });

/** Which events notify whom. Events not listed here are internal and notify nobody. */
const RENDERERS = {
  [EventTypes.APPOINTMENT_BOOKED]: (e) => sms(e.customerPhone, templates.booked(e)),
  [EventTypes.APPOINTMENT_CANCELLED]: (e) => sms(e.customerPhone, templates.cancelled(e)),
  [EventTypes.APPOINTMENT_CHECKED_IN]: (e) => sms(e.customerPhone, templates.checkedIn(e)),
  [EventTypes.REPAIR_ORDER_CREATED]: (e) => sms(e.customerPhone, templates.roCreated(e)),
  [EventTypes.REPAIR_ORDER_COMPLETED]: (e) => sms(e.customerPhone, templates.roCompleted(e)),
  [EventTypes.PART_LOW_STOCK]: (e) => ({ channel: Channel.EMAIL, recipient: managerEmail(e.dealerId), message: templates.lowStock(e) }),
};

/** Delivery port; logs instead of sending. Swap for an SMS gateway or SES adapter in a real deployment. */
export const loggingSender = (logger) => ({
  send: async ({ channel, recipient, message }) => logger.info(`[${channel}] -> ${recipient}: ${message}`),
});

export function createNotificationService({ pool, sender }) {
  return {
    /** Runs inside the idempotent consumer's transaction, so each event produces at most one record. */
    async handle(client, { eventId, eventType, payload }) {
      const render = RENDERERS[eventType];
      if (!render) return;
      const out = render(payload);
      await sender.send(out);
      await client.query(
        `insert into notification (id, event_id, event_type, channel, recipient, message, sent_at)
         values ($1,$2,$3,$4,$5,$6, now())`, [randomUUID(), eventId, eventType, out.channel, out.recipient, out.message]);
    },

    async list({ recipient, limit }) {
      const { rows } = recipient
        ? await pool.query('select * from notification where recipient = $1 order by sent_at desc limit $2', [recipient, limit])
        : await pool.query('select * from notification order by sent_at desc limit $1', [limit]);
      return rows.map((n) => ({
        id: n.id, eventId: n.event_id, eventType: n.event_type, channel: n.channel,
        recipient: n.recipient, message: n.message, sentAt: n.sent_at.toISOString(),
      }));
    },
  };
}
