import { useEffect, useMemo, useState } from 'react';
import { api, type Appointment, type Availability, type Bay, type Dealer, type ServiceTypeInfo, type Slot, type VehicleType } from '../api';
import { VehicleIcon } from '../components/Icons';
import { BOOKING_DAYS_AHEAD } from '../constants';
import { dayLabel, humanize, isoDate, nextDays, time12, timeOf } from '../format';

const emptyForm = { customerName: '', customerPhone: '', vehicleNumber: '', vehicleMake: '', vehicleModel: '', notes: '' };

export function BookPage({ dealer }: { dealer: Dealer }) {
  const [vehicle, setVehicle] = useState<VehicleType>('BIKE');
  const [catalog, setCatalog] = useState<ServiceTypeInfo[]>([]);
  const [service, setService] = useState('GENERAL_SERVICE');
  const days = useMemo(() => nextDays(BOOKING_DAYS_AHEAD), []);
  const [date, setDate] = useState(isoDate(days[1]));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [bays, setBays] = useState<Bay[]>([]);
  // One key per booking attempt: a double click or a retry after a timeout can't book twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { api.serviceTypes().then(setCatalog); }, []);
  useEffect(() => { api.bays(dealer.id).then(setBays); }, [dealer.id]);

  const offered = catalog.filter((s) => s.durationMinutes[vehicle] != null);
  useEffect(() => {
    if (offered.length && !offered.some((s) => s.code === service)) setService(offered[0].code);
  }, [vehicle, catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!offered.some((s) => s.code === service)) return;
    setSlot(null);
    setAvailability(null);
    api.availability(dealer.id, vehicle, service, date).then(setAvailability).catch((e) => setError(e.message));
  }, [dealer.id, vehicle, service, date, catalog, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const appointment = await api.book({
        dealerId: dealer.id, vehicleType: vehicle, serviceType: service, slotStart: `${date}T${slot.start.slice(0, 5)}`,
        customerName: form.customerName, customerPhone: form.customerPhone.replace(/\s/g, ''),
        vehicleNumber: form.vehicleNumber, vehicleMake: form.vehicleMake || undefined,
        vehicleModel: form.vehicleModel || undefined, notes: form.notes || undefined,
      }, idempotencyKey);
      setBooked(appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setReload((r) => r + 1); // someone may have taken the slot: refresh the grid
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setBooked(null);
    setForm(emptyForm);
    setSlot(null);
    setIdempotencyKey(crypto.randomUUID());
    setReload((r) => r + 1);
  }

  if (booked) {
    const bay = bays.find((b) => b.id === booked.bayId);
    return (
      <div className="page narrow">
        <div className="card confirm">
          <div className="confirm-icon"><VehicleIcon type={booked.vehicleType} size={40} /></div>
          <h2>You're booked in!</h2>
          <p className="muted">A confirmation SMS is on its way to {booked.customerPhone}. Open the bell to watch it arrive.</p>
          <dl className="summary">
            <dt>Reference</dt><dd className="mono">{booked.id.slice(0, 8).toUpperCase()}</dd>
            <dt>When</dt><dd>{new Date(booked.localStart).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, {timeOf(booked.localStart)} to {timeOf(booked.localEnd)}</dd>
            <dt>Where</dt><dd>{dealer.name}, {bay?.name ?? `bay ${booked.bayId}`}</dd>
            <dt>Vehicle</dt><dd>{booked.vehicleNumber} {booked.vehicleMake && `· ${booked.vehicleMake} ${booked.vehicleModel ?? ''}`}</dd>
            <dt>Service</dt><dd>{humanize(booked.serviceType)}</dd>
          </dl>
          <button className="btn primary" onClick={startOver}>Book another</button>
        </div>
      </div>
    );
  }

  const selectedService = catalog.find((s) => s.code === service);
  const bayTotal = dealer.bayCount[vehicle] ?? 0;

  return (
    <div className="page book-layout">
      <section className="stack">
        <div className="card">
          <h2 className="step"><span>1</span> Your vehicle</h2>
          <div className="vehicle-toggle">
            {(['BIKE', 'CAR'] as VehicleType[]).map((v) => (
              <button key={v} className={`vehicle-option ${vehicle === v ? 'active' : ''}`} onClick={() => setVehicle(v)}>
                <VehicleIcon type={v} size={36} />
                <strong>{v === 'CAR' ? 'Car' : 'Bike / scooter'}</strong>
                <span className="muted small">{dealer.bayCount[v] ?? 0} {v === 'CAR' ? 'lifts' : 'stands'} at this branch</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="step"><span>2</span> Service</h2>
          <div className="service-grid">
            {offered.map((s) => (
              <button key={s.code} className={`service-option ${service === s.code ? 'active' : ''}`} onClick={() => setService(s.code)}>
                <strong>{humanize(s.code)}</strong>
                <span className="muted small">{s.description}</span>
                <span className="tag">{s.durationMinutes[vehicle]} min</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="step"><span>3</span> Date and time</h2>
          <div className="day-strip">
            {days.map((d) => {
              const label = dayLabel(d);
              const iso = isoDate(d);
              return (
                <button key={iso} className={`day ${date === iso ? 'active' : ''}`} onClick={() => setDate(iso)}>
                  <span className="small">{label.top}</span>
                  <strong>{label.bottom}</strong>
                </button>
              );
            })}
          </div>
          {!availability && <p className="muted">Loading slots…</p>}
          {availability && availability.slots.length === 0 && (
            <p className="muted empty">No more slots on this day. Try another date.</p>
          )}
          <div className="slot-grid">
            {availability?.slots.map((s) => (
              <button key={s.start} disabled={s.freeBays === 0}
                      className={`slot ${slot?.start === s.start ? 'active' : ''} ${s.freeBays === 1 ? 'last' : ''}`}
                      onClick={() => setSlot(s)}>
                <strong>{time12(s.start)}</strong>
                <span className="tiny">{s.freeBays === 0 ? 'Full' : `${s.freeBays} of ${bayTotal} free`}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="card sticky">
        <h2 className="step"><span>4</span> Your details</h2>
        <form onSubmit={submit} className="form">
          <label>Name<input required value={form.customerName} onChange={update('customerName')} placeholder="Asha Rao" /></label>
          <label>Mobile<input required value={form.customerPhone} onChange={update('customerPhone')} placeholder="98450 12345" inputMode="tel" /></label>
          <label>Registration number<input required value={form.vehicleNumber} onChange={update('vehicleNumber')} placeholder="KA 03 HB 1234" /></label>
          <div className="row">
            <label>Make<input value={form.vehicleMake} onChange={update('vehicleMake')} placeholder={vehicle === 'CAR' ? 'Hyundai' : 'Royal Enfield'} /></label>
            <label>Model<input value={form.vehicleModel} onChange={update('vehicleModel')} placeholder={vehicle === 'CAR' ? 'Creta' : 'Classic 350'} /></label>
          </div>
          <label>Notes<textarea rows={2} value={form.notes} onChange={update('notes')} placeholder="Front brake squeals" /></label>

          <div className="booking-summary">
            <VehicleIcon type={vehicle} size={22} />
            <div>
              <strong>{selectedService ? humanize(selectedService.code) : '-'}</strong>
              <div className="muted small">
                {slot ? `${dayLabel(new Date(date + 'T00:00')).bottom}, ${time12(slot.start)} to ${time12(slot.end)}` : 'Pick a time slot'}
              </div>
            </div>
          </div>

          {error && <div className="alert">{error}</div>}
          <button className="btn primary block" disabled={!slot || submitting}>
            {submitting ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      </aside>
    </div>
  );
}
