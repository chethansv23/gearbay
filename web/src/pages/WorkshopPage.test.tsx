import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { appointment, completedOrder, dealer, repairOrder } from '../test/fixtures';
import { WorkshopPage } from './WorkshopPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    api: {
      appointments: vi.fn(), repairOrders: vi.fn(), checkIn: vi.fn(), cancelAppointment: vi.fn(),
      assign: vi.fn(), complete: vi.fn(), requestParts: vi.fn(), parts: vi.fn(),
    },
  };
});

const mocked = vi.mocked(api);
const open = repairOrder({ id: 'open-1', roNumber: 'RO-2030-001003', status: 'OPEN' });
const pending = repairOrder({
  id: 'pending-1', roNumber: 'RO-2030-001004', status: 'PARTS_PENDING', technician: 'Imran S',
  parts: [{ sku: 'CHAIN-KIT', quantity: 1, status: 'REQUESTED' }],
});

beforeEach(() => {
  mocked.appointments.mockResolvedValue([appointment, { ...appointment, id: 'c1', status: 'CANCELLED' }]);
  mocked.repairOrders.mockResolvedValue([open, pending, completedOrder]);
});

const column = (title: string) => screen.getByText(title).closest('.column') as HTMLElement;

describe('WorkshopPage', () => {
  it('lists live appointments and hides cancelled ones', async () => {
    render(<WorkshopPage dealer={dealer} />);

    expect(await screen.findByText('KA05TR4242', { selector: 'td strong' })).toBeInTheDocument();
    expect(screen.getByText('1 cancelled appointment(s) hidden')).toBeInTheDocument();
  });

  it('places job cards in the column for their status', async () => {
    render(<WorkshopPage dealer={dealer} />);
    await screen.findByText('RO-2030-001003');

    expect(within(column('Checked in')).getByText('RO-2030-001003')).toBeInTheDocument();
    expect(within(column('Waiting for parts')).getByText(/Reserving stock/)).toBeInTheDocument();
    expect(within(column('Ready for pickup')).getByRole('button', { name: 'Invoice · ₹1,770.00' })).toBeInTheDocument();
  });

  it('checks a vehicle in with the odometer reading', async () => {
    mocked.checkIn.mockResolvedValue({ ...appointment, status: 'CHECKED_IN' });
    const user = userEvent.setup();
    render(<WorkshopPage dealer={dealer} />);

    await user.type(await screen.findByPlaceholderText('Odometer km'), '12a400');
    await user.click(screen.getByRole('button', { name: 'Check in' }));

    expect(mocked.checkIn).toHaveBeenCalledWith(appointment.id, 12400);
  });

  it('assigns the selected technician when work starts', async () => {
    mocked.assign.mockResolvedValue({ ...open, status: 'IN_PROGRESS' });
    const user = userEvent.setup();
    render(<WorkshopPage dealer={dealer} />);
    await screen.findByText('RO-2030-001003');

    await user.selectOptions(within(column('Checked in')).getByRole('combobox'), 'Priya N');
    await user.click(screen.getByRole('button', { name: 'Start work' }));

    expect(mocked.assign).toHaveBeenCalledWith('open-1', 'Priya N');
  });

  it('shows an action error from the server', async () => {
    mocked.assign.mockRejectedValue(new Error('Repair order RO-2030-001003 cannot go from OPEN to COMPLETED'));
    const user = userEvent.setup();
    render(<WorkshopPage dealer={dealer} />);
    await screen.findByText('RO-2030-001003');

    await user.click(screen.getByRole('button', { name: 'Start work' }));

    await waitFor(() => expect(screen.getByText(/cannot go from OPEN to COMPLETED/)).toBeInTheDocument());
  });
});
