import { HOURLY_LABOUR_RATE_PAISE, SERVICE_TYPES, VehicleType } from './constants/index.js';

export const isVehicleType = (value) => Object.values(VehicleType).includes(value);
export const isServiceType = (value) => Object.hasOwn(SERVICE_TYPES, value);

export function supports(serviceType, vehicleType) {
  return SERVICE_TYPES[serviceType]?.[vehicleType] != null;
}

/** Job length in minutes; throws if the job is not offered for that vehicle. */
export function durationMinutes(serviceType, vehicleType) {
  const minutes = SERVICE_TYPES[serviceType]?.[vehicleType];
  if (minutes == null) throw new Error(`${serviceType} is not offered for ${vehicleType}`);
  return minutes;
}

/** Labour charge in paise: job duration × hourly rate. */
export function labourPaise(serviceType, vehicleType) {
  return Math.round((durationMinutes(serviceType, vehicleType) * HOURLY_LABOUR_RATE_PAISE[vehicleType]) / 60);
}

/** Removes repeats while keeping the order the customer chose. */
export const uniqueServices = (serviceTypes) => [...new Set(serviceTypes)];

/** The selected services that don't apply to this vehicle, e.g. WHEEL_ALIGNMENT for a bike. */
export const unsupportedServices = (serviceTypes, vehicleType) => serviceTypes.filter((s) => !supports(s, vehicleType));

/** Several services are done back to back on one bay, so the booking lasts as long as all of them together. */
export function totalDurationMinutes(serviceTypes, vehicleType) {
  return serviceTypes.reduce((sum, s) => sum + durationMinutes(s, vehicleType), 0);
}

/** One labour line per selected service, as shown on the job card and invoice. */
export function labourLines(serviceTypes, vehicleType) {
  return serviceTypes.map((serviceType) => ({
    serviceType,
    minutes: durationMinutes(serviceType, vehicleType),
    labourPaise: labourPaise(serviceType, vehicleType),
  }));
}

export const totalLabourPaise = (serviceTypes, vehicleType) =>
  labourLines(serviceTypes, vehicleType).reduce((sum, line) => sum + line.labourPaise, 0);

/** Service catalogue as the API returns it: durations per vehicle type, omitting jobs a vehicle can't have. */
export function serviceCatalogue() {
  return Object.entries(SERVICE_TYPES).map(([code, type]) => ({
    code,
    description: type.description,
    durationMinutes: Object.fromEntries(Object.values(VehicleType).filter((v) => type[v] != null).map((v) => [v, type[v]])),
  }));
}
