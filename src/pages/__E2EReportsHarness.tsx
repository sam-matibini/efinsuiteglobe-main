/**
 * E2E-only harness route mounted at /__e2e__/income-statement when the app is
 * built/served with VITE_E2E=1. Exercises the real `useFinancialReportsRealtime`
 * hook + real React Query cache against a window-driven fixture, so a Playwright
 * test can verify that a simulated recategorization event invalidates the
 * Income Statement query and re-renders the totals — without a page reload.
 *
 * NOT registered in production builds.
 */
import { useQuery } from '@tanstack/react-query';
import { useFinancialReportsRealtime } from '@/hooks/useFinancialReportsRealtime';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';

declare global {
  interface Window {
    __e2eFixture?: { revenue: number; expenses: number };
  }
}

const fetchIncomeStatement = async () => {
  const f = window.__e2eFixture ?? { revenue: 1000, expenses: 200 };
  // Tiny await so React Query reports `isFetching` long enough for the indicator
  // to flip — mirrors a real network round-trip.
  await new Promise((r) => setTimeout(r, 50));
  return { revenue: f.revenue, expenses: f.expenses, netIncome: f.revenue - f.expenses };
};

export default function E2EReportsHarness() {
  const { lastEventAt } = useFinancialReportsRealtime('e2e-org');
  const { data, isLoading } = useQuery({
    queryKey: ['income-statement', 'e2e-org'],
    queryFn: fetchIncomeStatement,
    staleTime: 0,
  });

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Income Statement (E2E)</h1>
        <RealtimeIndicator lastEventAt={lastEventAt} />
      </header>
      {isLoading || !data ? (
        <div data-testid="loading">Loading…</div>
      ) : (
        <table>
          <tbody>
            <tr>
              <td>Revenue</td>
              <td data-testid="revenue">${data.revenue.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Expenses</td>
              <td data-testid="expenses">${data.expenses.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Net Income</strong></td>
              <td data-testid="net-income"><strong>${data.netIncome.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
