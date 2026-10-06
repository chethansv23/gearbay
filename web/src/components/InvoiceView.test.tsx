import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { completedOrder, dealer, repairOrder } from '../test/fixtures';
import { InvoiceView } from './InvoiceView';

describe('InvoiceView', () => {
  it('shows labour, reserved parts, GST and the total', () => {
    render(<InvoiceView order={completedOrder} dealer={dealer} />);

    expect(screen.getByText('Tax invoice')).toBeInTheDocument();
    expect(screen.getByText('Gearbay Indiranagar')).toBeInTheDocument();
    expect(screen.getByText('Labour: General service')).toBeInTheDocument();
    expect(screen.getByText('Disc brake pad set (bike)')).toBeInTheDocument();
    expect(screen.getByText('Subtotal').nextElementSibling).toHaveTextContent('₹1,500.00');
    expect(screen.getByText('GST 18%').nextElementSibling).toHaveTextContent('₹270.00');
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('₹1,770.00');
  });

  it('leaves rejected parts off the bill', () => {
    render(<InvoiceView order={completedOrder} dealer={dealer} />);

    const body = screen.getAllByRole('rowgroup')[1];
    expect(within(body).getAllByRole('row')).toHaveLength(3); // labour + 2 reserved parts
    expect(screen.queryByText(/CHAIN-KIT/)).not.toBeInTheDocument();
  });

  it('shows one labour line per booked service', () => {
    const combined = repairOrder({
      status: 'COMPLETED', serviceTypes: ['GENERAL_SERVICE', 'BRAKE_SERVICE'],
      labourLines: [
        { serviceType: 'GENERAL_SERVICE', minutes: 60, amount: 400 },
        { serviceType: 'BRAKE_SERVICE', minutes: 60, amount: 400 },
      ],
      labourAmount: 800, partsAmount: 0, taxAmount: 144, totalAmount: 944,
    });
    render(<InvoiceView order={combined} dealer={dealer} />);

    expect(screen.getByText(/Labour: General service/)).toBeInTheDocument();
    expect(screen.getByText(/Labour: Brake service/)).toBeInTheDocument();
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('₹944.00');
  });
});
