import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { dealer, part } from '../test/fixtures';
import { InventoryPage } from './InventoryPage';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return { ...actual, api: { parts: vi.fn(), restock: vi.fn() } };
});

const mocked = vi.mocked(api);

beforeEach(() => {
  mocked.parts.mockResolvedValue([
    part({ sku: 'CHAIN-KIT', name: 'Chain and sprocket kit', onHand: 1, available: 1, lowStock: true }),
    part({ sku: 'OIL-5W30-4L', name: 'Engine oil 5W-30', fitment: 'CAR', onHand: 20, available: 18, reserved: 2 }),
    part({ sku: 'COOLANT-1L', name: 'Coolant', fitment: 'UNIVERSAL' }),
  ]);
});

describe('InventoryPage', () => {
  it('warns about low stock and shows reserved quantities', async () => {
    render(<InventoryPage dealer={dealer} />);

    expect(await screen.findByText(/1 part\(s\) at or below reorder level/)).toBeInTheDocument();
    expect(screen.getByText('20 on hand · 2 reserved')).toBeInTheDocument();
  });

  it('filters by fitment', async () => {
    const user = userEvent.setup();
    render(<InventoryPage dealer={dealer} />);
    await screen.findByText('Coolant');

    await user.click(screen.getByRole('button', { name: 'Car' }));

    expect(screen.getByText('Engine oil 5W-30')).toBeInTheDocument();
    expect(screen.queryByText('Coolant')).not.toBeInTheDocument();
    expect(screen.queryByText('Chain and sprocket kit')).not.toBeInTheDocument();
  });

  it('restocks ten units at a time', async () => {
    mocked.restock.mockResolvedValue(part({ onHand: 11 }));
    const user = userEvent.setup();
    render(<InventoryPage dealer={dealer} />);
    await screen.findByText('Coolant');

    await user.click(screen.getAllByRole('button', { name: '+10' })[0]);

    expect(mocked.restock).toHaveBeenCalledWith('GB-BLR-IND', 'CHAIN-KIT', 10);
  });
});
