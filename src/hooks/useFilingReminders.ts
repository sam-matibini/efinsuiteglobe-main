import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import type { StoredComplianceDeadline, StoredFilingPeriod } from '@/lib/receptionist/filingReminders';

/**
 * Saved compliance deadlines and tax filing periods for the receptionist.
 * A missing table or a blocked read falls back to the CRA calendar.
 */
export function useFilingReminders() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const organizationId = organization?.id;

  const stored = useQuery({
    queryKey: ['ai-receptionist-filing-sources', organizationId],
    enabled: !!organizationId,
    retry: false,
    queryFn: async () => {
      const [deadlines, periods] = await Promise.all([
        supabase
          .from('pm_compliance_deadlines')
          .select('id, filing_type, due_date, extended_due_date, status')
          .eq('organization_id', organizationId!),
        supabase
          .from('tax_filing_periods')
          .select('id, due_date, period_start, period_end, status, notes')
          .eq('organization_id', organizationId!),
      ]);
      const deadlineRows = deadlines.error ? [] : deadlines.data ?? [];
      const periodRows = periods.error ? [] : periods.data ?? [];
      return {
        deadlines: deadlineRows.map((row): StoredComplianceDeadline => ({
          id: row.id,
          filingType: row.filing_type,
          dueDate: row.due_date,
          extendedDueDate: row.extended_due_date,
          status: row.status,
        })),
        periods: periodRows.map((row): StoredFilingPeriod => ({
          id: row.id,
          dueDate: row.due_date,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          status: row.status,
          notes: row.notes,
        })),
      };
    },
  });

  return {
    fiscalYearEndMonth: organization?.fiscal_year_end_month ?? 12,
    deadlines: stored.data?.deadlines ?? [],
    periods: stored.data?.periods ?? [],
    isLoading: orgLoading || (!!organizationId && stored.isLoading),
  };
}
