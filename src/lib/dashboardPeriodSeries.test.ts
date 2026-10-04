import { describe, expect, it } from 'vitest';
import { monthsOverlapping, revenueExpenseByMonth } from './dashboardPeriodSeries';

describe('dashboard period series', () => {
  it('keeps a single day inside that month', () => {
    const today = new Date(2026, 9, 4);
    expect(monthsOverlapping(today, today).map((month) => month.label)).toEqual(['Oct']);
    const series = revenueExpenseByMonth(
      [
        { entryDate: '2026-10-04', accountCode: '4-01-100', debit: 0, credit: 250 },
        { entryDate: '2026-10-04', accountCode: '6-03-105', debit: 40, credit: 0 },
        { entryDate: '2026-09-30', accountCode: '4-01-100', debit: 0, credit: 9000 },
      ],
      today,
      today,
    );
    expect(series).toEqual([{ month: 'Oct', revenue: 250, expenses: 40 }]);
  });

  it('splits a year into the months that overlap the range', () => {
    const series = revenueExpenseByMonth(
      [
        { entryDate: '2026-01-15', accountCode: '4000', debit: 0, credit: 100 },
        { entryDate: '2026-03-02', accountCode: '5000', debit: 30, credit: 0 },
      ],
      new Date(2026, 0, 1),
      new Date(2026, 2, 31),
    );
    expect(series.map((point) => point.month)).toEqual(['Jan', 'Feb', 'Mar']);
    expect(series[0]).toMatchObject({ revenue: 100, expenses: 0 });
    expect(series[1]).toMatchObject({ revenue: 0, expenses: 0 });
    expect(series[2]).toMatchObject({ revenue: 0, expenses: 30 });
  });
});
