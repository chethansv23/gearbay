import { z } from 'zod';
import { Fitment, MAX_RESTOCK_QUANTITY } from '../constants/index.js';

export const PartsQuery = z.object({ dealerId: z.string().min(1), fitment: z.enum(Object.values(Fitment)).optional() });
export const DealerQuery = z.object({ dealerId: z.string().min(1) });
export const RestockRequest = z.object({ quantity: z.number().int().min(1).max(MAX_RESTOCK_QUANTITY) });
export const ReservationsQuery = z.object({ repairOrderId: z.uuid() });
