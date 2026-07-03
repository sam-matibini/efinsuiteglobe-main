import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export type FintracKind = 'lctr' | 'str' | 'eftr';

const TABLE: Record<FintracKind, 'fintrac_lctr_reports' | 'fintrac_str_reports' | 'fintrac_eftr_reports'> = {
  lctr: 'fintrac_lctr_reports',
  str: 'fintrac_str_reports',
  eftr: 'fintrac_eftr_reports',
};

export function useFintracReportsByKind(kind: FintracKind) {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;
  const table = TABLE[kind];

  const query = useQuery({
    queryKey: ['fintrac', kind, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const markFiled = useMutation({
    mutationFn: async ({ id, fintrac_reference, notes }: { id: string; fintrac_reference: string; notes?: string }) => {
      const { error } = await (supabase as any).from(table).update({
        report_status: 'filed',
        filed_at: new Date().toISOString(),
        fintrac_reference,
        notes: notes ?? null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fintrac', kind, orgId] });
      toast.success('Report marked as filed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const markExempt = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await (supabase as any).from(table).update({
        report_status: 'exempt', notes,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fintrac', kind, orgId] });
      toast.success('Report marked as exempt');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const rows = (query.data ?? []) as any[];
  return {
    rows,
    isLoading: query.isLoading,
    pending: rows.filter((r) => r.report_status === 'pending'),
    filed: rows.filter((r) => r.report_status === 'filed'),
    markFiled,
    markExempt,
  };
}
