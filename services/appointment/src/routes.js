import { ApiError, ApiHeaders, VehicleType, parse, serviceCatalogue } from '@gearbay/common';
import { AvailabilityQuery, BookAppointmentRequest, CancelRequest, CheckInRequest, DayQuery, IdempotencyKey } from './dto/schemas.js';
import { bayView, dealerView } from './dto/views.js';
import * as repo from './repository.js';

export function appointmentRoutes({ pool, service }) {
  return (app) => {
    app.get('/api/dealers', async (_req, res) => {
      const dealers = await repo.findDealers(pool);
      res.json(await Promise.all(dealers.map(async (d) => dealerView(d, await bayCount(d.id)))));
    });
    // Declared before /:dealerId so "service-types" is not taken as a dealer id.
    app.get('/api/dealers/service-types', (_req, res) => res.json(serviceCatalogue()));
    app.get('/api/dealers/:dealerId', async (req, res) => {
      const d = await repo.findDealer(pool, req.params.dealerId);
      if (!d) throw ApiError.notFound('Dealer', req.params.dealerId);
      res.json(dealerView(d, await bayCount(d.id)));
    });
    app.get('/api/dealers/:dealerId/bays', async (req, res) => {
      res.json((await repo.findBays(pool, req.params.dealerId)).map(bayView));
    });

    app.get('/api/appointments/availability', async (req, res) => {
      res.json(await service.availability(parse(AvailabilityQuery, req.query)));
    });
    /**
     * Clients should send an Idempotency-Key so a retried request (timeout, double tap) returns the
     * original booking with 200 instead of creating a second one.
     */
    app.post('/api/appointments', async (req, res) => {
      const key = parse(IdempotencyKey, req.get(ApiHeaders.IDEMPOTENCY_KEY));
      const result = await service.book(parse(BookAppointmentRequest, req.body), key);
      res.status(result.replayed ? 200 : 201).json(result.appointment);
    });
    app.get('/api/appointments', async (req, res) => {
      const { dealerId, date } = parse(DayQuery, req.query);
      res.json(await service.forDay(dealerId, date));
    });
    app.get('/api/appointments/:id', async (req, res) => res.json(await service.get(req.params.id)));
    app.post('/api/appointments/:id/check-in', async (req, res) => {
      res.json(await service.checkIn(req.params.id, parse(CheckInRequest, req.body).odometerKm));
    });
    app.post('/api/appointments/:id/cancel', async (req, res) => {
      res.json(await service.cancel(req.params.id, parse(CancelRequest, req.body).reason));
    });
  };

  async function bayCount(dealerId) {
    const bays = await repo.findBays(pool, dealerId);
    const count = {};
    for (const v of Object.values(VehicleType)) {
      const n = bays.filter((b) => b.vehicle_type === v).length;
      if (n > 0) count[v] = n;
    }
    return count;
  }
}
