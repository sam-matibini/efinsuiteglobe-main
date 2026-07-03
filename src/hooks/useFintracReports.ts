import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface FintracReport {
  id: string;
  organization_id: string;
  tax_payment_id: string | null;
  aggregate_amount: number;
  currency: string;
  reportable_date: string;
  report_status: 'pending' | 'filed' | 'exempt';
  filed_at: string | null;
  fintrac_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useFintracReports() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['fintrac-reports', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fintrac_large_eft_reports')
        .select('*')
        .eq('organization_id', orgId!)
        .order('reportable_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FintracReport[];
    },
  });

  const markFiled = useMutation({
    mutationFn: async ({ id, fintrac_reference, notes }: { id: string; fintrac_reference: string; notes?: string }) => {
      const { error } = await supabase
        .from('fintrac_large_eft_reports')
        .update({
          report_status: 'filed',
          filed_at: new Date().toISOString(),
          fintrac_reference,
          notes: notes ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fintrac-reports', orgId] });
      toast.success('FINTRAC report marked as filed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const markExempt = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('fintrac_large_eft_reports')
        .update({ report_status: 'exempt', notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fintrac-reports', orgId] });
      toast.success('FINTRAC report marked as exempt');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    reports: query.data ?? [],
    isLoading: query.isLoading,
    pending: (query.data ?? []).filter((r) => r.report_status === 'pending'),
    markFiled,
    markExempt,
  };
}
