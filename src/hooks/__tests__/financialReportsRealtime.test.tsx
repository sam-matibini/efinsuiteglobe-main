/**
 * Locks in the realtime contract:
 * Re-categorizing a transaction (which mutates journal_entries / journal_entry_lines / accounts)
 * must invalidate the financial-report query caches so the Income Statement re-renders
 * without a manual refresh.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Capture the realtime handlers registered by the hook (hoisted so vi.mock can use them)
const { registeredHandlers, removeChannel } = vi.hoisted(() => ({
  registeredHandlers: {} as Record<string, (payload: unknown) => void>,
  removeChannel: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const channel: any = {
    on: vi.fn((_event: string, opts: { table: string }, cb: (p: unknown) => void) => {
      registeredHandlers[opts.table] = cb;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel,
    },
  };
});

import { useFinancialReportsRealtime } from '../useFinancialReportsRealtime';
import { REPORT_QUERY_KEYS_LIST } from '../useGLPropagation';

const ORG_ID = 'org-test-1';

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useFinancialReportsRealtime', () => {
  beforeEach(() => {
    for (const k of Object.keys(registeredHandlers)) delete registeredHandlers[k];
    removeChannel.mockClear();
  });

  it('subscribes to the ledger tables that drive the Income Statement', () => {
    const qc = new QueryClient();
    renderHook(() => useFinancialReportsRealtime(ORG_ID), { wrapper: wrapper(qc) });

    expect(registeredHandlers.journal_entries).toBeTypeOf('function');
    expect(registeredHandlers.journal_entry_lines).toBeTypeOf('function');
    expect(registeredHandlers.accounts).toBeTypeOf('function');
  });

  it('invalidates every report query key when a re-categorization fires a realtime event', async () => {
    vi.useFakeTimers();
    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useFinancialReportsRealtime(ORG_ID), { wrapper: wrapper(qc) });

    // Simulate the cascade that happens when a bank transaction is re-categorized:
    // a reversal JE is posted, new JE lines are inserted, and account balances are
    // recalculated. Each of these would normally arrive as a Supabase realtime event.
    registeredHandlers.journal_entries?.({ eventType: 'INSERT' });
    registeredHandlers.journal_entry_lines?.({ eventType: 'INSERT' });
    registeredHandlers.accounts?.({ eventType: 'UPDATE' });

    // Hook debounces invalidation — flush the timer
    await vi.advanceTimersByTimeAsync(500);

    // Every report cache key must be invalidated so the Income Statement,
    // Balance Sheet, Trial Balance, etc. all refresh automatically.
    for (const key of REPORT_QUERY_KEYS_LIST) {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    }

    vi.useRealTimers();
  });

  it('does not subscribe when no organization is selected', () => {
    const qc = new QueryClient();
    renderHook(() => useFinancialReportsRealtime(null), { wrapper: wrapper(qc) });
    expect(Object.keys(registeredHandlers)).toHaveLength(0);
  });
});
