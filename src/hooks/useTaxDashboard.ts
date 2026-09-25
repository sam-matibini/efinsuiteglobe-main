/**
 * useTaxDashboard — aggregates current-period tax KPIs for the dashboard widget.
 *
 * Source of truth: General Ledger (via the get_tax_movements_by_code RPC) so
 * every tax-bearing entry — invoices, bills, expenses, bank categorisations,
 * and manual journal entries — is captured uniformly.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxExceptions } from '@/hooks/useTaxExceptions';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export interface TaxDashboardData {
  periodLabel: string;
  collected: number;
  itc: number;
  netPayable: number;
  nextDueDate: string | null;
  nextDueAuthority: string | null;
  daysUntilDue: number | null;
  exceptionsCount: number;
  criticalExceptionsCount: number;
  sparkline: { period: string; net: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface MovementRow {
  side: 'collected' | 'paid';
  tax_amount: number;
  is_recoverable: boolean | null;
}

async function fetchMovements(orgId: string, start: string, end: string): Promise<MovementRow[]> {
  const { data, error } = await (supabase.rpc as any)('get_tax_movements_by_code', {
    p_org_id: orgId,
    p_start_date: start,
    p_end_date: end,
  });
  if (error) throw error;
  return (data ?? []) as MovementRow[];
}

export function useTaxDashboard() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const { data: exceptions = [] } = useTaxExceptions({ organizationId: orgId });

  const query = useQuery<TaxDashboardData>({
    queryKey: ['tax-dashboard', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const today = new Date();
      const periodStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const periodEnd = format(endOfMonth(today), 'yyyy-MM-dd');

      // Current-period totals from the GL.
      const monthRows = await fetchMovements(orgId!, periodStart, periodEnd);
      let collected = 0;
      let itc = 0;
      for (const r of monthRows) {
        const amt = Number(r.tax_amount || 0);
        if (r.side === 'collected') collected += amt;
        else if (r.is_recoverable !== false) itc += amt;
      }

      // Next filing due (open period with earliest due date)
      const { data: nextPeriod } = await supabase
        .from('tax_filing_periods')
        .select('due_date, tax_authority_id, tax_authorities(name)')
        .eq('organization_id', orgId!)
        .eq('status', 'open')
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      const nextDueDate = nextPeriod?.due_date ?? null;
      const nextDueAuthority = (nextPeriod as any)?.tax_authorities?.name ?? null;
      const daysUntilDue = nextDueDate
        ? Math.ceil((new Date(nextDueDate).getTime() - today.getTime()) / 86400000)
        : null;

      // 6-period sparkline (last 6 months) — one RPC per month for clarity.
      const sparkline: { period: string; net: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(today, i);
        const ms = format(startOfMonth(m), 'yyyy-MM-dd');
        const me = format(endOfMonth(m), 'yyyy-MM-dd');
        const rows = await fetchMovements(orgId!, ms, me);
        const net = rows.reduce((s, r) => {
          const amt = Number(r.tax_amount || 0);
          if (r.side === 'collected') return s + amt;
          if (r.is_recoverable !== false) return s - amt;
          return s;
        }, 0);
        sparkline.push({ period: format(m, 'MMM'), net: round2(net) });
      }

      return {
        periodLabel: format(today, 'MMMM yyyy'),
        collected: round2(collected),
        itc: round2(itc),
        netPayable: round2(collected - itc),
        nextDueDate,
        nextDueAuthority,
        daysUntilDue,
        exceptionsCount: exceptions.length,
        criticalExceptionsCount: exceptions.filter((e) => e.severity === 'critical').length,
        sparkline,
      };
    },
  });

  return query;
}
