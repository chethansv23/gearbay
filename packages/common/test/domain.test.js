import { describe, expect, it } from 'vitest';
import { SERVICE_TYPES, VehicleType } from '../src/constants/index.js';
import {
  durationMinutes, labourLines, labourPaise, serviceCatalogue, supports, totalDurationMinutes, totalLabourPaise,
  uniqueServices, unsupportedServices,
} from '../src/domain.js';

describe('domain', () => {
  it('gives bikes shorter jobs than cars', () => {
    expect(durationMinutes('GENERAL_SERVICE', VehicleType.CAR)).toBe(120);
    expect(durationMinutes('GENERAL_SERVICE', VehicleType.BIKE)).toBe(60);
  });

  it('rejects vehicle-specific jobs for the other vehicle type', () => {
    expect(supports('CHAIN_SPROCKET', 'CAR')).toBe(false);
    expect(supports('WHEEL_ALIGNMENT', 'BIKE')).toBe(false);
    expect(() => durationMinutes('AC_SERVICE', 'BIKE')).toThrow('AC_SERVICE is not offered for BIKE');
  });

  it('fits every job on the 30-minute grid', () => {
    for (const [code, type] of Object.entries(SERVICE_TYPES)) {
      for (const vehicle of Object.values(VehicleType)) {
        if (type[vehicle] != null) expect(type[vehicle] % 30, `${code}/${vehicle}`).toBe(0);
      }
    }
  });

  it('prices labour by duration and vehicle rate', () => {
    expect(labourPaise('GENERAL_SERVICE', 'CAR')).toBe(160_000); // 2 h × ₹800
    expect(labourPaise('GENERAL_SERVICE', 'BIKE')).toBe(40_000); // 1 h × ₹400
  });

  it('lists only the vehicle types a job applies to', () => {
    const chain = serviceCatalogue().find((s) => s.code === 'CHAIN_SPROCKET');
    expect(chain.durationMinutes).toEqual({ BIKE: 60 });
  });

  describe('several services in one booking', () => {
    const generalPlusBrakes = ['GENERAL_SERVICE', 'BRAKE_SERVICE'];

    it('adds up the durations, since the services run back to back on one bay', () => {
      expect(totalDurationMinutes(generalPlusBrakes, 'BIKE')).toBe(120); // 60 + 60
      expect(totalDurationMinutes(generalPlusBrakes, 'CAR')).toBe(210); // 120 + 90
    });

    it('charges labour per service', () => {
      expect(labourLines(generalPlusBrakes, 'CAR')).toEqual([
        { serviceType: 'GENERAL_SERVICE', minutes: 120, labourPaise: 160_000 },
        { serviceType: 'BRAKE_SERVICE', minutes: 90, labourPaise: 120_000 },
      ]);
      expect(totalLabourPaise(generalPlusBrakes, 'CAR')).toBe(280_000);
    });

    it('names the services that do not fit the vehicle', () => {
      expect(unsupportedServices(['GENERAL_SERVICE', 'WHEEL_ALIGNMENT', 'AC_SERVICE'], 'BIKE')).toEqual(['WHEEL_ALIGNMENT', 'AC_SERVICE']);
    });

    it('drops repeats but keeps the chosen order', () => {
      expect(uniqueServices(['BRAKE_SERVICE', 'OIL_CHANGE', 'BRAKE_SERVICE'])).toEqual(['BRAKE_SERVICE', 'OIL_CHANGE']);
    });
  });
});
