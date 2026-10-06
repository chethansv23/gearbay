import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { ActivityDrawer } from './ActivityDrawer';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: { notifications: vi.fn() } };
});

describe('ActivityDrawer', () => {
  it('lists sent messages with channel, recipient and the event that caused them', async () => {
    vi.mocked(api.notifications).mockResolvedValue([
      { id: '1', eventType: 'PartLowStock', channel: 'EMAIL', recipient: 'manager+GB-BLR-IND@gearbay.dev', message: 'Low stock at GB-BLR-IND', sentAt: new Date().toISOString() },
      { id: '2', eventType: 'AppointmentBooked', channel: 'SMS', recipient: '9845011111', message: 'Hi Test Rider, your bike is confirmed', sentAt: new Date().toISOString() },
    ]);
    const onClose = vi.fn();
    render(<ActivityDrawer onClose={onClose} />);

    expect(await screen.findByText('Hi Test Rider, your bike is confirmed')).toBeInTheDocument();
    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('Appointment booked')).toBeInTheDocument();
    expect(screen.getByText('Part low stock')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('explains what to do when nothing has been sent yet', async () => {
    vi.mocked(api.notifications).mockResolvedValue([]);
    render(<ActivityDrawer onClose={() => {}} />);

    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });
});
