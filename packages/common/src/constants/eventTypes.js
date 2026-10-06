/** Event type names, sent in the `eventType` header. */
export const EventTypes = Object.freeze({
  APPOINTMENT_BOOKED: 'AppointmentBooked',
  APPOINTMENT_CANCELLED: 'AppointmentCancelled',
  APPOINTMENT_CHECKED_IN: 'AppointmentCheckedIn',
  REPAIR_ORDER_CREATED: 'RepairOrderCreated',
  PARTS_RESERVATION_REQUESTED: 'PartsReservationRequested',
  REPAIR_ORDER_COMPLETED: 'RepairOrderCompleted',
  REPAIR_ORDER_CANCELLED: 'RepairOrderCancelled',
  PARTS_RESERVED: 'PartsReserved',
  PARTS_RESERVATION_FAILED: 'PartsReservationFailed',
  PART_LOW_STOCK: 'PartLowStock',
});
