/** SQL for the appointment service. Every function takes a pool or a transaction client. */

export async function findDealer(db, dealerId) {
  const { rows } = await db.query('select * from dealer where id = $1', [dealerId]);
  return rows[0];
}

export async function findDealers(db) {
  return (await db.query('select * from dealer order by id')).rows;
}

export async function findBays(db, dealerId, vehicleType) {
  const { rows } = vehicleType
    ? await db.query('select * from service_bay where dealer_id = $1 and vehicle_type = $2 order by id', [dealerId, vehicleType])
    : await db.query('select * from service_bay where dealer_id = $1 order by id', [dealerId]);
  return rows;
}

export async function findBusyIntervals(db, dealerId, from, to) {
  const { rows } = await db.query(
    `select bay_id, slot_start, slot_end from appointment
     where dealer_id = $1 and status <> 'CANCELLED' and slot_start < $3 and slot_end > $2`, [dealerId, from, to]);
  return rows.map((r) => ({ bayId: r.bay_id, start: r.slot_start, end: r.slot_end }));
}

export async function findByIdempotencyKey(db, key) {
  const { rows } = await db.query('select * from appointment where idempotency_key = $1', [key]);
  return rows[0];
}

export async function findById(db, id, { forUpdate = false } = {}) {
  const { rows } = await db.query(`select * from appointment where id = $1${forUpdate ? ' for update' : ''}`, [id]);
  return rows[0];
}

export async function findForDay(db, dealerId, from, to) {
  const { rows } = await db.query(
    'select * from appointment where dealer_id = $1 and slot_start >= $2 and slot_start < $3 order by slot_start',
    [dealerId, from, to]);
  return rows;
}

export async function insertAppointment(db, a) {
  const { rows } = await db.query(
    `insert into appointment (id, dealer_id, bay_id, customer_name, customer_phone, customer_email, vehicle_type,
       vehicle_number, vehicle_make, vehicle_model, service_type, slot_start, slot_end, status, idempotency_key,
       notes, created_at, updated_at, version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now(), now(), 0)
     returning *`,
    [a.id, a.dealerId, a.bayId, a.customerName, a.customerPhone, a.customerEmail, a.vehicleType, a.vehicleNumber,
      a.vehicleMake, a.vehicleModel, a.serviceType, a.slotStart, a.slotEnd, a.status, a.idempotencyKey, a.notes]);
  return rows[0];
}

export async function updateStatus(db, id, fields) {
  const { rows } = await db.query(
    `update appointment set status = $2, odometer_km = coalesce($3, odometer_km), cancel_reason = coalesce($4, cancel_reason),
       updated_at = now(), version = version + 1
     where id = $1 returning *`, [id, fields.status, fields.odometerKm ?? null, fields.cancelReason ?? null]);
  return rows[0];
}
