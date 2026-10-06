import { parse } from '@gearbay/common';
import { DealerQuery, PartsQuery, ReservationsQuery, RestockRequest } from './dto/schemas.js';

export function inventoryRoutes({ service }) {
  return (app) => {
    app.get('/api/parts', async (req, res) => {
      const { dealerId, fitment } = parse(PartsQuery, req.query);
      res.json(await service.list(dealerId, fitment));
    });
    app.get('/api/parts/low-stock', async (req, res) => {
      const { dealerId } = parse(DealerQuery, req.query);
      res.json((await service.list(dealerId)).filter((p) => p.lowStock));
    });
    app.get('/api/parts/:dealerId/:sku', async (req, res) => res.json(await service.get(req.params.dealerId, req.params.sku)));
    app.post('/api/parts/:dealerId/:sku/restock', async (req, res) => {
      res.json(await service.restock(req.params.dealerId, req.params.sku, parse(RestockRequest, req.body).quantity));
    });
    app.get('/api/reservations', async (req, res) => {
      res.json(await service.reservations(parse(ReservationsQuery, req.query).repairOrderId));
    });
  };
}
