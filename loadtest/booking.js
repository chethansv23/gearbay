// Two scenarios against the gateway:
//  1. race: 50 customers hit "book" for the same bike slot at the same instant.
//     Whitefield has 4 bike stands, so exactly 4 must get 201 and the rest 409.
//  2. browse: steady availability reads, the hottest path, served mostly from Redis.
//
// Run: make loadtest   (or see README for the docker command)
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const API = __ENV.API || 'http://host.docker.internal:9080/api';
const DEALER = 'GB-BLR-WHF';

const booked = new Counter('race_booked');
const rejected = new Counter('race_rejected');

export const options = {
  scenarios: {
    race: { executor: 'per-vu-iterations', vus: 50, iterations: 1, exec: 'race' },
    browse: {
      executor: 'constant-arrival-rate', rate: 200, timeUnit: '1s', duration: '20s',
      preAllocatedVUs: 100, exec: 'browse', startTime: '2s',
    },
  },
  thresholds: {
    race_booked: ['count==4'],
    'http_req_duration{scenario:browse}': ['p(95)<150'],
    'http_req_failed{scenario:browse}': ['rate<0.01'],
  },
};

// setup() runs once and its result is shared by every VU. Picking the date in init code instead
// would run once per VU, giving each VU its own random day and no actual race.
export function setup() {
  const offsetDays = 3 + Math.floor(Math.random() * 300);
  return { day: new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10) };
}

export function race({ day }) {
  const res = http.post(`${API}/appointments`, JSON.stringify({
    dealerId: DEALER,
    customerName: `Rider ${__VU}`,
    customerPhone: `98${String(__VU).padStart(8, '0')}`,
    vehicleType: 'BIKE',
    vehicleNumber: `KA53EZ${String(__VU).padStart(4, '0')}`,
    serviceType: 'OIL_CHANGE',
    slotStart: `${day}T15:00`,
  }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'booked or cleanly rejected': (r) => r.status === 201 || r.status === 409 });
  if (res.status === 201) booked.add(1);
  if (res.status === 409) rejected.add(1);
}

export function browse({ day }) {
  const res = http.get(`${API}/appointments/availability?dealerId=${DEALER}&vehicleType=BIKE&serviceType=GENERAL_SERVICE&date=${day}`);
  check(res, { 'availability 200': (r) => r.status === 200 });
}
