/**
 * Subscribe to GL changes via Supabase Realtime and invalidate all financial
 * report queries so Income Statement / Balance Sheet / etc. refresh
 * automatically when bank, credit-card, or journal-entry edits land.
 *
 * Returns `lastEventAt` — a timestamp (ms) that updates each time a realtime
 * event for the watched ledger tables arrives. Useful for driving a UI
 * "Updating…" indicator on report screens.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { REPORT_QUERY_KEYS_LIST } from './useGLPropagation';

export function useFinancialReportsRealtime(organizationId?: string | null) {
  const queryClient = useQueryClient();
  const [lastEventAt, setLastEventAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!organizationId) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      setLastEventAt(Date.now());
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        for (const key of REPORT_QUERY_KEYS_LIST) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }, 400);
    };

    const channel = supabase
      .channel(`fin-reports-${organizationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_entries', filter: `organization_id=eq.${organizationId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'journal_entry_lines' },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `organization_id=eq.${organizationId}` },
        refresh
      )
      .subscribe();

    // E2E escape hatch: expose the same `refresh` callback that realtime
    // would invoke, so a Playwright test can simulate a recategorization
    // event without a live websocket. Stripped from production builds.
    if (import.meta.env.VITE_E2E === '1' && typeof window !== 'undefined') {
      (window as unknown as { __e2eTriggerReportsRefresh?: () => void }).__e2eTriggerReportsRefresh = refresh;
    }

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
      if (import.meta.env.VITE_E2E === '1' && typeof window !== 'undefined') {
        delete (window as unknown as { __e2eTriggerReportsRefresh?: () => void }).__e2eTriggerReportsRefresh;
      }
    };
  }, [organizationId, queryClient]);

  return { lastEventAt };
}
