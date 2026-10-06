import { useEffect, useState } from 'react';
import { api, type Dealer } from './api';
import { ActivityDrawer } from './components/ActivityDrawer';
import { DEALER_STORAGE_KEY, POLL_INTERVAL_MS, TABS } from './constants';
import { BellIcon, Logo } from './components/Icons';
import { BookPage } from './pages/BookPage';
import { InventoryPage } from './pages/InventoryPage';
import { InvoicePage } from './pages/InvoicePage';
import { WorkshopPage } from './pages/WorkshopPage';
import { usePolling } from './hooks';

type Tab = (typeof TABS)[number]['id'];

const tabFromHash = (): Tab => (TABS.find((t) => `#/${t.id}` === location.hash)?.id ?? 'book');

function readDealer() {
  try { return localStorage.getItem(DEALER_STORAGE_KEY); } catch { return null; }
}

/** #/invoice/<id> or #/invoice/<id>?print */
function invoiceRoute() {
  const match = /^#\/invoice\/([0-9a-f-]+)(\?print)?$/.exec(location.hash);
  return match ? { id: match[1], autoPrint: Boolean(match[2]) } : null;
}

export function App() {
  const [invoice, setInvoice] = useState(invoiceRoute);
  useEffect(() => {
    const onHash = () => setInvoice(invoiceRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return invoice ? <InvoicePage id={invoice.id} autoPrint={invoice.autoPrint} /> : <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerId, setDealerId] = useState<string | null>(readDealer);
  const [drawer, setDrawer] = useState(false);
  const [seen, setSeen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const messages = usePolling(() => api.notifications(), POLL_INTERVAL_MS.notificationBadge, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.dealers().then(setDealers).catch(() => setError('Cannot reach the Gearbay API. Is the stack running? (make up)'));
  }, []);

  useEffect(() => {
    if (dealerId) try { localStorage.setItem(DEALER_STORAGE_KEY, dealerId); } catch { /* private mode */ }
  }, [dealerId]);

  const dealer = dealers.find((d) => d.id === dealerId) ?? dealers[0];
  const count = messages.data?.length ?? 0;
  // Messages that existed before this page opened don't count as new.
  const [baselined, setBaselined] = useState(false);
  useEffect(() => {
    if (!baselined && messages.data) { setSeen(messages.data.length); setBaselined(true); }
  }, [messages.data, baselined]);
  const unread = drawer ? 0 : Math.max(0, count - seen);

  return (
    <>
      <header className="topbar">
        <div className="brand"><Logo /><span>Gearbay</span></div>
        <nav className="tabs">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={`tab ${tab === t.id ? 'active' : ''}`}>
              {t.label}<span className="tab-who">{t.who}</span>
            </a>
          ))}
        </nav>
        <div className="topbar-right">
          {dealers.length > 0 && (
            <select className="dealer-select" value={dealer?.id} onChange={(e) => setDealerId(e.target.value)} aria-label="Branch">
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <button className="icon-btn bell" onClick={() => { setDrawer(!drawer); setSeen(count); }} aria-label="Messages sent">
            <BellIcon />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
        </div>
      </header>

      <main>
        {error && <div className="page"><div className="alert">{error}</div></div>}
        {dealer && tab === 'book' && <BookPage key={dealer.id} dealer={dealer} />}
        {dealer && tab === 'workshop' && <WorkshopPage key={dealer.id} dealer={dealer} />}
        {dealer && tab === 'inventory' && <InventoryPage key={dealer.id} dealer={dealer} />}
      </main>

      {drawer && <ActivityDrawer onClose={() => { setDrawer(false); setSeen(count); }} />}
    </>
  );
}
