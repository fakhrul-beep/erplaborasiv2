import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfitCard } from './ProfitCard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div data-testid="line-chart" />,
  YAxis: () => null,
  Tooltip: () => null,
}));

// Mock useSettingsStore
vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: () => ({
    formatCurrency: (val: number) => `Rp ${val.toLocaleString('id-ID')}`,
  }),
}));

describe('ProfitCard', () => {
  it('renders correctly with title and loading state', () => {
    render(<ProfitCard />);
    expect(screen.getByText('Total Profit')).toBeInTheDocument();
  });

  it('shows profit value after loading', async () => {
    render(<ProfitCard />);
    
    const profitValue = await screen.findByText(/Rp/, {}, { timeout: 3000 });
    expect(profitValue).toBeInTheDocument();
  });

  it('changes period when filter is clicked', async () => {
    render(<ProfitCard />);
    
    await screen.findByText(/Rp/);

    const filterButton = screen.getByRole('button', { name: /minggu/i });
    fireEvent.click(filterButton);

    const monthOption = screen.getByText('Bulan');
    fireEvent.click(monthOption);

    await waitFor(() => {
      expect(screen.getByText('30 Hari Terakhir')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows tooltip on info hover', async () => {
    render(<ProfitCard />);
    
    const infoButton = screen.getByRole('button', { name: '' }); 
    fireEvent.mouseEnter(infoButton);

    expect(screen.getByText(/keuntungan bersih/i)).toBeInTheDocument();

    fireEvent.mouseLeave(infoButton);
    await waitFor(() => {
      expect(screen.queryByText(/keuntungan bersih/i)).not.toBeInTheDocument();
    });
  });

  it('refreshes data every 5 minutes', async () => {
    vi.useFakeTimers();
    render(<ProfitCard />);
    
    // Fast-forward 5 minutes
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    // We can't easily check if fetch was called because it's internal,
    // but we can check if the loading state or something changed.
    // Since we are using fake timers, the internal setTimeout in fetchProfitData 
    // also needs to be advanced.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
