import type { Dealer, RepairOrder } from '../api';
import { GST_LABEL } from '../constants';
import { duration, humanize, rupees } from '../format';

/** The invoice body, shared by the preview dialog and the printable invoice page. */
export function InvoiceView({ order, dealer }: { order: RepairOrder; dealer?: Dealer }) {
  const reserved = order.parts.filter((p) => p.status === 'RESERVED');
  const subtotal = order.labourAmount + (order.partsAmount ?? 0);
  return (
    <div className="invoice">
      <div className="invoice-title">
        <strong>Tax invoice</strong>
        <span className="muted small">
          {order.roNumber} · {new Date(order.closedAt ?? order.openedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      <div className="invoice-head">
        <div><strong>{dealer?.name ?? order.dealerId}</strong><div className="muted small">{dealer?.city}</div></div>
        <div className="right"><strong>{order.customerName}</strong><div className="muted small">{order.customerPhone}</div></div>
      </div>
      <p className="small">
        {order.vehicleType === 'CAR' ? 'Car' : 'Bike'} <strong className="mono">{order.vehicleNumber}</strong>
        {order.vehicleMake && ` · ${order.vehicleMake} ${order.vehicleModel ?? ''}`}
        {order.technician && ` · Technician ${order.technician}`}
      </p>
      <table className="table invoice-table">
        <thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
        <tbody>
          {order.labourLines.map((line) => (
            <tr key={line.serviceType}>
              <td>Labour: {humanize(line.serviceType)} <span className="muted small">({duration(line.minutes)})</span></td>
              <td className="right">1</td>
              <td className="right">{rupees(line.amount)}</td><td className="right">{rupees(line.amount)}</td>
            </tr>
          ))}
          {reserved.map((p) => (
            <tr key={p.sku}>
              <td>{p.name ?? p.sku}</td><td className="right">{p.quantity}</td>
              <td className="right">{rupees(p.unitPrice)}</td><td className="right">{rupees((p.unitPrice ?? 0) * p.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={3} className="right">Subtotal</td><td className="right">{rupees(subtotal)}</td></tr>
          <tr><td colSpan={3} className="right">{GST_LABEL}</td><td className="right">{rupees(order.taxAmount)}</td></tr>
          <tr className="grand"><td colSpan={3} className="right">Total</td><td className="right">{rupees(order.totalAmount)}</td></tr>
        </tfoot>
      </table>
      <p className="muted tiny invoice-foot">Thank you for servicing with Gearbay. This is a computer-generated invoice.</p>
    </div>
  );
}
