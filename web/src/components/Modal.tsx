import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Rendered under <body>, outside the app root, so print CSS can hide the app and keep the dialog.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
