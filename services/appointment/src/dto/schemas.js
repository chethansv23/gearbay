import { SERVICE_TYPES, VehicleType } from '@gearbay/common';
import { z } from 'zod';

const vehicleType = z.enum(Object.values(VehicleType));
const serviceType = z.enum(Object.keys(SERVICE_TYPES));
const optionalText = (max) => z.string().max(max).nullish();
/** Dealer-local date and time, e.g. 2026-09-28T10:00 */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'must look like 2026-09-28T10:00');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must look like 2026-09-28');

export const BookAppointmentRequest = z.object({
  dealerId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().regex(/^\+?[0-9]{10,15}$/, 'must be 10-15 digits, optionally prefixed with +'),
  customerEmail: z.email().nullish(),
  vehicleType,
  vehicleNumber: z.string().trim().min(1).max(20),
  vehicleMake: optionalText(40),
  vehicleModel: optionalText(60),
  serviceType,
  slotStart: localDateTime,
  notes: optionalText(500),
});

export const AvailabilityQuery = z.object({ dealerId: z.string().min(1), vehicleType, serviceType, date: isoDate });
export const DayQuery = z.object({ dealerId: z.string().min(1), date: isoDate });
export const CheckInRequest = z.object({ odometerKm: z.number().int().min(0).max(2_000_000).nullish() });
export const CancelRequest = z.object({ reason: z.string().trim().min(1).max(200) });
export const IdempotencyKey = z.string().max(80).optional();
