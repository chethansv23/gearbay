import { API_BASE_URL, FIELD_LABELS, IDEMPOTENCY_KEY_HEADER, NOTIFICATIONS_LIMIT } from './constants';

export type VehicleType = 'CAR' | 'BIKE';
export type Fitment = 'CAR' | 'BIKE' | 'UNIVERSAL';

export interface Dealer {
  id: string;
  name: string;
  city: string;
  timezone: string;
  openTime: string;
  closeTime: string;
  bayCount: Partial<Record<VehicleType, number>>;
}

export interface Bay {
  id: number;
  name: string;
  vehicleType: VehicleType;
}

export interface ServiceTypeInfo {
  code: string;
  description: string;
  durationMinutes: Partial<Record<VehicleType, number>>;
}

export interface Slot {
  start: string;
  end: string;
  freeBays: number;
}

export interface Availability {
  dealerId: string;
  date: string;
  durationMinutes: number;
  slots: Slot[];
}

export type AppointmentStatus = 'BOOKED' | 'CHECKED_IN' | 'CANCELLED';

export interface Appointment {
  id: string;
  dealerId: string;
  bayId: number;
  status: AppointmentStatus;
  customerName: string;
  customerPhone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  serviceType: string;
  localStart: string;
  localEnd: string;
  notes?: string;
  odometerKm?: number;
  cancelReason?: string;
}

export interface BookingRequest {
  dealerId: string;
  customerName: string;
  customerPhone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  serviceType: string;
  slotStart: string;
  notes?: string;
}

export type RepairOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'PARTS_PENDING' | 'COMPLETED' | 'CANCELLED';

export interface PartLine {
  sku: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  status: 'REQUESTED' | 'RESERVED' | 'REJECTED';
}

export interface RepairOrder {
  id: string;
  roNumber: string;
  appointmentId: string;
  dealerId: string;
  status: RepairOrderStatus;
  customerName: string;
  customerPhone: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  serviceType: string;
  odometerKm?: number;
  technician?: string;
  note?: string;
  parts: PartLine[];
  labourAmount: number;
  partsAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  openedAt: string;
  closedAt?: string;
}

export interface Part {
  dealerId: string;
  sku: string;
  name: string;
  fitment: Fitment;
  unitPrice: number;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  lowStock: boolean;
}

export interface Notification {
  id: string;
  eventType: string;
  channel: 'SMS' | 'EMAIL';
  recipient: string;
  message: string;
  sentAt: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init?.idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = init.idempotencyKey;
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const fieldErrors = body?.errors
      ? Object.entries(body.errors).map(([field, message]) => `${FIELD_LABELS[field] ?? field} ${message}`).join(', ')
      : '';
    throw new ApiError(fieldErrors || body?.detail || `Request failed (${res.status})`, res.status, body?.code);
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), idempotencyKey });

export const api = {
  dealers: () => request<Dealer[]>('/dealers'),
  bays: (dealerId: string) => request<Bay[]>(`/dealers/${dealerId}/bays`),
  serviceTypes: () => request<ServiceTypeInfo[]>('/dealers/service-types'),
  availability: (dealerId: string, vehicleType: VehicleType, serviceType: string, date: string) =>
    request<Availability>(
      `/appointments/availability?dealerId=${dealerId}&vehicleType=${vehicleType}&serviceType=${serviceType}&date=${date}`),
  book: (body: BookingRequest, idempotencyKey: string) => post<Appointment>('/appointments', body, idempotencyKey),
  appointments: (dealerId: string, date: string) => request<Appointment[]>(`/appointments?dealerId=${dealerId}&date=${date}`),
  checkIn: (id: string, odometerKm?: number) => post<Appointment>(`/appointments/${id}/check-in`, { odometerKm }),
  cancelAppointment: (id: string, reason: string) => post<Appointment>(`/appointments/${id}/cancel`, { reason }),

  repairOrder: (id: string) => request<RepairOrder>(`/repair-orders/${id}`),
  repairOrders: (dealerId: string) => request<RepairOrder[]>(`/repair-orders?dealerId=${dealerId}`),
  assign: (id: string, technician: string) => post<RepairOrder>(`/repair-orders/${id}/assign`, { technician }),
  requestParts: (id: string, lines: { sku: string; quantity: number }[]) =>
    post<RepairOrder>(`/repair-orders/${id}/parts`, { lines }),
  complete: (id: string) => post<RepairOrder>(`/repair-orders/${id}/complete`),
  cancelRepairOrder: (id: string, reason: string) => post<RepairOrder>(`/repair-orders/${id}/cancel`, { reason }),

  parts: (dealerId: string, fitment?: Fitment) =>
    request<Part[]>(`/parts?dealerId=${dealerId}${fitment ? `&fitment=${fitment}` : ''}`),
  restock: (dealerId: string, sku: string, quantity: number) =>
    post<Part>(`/parts/${dealerId}/${sku}/restock`, { quantity }),

  notifications: (limit = NOTIFICATIONS_LIMIT) => request<Notification[]>(`/notifications?limit=${limit}`),
};
