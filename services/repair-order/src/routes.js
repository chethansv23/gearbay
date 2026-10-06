import { parse } from '@gearbay/common';
import { AssignRequest, CancelRequest, ListQuery, PartsRequest } from './dto/schemas.js';

export function repairOrderRoutes({ service }) {
  return (app) => {
    app.get('/api/repair-orders', async (req, res) => {
      const { dealerId, status } = parse(ListQuery, req.query);
      res.json(await service.list(dealerId, status));
    });
    app.get('/api/repair-orders/:id', async (req, res) => res.json(await service.get(req.params.id)));
    app.post('/api/repair-orders/:id/assign', async (req, res) => {
      res.json(await service.assign(req.params.id, parse(AssignRequest, req.body).technician));
    });
    /** Asynchronous: answers 202 with the order in PARTS_PENDING; poll until inventory replies. */
    app.post('/api/repair-orders/:id/parts', async (req, res) => {
      res.status(202).json(await service.requestParts(req.params.id, parse(PartsRequest, req.body).lines));
    });
    app.post('/api/repair-orders/:id/complete', async (req, res) => res.json(await service.complete(req.params.id)));
    app.post('/api/repair-orders/:id/cancel', async (req, res) => {
      res.json(await service.cancel(req.params.id, parse(CancelRequest, req.body).reason));
    });
  };
}
