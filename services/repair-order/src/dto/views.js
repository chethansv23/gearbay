import { labourLines, toPaise, toRupees } from '@gearbay/common';

const rupees = (numeric) => toRupees(toPaise(numeric));

export function repairOrderView(o, lines) {
  return {
    id: o.id,
    roNumber: o.ro_number,
    appointmentId: o.appointment_id,
    dealerId: o.dealer_id,
    status: o.status,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    vehicleType: o.vehicle_type,
    vehicleNumber: o.vehicle_number,
    vehicleMake: o.vehicle_make,
    vehicleModel: o.vehicle_model,
    serviceTypes: o.service_types,
    labourLines: labourLines(o.service_types, o.vehicle_type)
      .map((l) => ({ serviceType: l.serviceType, minutes: l.minutes, amount: toRupees(l.labourPaise) })),
    odometerKm: o.odometer_km,
    technician: o.technician,
    note: o.note,
    parts: lines.map((l) => ({ sku: l.sku, name: l.name, quantity: l.quantity, unitPrice: rupees(l.unit_price), status: l.status })),
    labourAmount: rupees(o.labour_amount),
    partsAmount: rupees(o.parts_amount),
    taxAmount: rupees(o.tax_amount),
    totalAmount: rupees(o.total_amount),
    openedAt: o.opened_at.toISOString(),
    closedAt: o.closed_at?.toISOString() ?? null,
  };
}
