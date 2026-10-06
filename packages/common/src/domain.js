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

/** Service catalogue as the API returns it: durations per vehicle type, omitting jobs a vehicle can't have. */
export function serviceCatalogue() {
  return Object.entries(SERVICE_TYPES).map(([code, type]) => ({
    code,
    description: type.description,
    durationMinutes: Object.fromEntries(Object.values(VehicleType).filter((v) => type[v] != null).map((v) => [v, type[v]])),
  }));
}
