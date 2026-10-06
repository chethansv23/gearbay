import { useState } from 'react';
import { api, type Dealer, type Fitment } from '../api';
import { FITMENT_FILTERS, POLL_INTERVAL_MS, RESTOCK_QUANTITY } from '../constants';
import { rupees } from '../format';
import { usePolling } from '../hooks';

export function InventoryPage({ dealer }: { dealer: Dealer }) {
  const [filter, setFilter] = useState<Fitment | undefined>();
  const { data, refresh } = usePolling(() => api.parts(dealer.id), POLL_INTERVAL_MS.inventory, [dealer.id]);
  const parts = (data ?? []).filter((p) => !filter || p.fitment === filter);
  const low = (data ?? []).filter((p) => p.lowStock).length;

  async function restock(sku: string) {
    await api.restock(dealer.id, sku, RESTOCK_QUANTITY);
    refresh();
  }

  return (
    <div className="page">
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Parts inventory</h2>
            <p className="muted small">
              <strong>Reserved</strong> parts are promised to open job cards. They leave the shelf when the job completes, or return to stock if it's cancelled.
            </p>
          </div>
          <div className="chips">
            {FITMENT_FILTERS.map((f) => (
              <button key={f.label} className={`chip ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>{f.label}</button>
            ))}
          </div>
        </div>
        {low > 0 && <div className="alert warn">{low} part(s) at or below reorder level. The service manager has been emailed.</div>}
        <table className="table">
          <thead>
            <tr><th>Part</th><th>Fits</th><th className="right">Price</th><th>Stock</th><th className="right">Available</th><th /></tr>
          </thead>
          <tbody>
            {parts.map((p) => {
              const scale = Math.max(p.onHand, p.reorderLevel * 2, 1);
              return (
                <tr key={p.sku} className={p.lowStock ? 'row-low' : ''}>
                  <td><strong>{p.name}</strong><div className="muted tiny mono">{p.sku}</div></td>
                  <td><span className="tag">{p.fitment.toLowerCase()}</span></td>
                  <td className="right">{rupees(p.unitPrice)}</td>
                  <td className="stock-cell">
                    <div className="bar" title={`${p.onHand} on hand, ${p.reserved} reserved, reorder at ${p.reorderLevel}`}>
                      <div className="bar-available" style={{ width: `${(p.available / scale) * 100}%` }} />
                      <div className="bar-reserved" style={{ width: `${(p.reserved / scale) * 100}%` }} />
                      <div className="bar-reorder" style={{ left: `${(p.reorderLevel / scale) * 100}%` }} />
                    </div>
                    <span className="muted tiny">{p.onHand} on hand{p.reserved > 0 && ` · ${p.reserved} reserved`}</span>
                  </td>
                  <td className="right"><strong className={p.available === 0 ? 'text-danger' : p.lowStock ? 'text-warn' : ''}>{p.available}</strong></td>
                  <td className="right"><button className="btn sm" onClick={() => restock(p.sku)}>+{RESTOCK_QUANTITY}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="legend muted tiny">
          <span><i className="dot available" /> available</span>
          <span><i className="dot reserved" /> reserved</span>
          <span><i className="dot reorder" /> reorder level</span>
        </div>
      </section>
    </div>
  );
}
