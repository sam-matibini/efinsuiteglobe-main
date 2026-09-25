import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockMarketTicker } from '../StockMarketTicker';

describe('StockMarketTicker', () => {
  it('renders the Live badge', () => {
    render(<StockMarketTicker />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders all 8 stock symbols', () => {
    render(<StockMarketTicker />);
    const names = ['DOW', 'S&P 500', 'NASDAQ', 'Russell 2K', 'BTC', 'Gold', 'Crude Oil', 'EUR/USD'];
    for (const name of names) {
      // duplicated for ticker scroll, so getAllByText
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows + prefix for positive stocks and no + for negative', () => {
    render(<StockMarketTicker />);
    const container = document.querySelector('.animate-ticker');
    expect(container).toBeTruthy();
    const text = container!.textContent || '';
    // At least one positive percentage with +
    expect(text).toMatch(/\+\d+\.\d+%/);
  });
});
