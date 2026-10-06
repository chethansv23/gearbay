/** Gearbay services both four-wheelers and two-wheelers. */
export const VehicleType = Object.freeze({ CAR: 'CAR', BIKE: 'BIKE' });

/** Labour rate in paise per hour (₹800 for cars, ₹400 for bikes). Money is kept in integer paise to avoid float errors. */
export const HOURLY_LABOUR_RATE_PAISE = Object.freeze({ CAR: 80_000, BIKE: 40_000 });

/**
 * Service catalogue. Minutes per vehicle type; `null` means the job does not apply to that vehicle
 * (a bike has no wheel alignment, a car has no chain). Durations are multiples of the 30-minute grid.
 */
export const SERVICE_TYPES = Object.freeze({
  GENERAL_SERVICE: { description: 'Periodic maintenance service', CAR: 120, BIKE: 60 },
  OIL_CHANGE: { description: 'Engine oil and filter change', CAR: 30, BIKE: 30 },
  BRAKE_SERVICE: { description: 'Brake inspection and pad replacement', CAR: 90, BIKE: 60 },
  TYRE_REPLACEMENT: { description: 'Tyre replacement and balancing', CAR: 60, BIKE: 30 },
  CLUTCH_OVERHAUL: { description: 'Clutch overhaul', CAR: 180, BIKE: 90 },
  WHEEL_ALIGNMENT: { description: 'Wheel alignment', CAR: 60, BIKE: null },
  AC_SERVICE: { description: 'Air-conditioning service', CAR: 90, BIKE: null },
  CHAIN_SPROCKET: { description: 'Chain and sprocket kit replacement', CAR: null, BIKE: 60 },
});
