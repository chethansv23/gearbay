import { useMemo, useState } from 'react';
import { api, type Appointment, type Dealer, type Part, type RepairOrder } from '../api';
import { VehicleIcon } from '../components/Icons';
import { InvoiceView } from '../components/InvoiceView';
import { Modal } from '../components/Modal';
import { BOARD_COLUMNS, BOOKING_DAYS_AHEAD, MAX_PART_QUANTITY, POLL_INTERVAL_MS, TECHNICIANS } from '../constants';
import { dayLabel, humanize, humanizeList, isoDate, nextDays, rupees, timeOf } from '../format';
import { usePolling } from '../hooks';

export function WorkshopPage({ dealer }: { dealer: Dealer }) {
  const days = useMemo(() => nextDays(BOOKING_DAYS_AHEAD), []);
  const [date, setDate] = useState(isoDate(days[1]));
  const appointments = usePolling(() => api.appointments(dealer.id, date), POLL_INTERVAL_MS.appointments, [dealer.id, date]);
  const orders = usePolling(() => api.repairOrders(dealer.id), POLL_INTERVAL_MS.repairOrders, [dealer.id]);
  const [error, setError] = useState<string | null>(null);
  const [partsFor, setPartsFor] = useState<RepairOrder | null>(null);
  const [invoiceFor, setInvoiceFor] = useState<RepairOrder | null>(null);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    appointments.refresh();
    orders.refresh();
  }

  const live = (appointments.data ?? []).filter((a) => a.status !== 'CANCELLED');
  const cancelled = (appointments.data ?? []).length - live.length;

  return (
    <div className="page">
      {error && <div className="alert floating" onClick={() => setError(null)}>{error}</div>}

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Appointments</h2>
            <p className="muted small">Check a vehicle in when it arrives. That opens a job card on the board below.</p>
          </div>
          <div className="day-strip compact">
            {days.map((d) => {
              const iso = isoDate(d);
              const label = dayLabel(d);
              return (
                <button key={iso} className={`day ${date === iso ? 'active' : ''}`} onClick={() => setDate(iso)}>
                  <span className="tiny">{label.top}</span><strong className="small">{label.bottom}</strong>
                </button>
              );
            })}
          </div>
        </div>
        {appointments.data && live.length === 0 && (
          <p className="muted empty">No appointments on this day yet. Book one from the Book service tab.</p>
        )}
        {live.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Time</th><th>Vehicle</th><th>Customer</th><th>Service</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {live.map((a) => <AppointmentRow key={a.id} a={a} act={act} />)}
            </tbody>
          </table>
        )}
        {cancelled > 0 && <p className="muted tiny">{cancelled} cancelled appointment(s) hidden</p>}
      </section>

      <section>
        <div className="section-head plain">
          <h2>Workshop board</h2>
          <p className="muted small">Updates live. Parts requests are handled asynchronously by the inventory service over Kafka.</p>
        </div>
        <div className="board">
          {BOARD_COLUMNS.map((col) => {
            const items = (orders.data ?? []).filter((o) => o.status === col.status);
            return (
              <div key={col.status} className={`column col-${col.status.toLowerCase()}`}>
                <header>
                  <strong>{col.title}</strong>
                  <span className="count">{items.length}</span>
                </header>
                <p className="muted tiny">{col.hint}</p>
                {items.map((o) => (
                  <JobCard key={o.id} o={o} act={act} onParts={() => setPartsFor(o)} onInvoice={() => setInvoiceFor(o)} />
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {partsFor && (
        <PartsPicker order={partsFor} onClose={() => setPartsFor(null)}
                     onSubmit={(lines) => { setPartsFor(null); act(() => api.requestParts(partsFor.id, lines)); }} />
      )}
      {invoiceFor && <Invoice order={invoiceFor} dealer={dealer} onClose={() => setInvoiceFor(null)} />}
    </div>
  );
}

function AppointmentRow({ a, act }: { a: Appointment; act: (f: () => Promise<unknown>) => void }) {
  const [odometer, setOdometer] = useState('');
  return (
    <tr>
      <td className="nowrap"><strong>{timeOf(a.localStart)}</strong><div className="muted tiny">to {timeOf(a.localEnd)}</div></td>
      <td>
        <div className="vehicle-cell">
          <VehicleIcon type={a.vehicleType} size={22} />
          <div><strong className="mono">{a.vehicleNumber}</strong><div className="muted tiny">{[a.vehicleMake, a.vehicleModel].filter(Boolean).join(' ')}</div></div>
        </div>
      </td>
      <td>{a.customerName}<div className="muted tiny">{a.customerPhone}</div></td>
      <td>{humanizeList(a.serviceTypes)}</td>
      <td><span className={`pill pill-${a.status.toLowerCase()}`}>{humanize(a.status)}</span></td>
      <td className="actions">
        {a.status === 'BOOKED' && (
          <>
            <input className="mini" placeholder="Odometer km" value={odometer} inputMode="numeric"
                   onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ''))} />
            <button className="btn primary sm" onClick={() => act(() => api.checkIn(a.id, odometer ? Number(odometer) : undefined))}>Check in</button>
            <button className="btn ghost sm" onClick={() => act(() => api.cancelAppointment(a.id, 'Cancelled by service advisor'))}>Cancel</button>
          </>
        )}
      </td>
    </tr>
  );
}

function JobCard({ o, act, onParts, onInvoice }: {
  o: RepairOrder; act: (f: () => Promise<unknown>) => void; onParts: () => void; onInvoice: () => void;
}) {
  const [technician, setTechnician] = useState(TECHNICIANS[0]);
  return (
    <article className={`job ${o.status === 'PARTS_PENDING' ? 'pending' : ''}`}>
      <div className="job-head">
        <span className="mono small">{o.roNumber}</span>
        <span className={`vehicle-badge ${o.vehicleType.toLowerCase()}`}><VehicleIcon type={o.vehicleType} size={16} />{o.vehicleType === 'CAR' ? 'Car' : 'Bike'}</span>
      </div>
      <strong className="mono">{o.vehicleNumber}</strong>
      <div className="muted small">{[o.vehicleMake, o.vehicleModel].filter(Boolean).join(' ') || o.customerName}</div>
      <div className="small">{humanizeList(o.serviceTypes)}{o.odometerKm != null && <span className="muted"> · {o.odometerKm.toLocaleString('en-IN')} km</span>}</div>
      {o.technician && <div className="small">Technician <strong>{o.technician}</strong></div>}

      {o.parts.length > 0 && (
        <ul className="part-lines">
          {o.parts.map((p, i) => (
            <li key={i} className={`part-${p.status.toLowerCase()}`}>
              <span>{p.quantity}× {p.name ?? p.sku}</span>
              <span className="tiny">{p.status === 'RESERVED' ? rupees((p.unitPrice ?? 0) * p.quantity) : humanize(p.status)}</span>
            </li>
          ))}
        </ul>
      )}
      {o.note && o.status !== 'CANCELLED' && <div className="note">{o.note}</div>}

      <div className="job-actions">
        {o.status === 'OPEN' && (
          <>
            <select value={technician} onChange={(e) => setTechnician(e.target.value)}>
              {TECHNICIANS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button className="btn primary sm" onClick={() => act(() => api.assign(o.id, technician))}>Start work</button>
          </>
        )}
        {o.status === 'IN_PROGRESS' && (
          <>
            <button className="btn sm" onClick={onParts}>Add parts</button>
            <button className="btn primary sm" onClick={() => act(() => api.complete(o.id))}>Complete</button>
          </>
        )}
        {o.status === 'PARTS_PENDING' && <span className="muted small"><span className="spinner" /> Reserving stock…</span>}
        {o.status === 'COMPLETED' && (
          <button className="btn sm block" onClick={onInvoice}>Invoice · {rupees(o.totalAmount)}</button>
        )}
      </div>
    </article>
  );
}

function PartsPicker({ order, onClose, onSubmit }: {
  order: RepairOrder; onClose: () => void; onSubmit: (lines: { sku: string; quantity: number }[]) => void;
}) {
  const { data: parts } = usePolling(() => api.parts(order.dealerId, order.vehicleType), POLL_INTERVAL_MS.partsPicker, [order.id]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([sku, quantity]) => ({ sku, quantity }));
  const total = lines.reduce((sum, l) => sum + (parts?.find((p) => p.sku === l.sku)?.unitPrice ?? 0) * l.quantity, 0);
  const set = (p: Part, q: number) => setQty({ ...qty, [p.sku]: Math.max(0, Math.min(q, MAX_PART_QUANTITY)) });

  return (
    <Modal title={`Parts for ${order.roNumber} · ${order.vehicleNumber}`} onClose={onClose}
           footer={<>
             <span className="muted">{lines.length} item(s) · {rupees(total)}</span>
             <button className="btn primary" disabled={!lines.length} onClick={() => onSubmit(lines)}>Request parts</button>
           </>}>
      <p className="muted small">
        Showing {order.vehicleType === 'CAR' ? 'car' : 'bike'} parts and universal consumables. You can ask for more
        than is in stock; inventory will reject the whole request and tell you why.
      </p>
      <div className="parts-list">
        {parts?.map((p) => (
          <div key={p.sku} className="parts-item">
            <div>
              <strong>{p.name}</strong>
              <div className="muted tiny mono">{p.sku} · {rupees(p.unitPrice)}</div>
            </div>
            <span className={`stock ${p.available === 0 ? 'out' : p.lowStock ? 'low' : ''}`}>{p.available} in stock</span>
            <div className="stepper">
              <button onClick={() => set(p, (qty[p.sku] ?? 0) - 1)} aria-label="Less">−</button>
              <span>{qty[p.sku] ?? 0}</span>
              <button onClick={() => set(p, (qty[p.sku] ?? 0) + 1)} aria-label="More">+</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Invoice({ order, dealer, onClose }: { order: RepairOrder; dealer: Dealer; onClose: () => void }) {
  return (
    <Modal title={`Invoice ${order.roNumber}`} onClose={onClose}
           footer={<>
             <span className="muted small">Opens a printable page in a new tab</span>
             <button className="btn primary" onClick={() => window.open(`#/invoice/${order.id}?print`, '_blank')}>Print</button>
           </>}>
      <InvoiceView order={order} dealer={dealer} />
    </Modal>
  );
}
