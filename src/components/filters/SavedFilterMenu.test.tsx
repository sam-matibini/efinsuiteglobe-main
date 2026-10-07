import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedFilterMenu } from './SavedFilterMenu';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { ReportFiltersProvider } from '@/hooks/useReportFilters';
import type { SavedFilter } from '@/lib/savedFilters';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const saved: SavedFilter<{ status: string }> = {
  id: 'pending',
  name: 'Pending deposits',
  value: { status: 'pending' },
  updatedAt: '2026-10-03T00:00:00.000Z',
};

describe('SavedFilterMenu', () => {
  it('applies a saved filter and deletes it after confirmation', () => {
    const onApply = vi.fn();
    const onDelete = vi.fn();
    render(
      <SavedFilterMenu
        items={[saved]}
        onSave={vi.fn(() => ({ saved: null, updated: false, error: 'empty' as const }))}
        onApply={onApply}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pending deposits' }));
    expect(onApply).toHaveBeenCalledWith(saved);

    fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Pending deposits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('pending');
  });

  it('saves the current filter under the entered name', () => {
    const onSave = vi.fn(() => ({
      saved: { ...saved, name: 'This month' },
      updated: false,
    }));
    render(
      <SavedFilterMenu
        items={[]}
        onSave={onSave}
        onApply={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'This month' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('This month');
  });

  it('saves and reapplies a financial report filter', () => {
    localStorage.clear();
    const onDateRangeChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ReportFiltersProvider>
          <ReportFilters onDateRangeChange={onDateRangeChange} />
        </ReportFiltersProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
    fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'October close' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'October close' }));
    expect(onDateRangeChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Saved filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete October close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'October close' })).not.toBeInTheDocument();
  });
});
