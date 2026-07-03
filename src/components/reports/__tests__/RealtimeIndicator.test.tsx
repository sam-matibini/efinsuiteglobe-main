import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';

function renderWithClient(ui: React.ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('RealtimeIndicator', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    qc.clear();
  });

  it('shows "Live" when idle', () => {
    renderWithClient(<RealtimeIndicator />, qc);
    expect(screen.getByRole('status')).toHaveTextContent('Live');
  });

  it('switches to "Updating…" within the realtime event window', () => {
    const { rerender } = renderWithClient(<RealtimeIndicator />, qc);
    rerender(
      <QueryClientProvider client={qc}>
        <RealtimeIndicator lastEventAt={Date.now()} />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Updating');
  });

  it('reflects in-flight financial-report queries and settles back to Live', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    const promise = new Promise((r) => (resolveFn = r));

    renderWithClient(<RealtimeIndicator />, qc);

    act(() => {
      qc.fetchQuery({
        queryKey: ['income-statement', 'test'],
        queryFn: () => promise,
      });
    });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Updating'),
    );

    await act(async () => {
      resolveFn({});
      await promise;
    });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Updated'),
    );

    await waitFor(
      () => expect(screen.getByRole('status')).toHaveTextContent('Live'),
      { timeout: 2500 },
    );
  });
});
