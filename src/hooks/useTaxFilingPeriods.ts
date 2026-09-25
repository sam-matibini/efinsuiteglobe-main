/**
 * useTaxFilingPeriods — manage tax filing periods + lock/unlock/generate.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type TaxFilingPeriodStatus = 'open' | 'filed' | 'locked' | 'paid';

export interface TaxFilingPeriod {
  id: string;
  organization_id: string;
  tax_authority_id: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: TaxFilingPeriodStatus;
  filed_at: string | null;
  filed_by: string | null;
  paid_at: string | null;
  tax_return_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTaxFilingPeriods(authorityId?: string) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: ['tax-filing-periods', orgId, authorityId ?? 'all'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      let q = supabase
        .from('tax_filing_periods')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_start', { ascending: false });
      if (authorityId) q = q.eq('tax_authority_id', authorityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaxFilingPeriod[];
    },
  });

  const generatePeriods = useMutation({
    mutationFn: async ({ authorityId, year }: { authorityId: string; year: number }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.rpc('generate_tax_filing_periods', {
        p_organization_id: orgId,
        p_tax_authority_id: authorityId,
        p_year: year,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['tax-filing-periods', orgId] });
      toast.success(`Generated ${count} filing period${count === 1 ? '' : 's'}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const lockPeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase.rpc('lock_tax_filing_period', {
        p_filing_period_id: periodId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-filing-periods', orgId] });
      toast.success('Filing period locked');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unlockPeriod = useMutation({
    mutationFn: async ({ periodId, reason }: { periodId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('unlock_tax_filing_period', {
        p_filing_period_id: periodId,
        p_reason: reason,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-filing-periods', orgId] });
      toast.success('Filing period unlocked');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markFiled = useMutation({
    mutationFn: async (periodId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('tax_filing_periods')
        .update({
          status: 'filed',
          filed_at: new Date().toISOString(),
          filed_by: userRes.user?.id ?? null,
        })
        .eq('id', periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-filing-periods', orgId] });
      toast.success('Marked as filed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markPaid = useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase
        .from('tax_filing_periods')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-filing-periods', orgId] });
      toast.success('Marked as paid');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    periods: query.data ?? [],
    isLoading: query.isLoading,
    generatePeriods,
    lockPeriod,
    unlockPeriod,
    markFiled,
    markPaid,
  };
}
