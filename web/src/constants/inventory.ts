import type { Fitment } from '../api';

export const FITMENT_FILTERS: { value?: Fitment; label: string }[] = [
  { label: 'All' }, { value: 'CAR', label: 'Car' }, { value: 'BIKE', label: 'Bike' }, { value: 'UNIVERSAL', label: 'Universal' },
];

/** Units added by the restock button. */
export const RESTOCK_QUANTITY = 10;
