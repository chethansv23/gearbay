# Gearbay

**Service appointments and repair orders for car and bike dealerships, built with Node.js.**

Node.js 22 · Express 5 · PostgreSQL · Kafka · Redis · React · TypeScript · Docker

A customer books a slot for their **car or bike**, the workshop checks the vehicle in, a job card opens
automatically, parts are reserved from stock, and the customer gets SMS updates and an itemised GST invoice.

Gearbay is the JavaScript implementation of [Torqline](https://github.com/chethansv23/torqline) (Java / Spring Boot).
Both share the same architecture, database schema, Kafka events and REST API, so the same UI, demo script and load
test run against either. See [Java → Node mapping](docs/DESIGN.md#java-torqline--node-gearbay).

## Quick start

**You need:** Docker Desktop (6 GB+ memory). Node isn't needed to run it.

```bash
make up        # then open http://localhost:4000
make demo      # scripted end-to-end walkthrough
```

| URL | What |
|---|---|
| http://localhost:4000 | Web app: Book service, Workshop, Inventory |
| http://localhost:9080/api | REST API through the gateway |
| `localhost:5434` | PostgreSQL, user and password `gearbay` (databases `appointment_db`, `repair_order_db`, `inventory_db`, `notification_db`) |

Ports are offset from Torqline (3000 / 8080 / 5433 …) so both projects can run at the same time.

**Run services locally with hot reload:** `make infra`, then `npm install` and
`node --watch services/appointment/src/index.js` (and the others). For the UI: `cd web && npm run dev`
(http://localhost:5174).

## Features

- **Cars and bikes:** separate car lifts and bike stands, job durations per vehicle (general service 120 min vs 60),
  vehicle-only jobs (wheel alignment, chain kit), labour at ₹800/h vs ₹400/h, parts by fitment
- **Several services in one booking:** e.g. general service + brake service, done back to back in one slot on
  one bay; the slot length is the sum of the services, and labour is charged per service on the invoice
- **No double booking:** a Postgres exclusion constraint plus a per-bay advisory lock
- **Idempotent booking:** `Idempotency-Key` header; a retry returns the original booking with 200
- **Parts saga:** all-or-nothing reservation, consumption on completion, release on cancellation, low-stock alerts
- **Reliable events:** transactional outbox, idempotent consumers, retries and dead-letter topics
- **Fast reads:** Redis cache of booked slots, with fallback to Postgres

## Results

| Check | Result |
|---|---|
| 50 riders racing for 2 bike stands (Testcontainers) | exactly 2 booked |
| 50 riders racing for 4 bike stands (Testcontainers and k6) | exactly 4 booked, 46 clean 409s, 0 errors |
| Availability reads at 200 req/s (k6) | p95 ≈ 1.9 ms |
| End-to-end demo invoice | ₹1,675.60, identical to Torqline |

## Tests

```bash
make test-unit      # 30 unit tests, no Docker needed
make test-backend   # + 18 integration tests against real Postgres (Testcontainers)
make test-web       # 29 UI tests
make loadtest       # k6 race and throughput, with pass/fail thresholds
```

## Project structure

```
packages/common/     shared code: constants, db + migrations runner, outbox, idempotent consumer, Kafka, HTTP errors
services/
  gateway/           Express + http-proxy-middleware
  appointment/       dealers, bays, availability, booking
  repair-order/      job cards, workflow, invoice, parts saga
  inventory/         stock, reservations, low-stock alerts
  notification/      SMS and email from events
web/                 React + TypeScript UI
test/support/        Testcontainers helper
docs/DESIGN.md       architecture, mechanisms, Node choices, Java → Node mapping
```

Each service follows the same layout: `src/constants/`, `src/dto/` (zod schemas and response views),
business logic, `routes.js`, `index.js` (wiring), `migrations/` and `test/`.

## Commands

`make help` lists everything: `up`, `infra`, `demo`, `test`, `loadtest`, `logs`, `down`, `reset`.
