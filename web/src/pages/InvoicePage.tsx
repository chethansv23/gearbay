import { useEffect, useState } from 'react';
import { api, type Dealer, type RepairOrder } from '../api';
import { InvoiceView } from '../components/InvoiceView';
import { AUTO_PRINT_DELAY_MS } from '../constants';

/**
 * Stand-alone invoice at #/invoice/<id>. Printing a dedicated page is far more reliable than printing
 * a dialog layered over the app. With ?print it opens the browser's print dialog once loaded.
 */
export function InvoicePage({ id, autoPrint }: { id: string; autoPrint: boolean }) {
  const [order, setOrder] = useState<RepairOrder | null>(null);
  const [dealer, setDealer] = useState<Dealer | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.repairOrder(id)
      .then(async (ro) => {
        setOrder(ro);
        setDealer((await api.dealers()).find((d) => d.id === ro.dealerId));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  const ready = order !== null && dealer !== undefined;
  useEffect(() => {
    if (ready && autoPrint) {
      const timer = setTimeout(() => window.print(), AUTO_PRINT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [ready, autoPrint]);

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar no-print">
        <a href="#/workshop" className="btn">← Back to workshop</a>
        <button className="btn primary" onClick={() => window.print()} disabled={!ready}>Print / Save as PDF</button>
      </div>
      <div className="invoice-sheet">
        {error && <div className="alert">{error}</div>}
        {!order && !error && <p className="muted">Loading invoice…</p>}
        {order && order.status !== 'COMPLETED' && <div className="alert warn">This job is not completed yet, so the totals are not final.</div>}
        {order && <InvoiceView order={order} dealer={dealer} />}
      </div>
    </div>
  );
}
