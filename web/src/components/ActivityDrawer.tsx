import { api } from '../api';
import { POLL_INTERVAL_MS } from '../constants';
import { ago, humanize } from '../format';
import { usePolling } from '../hooks';

/** Everything notification-service "sent", newest first: proof that events flowed through Kafka. */
export function ActivityDrawer({ onClose }: { onClose: () => void }) {
  const { data } = usePolling(() => api.notifications(), POLL_INTERVAL_MS.activityDrawer, []);

  return (
    <aside className="drawer" aria-label="Activity">
      <header className="drawer-head">
        <div>
          <h3>Messages sent</h3>
          <p className="muted small">SMS and email from notification-service</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </header>
      <div className="drawer-body">
        {data?.length === 0 && <p className="muted empty">No messages yet. Book an appointment to see one arrive.</p>}
        {data?.map((n) => (
          <article key={n.id} className="message">
            <div className="message-meta">
              <span className={`tag ${n.channel === 'SMS' ? 'tag-blue' : 'tag-amber'}`}>{n.channel}</span>
              <span className="muted small">{n.recipient}</span>
              <span className="muted small push">{ago(n.sentAt)}</span>
            </div>
            <p>{n.message}</p>
            <span className="muted tiny">{humanize(n.eventType.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase())}</span>
          </article>
        ))}
      </div>
    </aside>
  );
}
