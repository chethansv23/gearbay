import { MAX_SERVICES_PER_BOOKING, SERVICE_TYPES, VehicleType, uniqueServices } from '@gearbay/common';
import { z } from 'zod';

const vehicleType = z.enum(Object.values(VehicleType));
const serviceType = z.enum(Object.keys(SERVICE_TYPES));
const optionalText = (max) => z.string().max(max).nullish();
/** Dealer-local date and time, e.g. 2026-09-28T10:00 */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'must look like 2026-09-28T10:00');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must look like 2026-09-28');

/**
 * One or more services. `serviceTypes` is the current field; a single `serviceType` is still accepted so
 * older clients keep working. Both become a de-duplicated `serviceTypes` list.
 */
const serviceList = z.array(serviceType).min(1, 'choose at least one service')
  .max(MAX_SERVICES_PER_BOOKING, `choose at most ${MAX_SERVICES_PER_BOOKING} services`);

/** Adds `serviceTypes` (parsed with `listSchema`) and the legacy `serviceType`, and normalises them into one list. */
function withServices(schema, listSchema = serviceList) {
  return schema.extend({ serviceTypes: listSchema.optional(), serviceType: serviceType.optional() })
    .refine((v) => v.serviceTypes || v.serviceType, { path: ['serviceTypes'], message: 'choose at least one service' })
    .transform(({ serviceType: single, serviceTypes, ...rest }) => ({ ...rest, serviceTypes: uniqueServices(serviceTypes ?? [single]) }));
}

/** Query strings carry the list comma-separated: ?serviceTypes=GENERAL_SERVICE,BRAKE_SERVICE */
const commaSeparated = z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

export const BookAppointmentRequest = withServices(z.object({
  dealerId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().regex(/^\+?[0-9]{10,15}$/, 'must be 10-15 digits, optionally prefixed with +'),
  customerEmail: z.email().nullish(),
  vehicleType,
  vehicleNumber: z.string().trim().min(1).max(20),
  vehicleMake: optionalText(40),
  vehicleModel: optionalText(60),
  slotStart: localDateTime,
  notes: optionalText(500),
}));

export const AvailabilityQuery = withServices(z.object({ dealerId: z.string().min(1), vehicleType, date: isoDate }),
  commaSeparated.pipe(serviceList));
export const DayQuery = z.object({ dealerId: z.string().min(1), date: isoDate });
export const CheckInRequest = z.object({ odometerKm: z.number().int().min(0).max(2_000_000).nullish() });
export const CancelRequest = z.object({ reason: z.string().trim().min(1).max(200) });
export const IdempotencyKey = z.string().max(80).optional();
