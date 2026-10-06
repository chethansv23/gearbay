import type { VehicleType } from '../api';

type IconProps = { size?: number };

export const CarIcon = ({ size = 28 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20v-4l3-6a3 3 0 0 1 2.7-1.7h12.6A3 3 0 0 1 25 10l3 6v4a1 1 0 0 1-1 1h-2" />
    <path d="M7 21H5a1 1 0 0 1-1-1" />
    <path d="M11 21h10" />
    <path d="M6 16h20" />
    <circle cx="9" cy="21" r="2.5" />
    <circle cx="23" cy="21" r="2.5" />
  </svg>
);

export const BikeIcon = ({ size = 28 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="7" cy="21" r="4.5" />
    <circle cx="25" cy="21" r="4.5" />
    <path d="M7 21l5-8h7l6 8" />
    <path d="M12 13l4 8h3" />
    <path d="M19 13l-2-4h-3" />
    <path d="M22 9h3l-2 4" />
  </svg>
);

export const VehicleIcon = ({ type, size }: { type: VehicleType; size?: number }) =>
  type === 'CAR' ? <CarIcon size={size} /> : <BikeIcon size={size} />;

export const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);

export const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <path d="M16 7a9 9 0 1 0 9 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    <path d="M16 16l6-6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
