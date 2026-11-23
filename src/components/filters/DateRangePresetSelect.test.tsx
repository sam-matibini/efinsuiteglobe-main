import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangePresetSelect } from './DateRangePresetSelect';
import { BANKING_DATE_PRESETS, STATEMENT_DATE_PRESETS } from '@/lib/dateRangePresets';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function openSelect() {
  const trigger = screen.getByRole('combobox', { name: 'Date range' });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
  fireEvent.click(trigger);
}

describe('DateRangePresetSelect', () => {
  it('lists the Zoho Books periods used on banking transactions', () => {
    const onValueChange = vi.fn();
    render(
      <DateRangePresetSelect
        value="all"
        presets={BANKING_DATE_PRESETS}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveTextContent('All Time');
    openSelect();

    for (const label of [
      'All Time',
      'Today',
      'This Week',
      'This Month',
      'This Quarter',
      'This Year',
      'Yesterday',
      'Last Week',
      'Last Month',
      'Last Quarter',
      'Last Year',
      'Year to Date',
      'Custom Range',
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('option', { name: 'Last Quarter' }));
    expect(onValueChange).toHaveBeenCalledWith('last-quarter');
  });

  it('adds fiscal periods on financial statements', () => {
    render(
      <DateRangePresetSelect
        value="last-fiscal-year"
        presets={STATEMENT_DATE_PRESETS}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Date range' })).toHaveTextContent('Last Fiscal Year');
    openSelect();
    expect(screen.getByRole('option', { name: 'Fiscal Year to Date' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'This Quarter' })).toBeInTheDocument();
  });
});
