import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { completedOrder, dealer, repairOrder } from '../test/fixtures';
import { InvoicePage } from './InvoicePage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: { repairOrder: vi.fn(), dealers: vi.fn() } };
});

const mocked = vi.mocked(api);

beforeEach(() => {
  mocked.dealers.mockResolvedValue([dealer]);
  vi.spyOn(window, 'print').mockImplementation(() => {});
});

describe('InvoicePage', () => {
  it('renders the invoice on its own page and opens the print dialog when asked', async () => {
    mocked.repairOrder.mockResolvedValue(completedOrder);
    render(<InvoicePage id={completedOrder.id} autoPrint />);

    expect(await screen.findByText('Gearbay Indiranagar')).toBeInTheDocument();
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('₹1,770.00');
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });

  it('does not print automatically unless asked', async () => {
    mocked.repairOrder.mockResolvedValue(completedOrder);
    render(<InvoicePage id={completedOrder.id} autoPrint={false} />);

    await screen.findByText('Gearbay Indiranagar');
    await new Promise((r) => setTimeout(r, 400));
    expect(window.print).not.toHaveBeenCalled();
  });

  it('warns when the job is not completed yet', async () => {
    mocked.repairOrder.mockResolvedValue(repairOrder({ status: 'IN_PROGRESS' }));
    render(<InvoicePage id="x" autoPrint={false} />);

    expect(await screen.findByText(/not completed yet/)).toBeInTheDocument();
  });

  it('shows an error for an unknown repair order', async () => {
    mocked.repairOrder.mockRejectedValue(new Error('Repair order x not found'));
    render(<InvoicePage id="x" autoPrint={false} />);

    expect(await screen.findByText('Repair order x not found')).toBeInTheDocument();
  });
});
