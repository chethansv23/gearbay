import { BUSY_SLOTS_CACHE_KEY_PREFIX, BUSY_SLOTS_TTL_SECONDS } from './constants/index.js';

const key = (dealerId, date) => `${BUSY_SLOTS_CACHE_KEY_PREFIX}${dealerId}:${date}`;

/**
 * Read-through Redis cache of a dealer's booked intervals for one day. Availability is the hottest
 * read path; bookings are comparatively rare.
 *
 * The cache is only an optimisation: correctness comes from the Postgres exclusion constraint, so a
 * stale entry can at worst show a slot that then fails to book with 409. Redis being down degrades
 * to reading from Postgres rather than failing the request.
 */
export function createBusySlotCache({ redis, logger, enabled = true, ttlSeconds = BUSY_SLOTS_TTL_SECONDS }) {
  return {
    async get(dealerId, date, load) {
      if (!enabled) return load();
      try {
        const cached = await redis.get(key(dealerId, date));
        if (cached) {
          return JSON.parse(cached).map((b) => ({ bayId: b.bayId, start: new Date(b.start), end: new Date(b.end) }));
        }
      } catch (error) {
        logger.warn({ err: error.message }, 'Redis read failed, falling back to database');
        return load();
      }
      const loaded = await load();
      redis.set(key(dealerId, date), JSON.stringify(loaded), 'EX', ttlSeconds)
        .catch((error) => logger.warn({ err: error.message }, 'Redis write failed'));
      return loaded;
    },

    async evict(dealerId, date) {
      if (!enabled) return;
      await redis.del(key(dealerId, date)).catch((error) => logger.warn({ err: error.message }, 'Redis evict failed'));
    },
  };
}
