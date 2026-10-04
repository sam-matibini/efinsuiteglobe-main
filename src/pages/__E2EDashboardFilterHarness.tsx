/**
 * E2E-only page for the dashboard date filter.
 * Registered at /__e2e__/dashboard-filter when served with VITE_E2E=1.
 */
import { useState } from 'react';
import { DateRangePresetSelect } from '@/components/filters/DateRangePresetSelect';
import {
  detectDateRangePreset,
  resolveDateRangePreset,
  STATEMENT_DATE_PRESETS,
  STATEMENT_PRESET_IDS,
  toLocalISO,
  type DateRangePresetId,
} from '@/lib/dateRangePresets';
import { revenueExpenseByMonth, type DashboardPeriodLine } from '@/lib/dashboardPeriodSeries';

const lines: DashboardPeriodLine[] = [
  { entryDate: '2026-10-04', accountCode: '4-01-100', accountType: 'income', debit: 0, credit: 250 },
  { entryDate: '2026-10-04', accountCode: '6-03-105', accountType: 'expense', debit: 40, credit: 0 },
  { entryDate: '2026-09-15', accountCode: '4-01-100', accountType: 'income', debit: 0, credit: 9000 },
  { entryDate: '2026-01-20', accountCode: '4000', accountType: 'income', debit: 0, credit: 1200 },
];

export default function E2EDashboardFilterHarness() {
  const today = new Date(2026, 9, 4);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const series = revenueExpenseByMonth(lines, startDate, endDate);
  const revenue = series.reduce((sum, point) => sum + point.revenue, 0);
  const expenses = series.reduce((sum, point) => sum + point.expenses, 0);

  return (
    <main className="space-y-4 bg-slate-50 p-6">
      <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePresetSelect
          value={detectDateRangePreset(startDate, endDate, STATEMENT_PRESET_IDS, today)}
          presets={STATEMENT_DATE_PRESETS}
          onValueChange={(preset: DateRangePresetId) => {
            const bounds = resolveDateRangePreset(preset, today);
            if (bounds) {
              setStartDate(bounds.start);
              setEndDate(bounds.end);
            }
          }}
        />
        <p data-testid="dashboard-period-label">
          {toLocalISO(startDate)} – {toLocalISO(endDate)}
        </p>
      </div>
      <p data-testid="dashboard-period-revenue">Revenue {revenue.toFixed(2)}</p>
      <p data-testid="dashboard-period-expenses">Expenses {expenses.toFixed(2)}</p>
      <p data-testid="dashboard-period-months">{series.map((point) => point.month).join(', ')}</p>
    </main>
  );
}
