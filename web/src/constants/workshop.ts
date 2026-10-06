import type { RepairOrderStatus } from '../api';

export const TECHNICIANS = ['Ravi K', 'Imran S', 'Priya N', 'Arjun M'];

/** Workshop board columns, in workflow order. Cancelled orders are not shown. */
export const BOARD_COLUMNS: { status: RepairOrderStatus; title: string; hint: string }[] = [
  { status: 'OPEN', title: 'Checked in', hint: 'Waiting for a technician' },
  { status: 'IN_PROGRESS', title: 'In progress', hint: 'On the lift or stand' },
  { status: 'PARTS_PENDING', title: 'Waiting for parts', hint: 'Inventory is reserving stock' },
  { status: 'COMPLETED', title: 'Ready for pickup', hint: 'Invoiced' },
];

/** Largest quantity of one part the picker allows per request. */
export const MAX_PART_QUANTITY = 20;
