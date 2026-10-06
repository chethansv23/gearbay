import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../api';
import { appointment, dealer, serviceTypes } from '../test/fixtures';
import { BookPage } from './BookPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    api: { serviceTypes: vi.fn(), bays: vi.fn(), availability: vi.fn(), book: vi.fn() },
  };
});

const mocked = vi.mocked(api);

beforeEach(() => {
  mocked.serviceTypes.mockResolvedValue(serviceTypes);
  mocked.bays.mockResolvedValue([{ id: 4, name: 'Bike Stand 1', vehicleType: 'BIKE' }]);
  mocked.availability.mockResolvedValue({
    dealerId: dealer.id, date: '2030-01-07', durationMinutes: 60,
    slots: [
      { start: '09:00:00', end: '10:00:00', freeBays: 0 },
      { start: '10:00:00', end: '11:00:00', freeBays: 2 },
    ],
  });
});

async function fillDetails() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Name'), 'Test Rider');
  await user.type(screen.getByLabelText('Mobile'), '98450 11111');
  await user.type(screen.getByLabelText('Registration number'), 'KA05TR4242');
  return user;
}

describe('BookPage', () => {
  it('only offers services that apply to the chosen vehicle', async () => {
    const user = userEvent.setup();
    render(<BookPage dealer={dealer} />);

    expect(await screen.findByRole('button', { name: /Chain sprocket/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Wheel alignment/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Car/ }));

    expect(await screen.findByRole('button', { name: /Wheel alignment/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chain sprocket/ })).not.toBeInTheDocument();
  });

  it('disables full slots and shows free bays for the rest', async () => {
    render(<BookPage dealer={dealer} />);

    expect(await screen.findByRole('button', { name: /9:00 AM\s*Full/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /10:00 AM\s*2 of 2 free/ })).toBeEnabled();
  });

  it('books the chosen slot with an idempotency key and shows the confirmation', async () => {
    mocked.book.mockResolvedValue(appointment);
    render(<BookPage dealer={dealer} />);
    const user = await fillDetails();

    await user.click(await screen.findByRole('button', { name: /10:00 AM/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText("You're booked in!")).toBeInTheDocument();
    expect(screen.getByText('Gearbay Indiranagar, Bike Stand 1')).toBeInTheDocument();
    const [request, key] = mocked.book.mock.calls[0];
    expect(request).toMatchObject({ vehicleType: 'BIKE', serviceType: 'GENERAL_SERVICE', customerPhone: '9845011111' });
    expect(request.slotStart).toMatch(/T10:00$/);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('shows the server error and refreshes slots when the slot was taken meanwhile', async () => {
    mocked.book.mockRejectedValue(new ApiError('No BIKE bay is free at 10:00', 409, 'SLOT_UNAVAILABLE'));
    render(<BookPage dealer={dealer} />);
    const user = await fillDetails();

    await user.click(await screen.findByRole('button', { name: /10:00 AM/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('No BIKE bay is free at 10:00. Please pick another time.')).toBeInTheDocument();
    await waitFor(() => expect(mocked.availability.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('keeps the chosen slot after a validation error so the user can fix the field and resubmit', async () => {
    mocked.book
      .mockRejectedValueOnce(new ApiError('Mobile must be 10-15 digits, optionally prefixed with +', 400, 'VALIDATION_FAILED'))
      .mockResolvedValueOnce(appointment);
    render(<BookPage dealer={dealer} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Name'), 'Test Rider');
    await user.type(screen.getByLabelText('Mobile'), '98450');
    await user.type(screen.getByLabelText('Registration number'), 'KA05TR4242');
    await user.click(await screen.findByRole('button', { name: /10:00 AM/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByText(/must be 10-15 digits/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Mobile'), '11111');

    expect(screen.queryByText(/must be 10-15 digits/)).not.toBeInTheDocument();
    expect(mocked.availability).toHaveBeenCalledTimes(1); // grid not reloaded, so the slot is still selected
    const confirm = screen.getByRole('button', { name: 'Confirm booking' });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByText("You're booked in!")).toBeInTheDocument();
    expect(mocked.book.mock.calls[1][0].customerPhone).toBe('9845011111');
  });

  it('keeps the confirm button disabled until a slot is picked', async () => {
    render(<BookPage dealer={dealer} />);
    await screen.findByRole('button', { name: /Chain sprocket/ });

    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeDisabled();
  });
});
