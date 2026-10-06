import { z } from 'zod';
import { RepairOrderStatus } from '../constants/index.js';

export const ListQuery = z.object({ dealerId: z.string().min(1), status: z.enum(Object.values(RepairOrderStatus)).optional() });
export const AssignRequest = z.object({ technician: z.string().trim().min(1).max(80) });
export const PartsRequest = z.object({
  lines: z.array(z.object({ sku: z.string().trim().min(1), quantity: z.number().int().min(1).max(50) })).min(1).max(20),
});
export const CancelRequest = z.object({ reason: z.string().trim().min(1).max(200) });
