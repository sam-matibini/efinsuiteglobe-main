import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSepaRails(orgId?: string) {
  const qc = useQueryClient();
  const submissions = useQuery({
    queryKey: ['intl_rail_submissions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intl_payment_rail_submissions' as any)
        .select('*').eq('organization_id', orgId!)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('sepa-credit-transfer', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.status === 'submitted' ? 'SEPA file uploaded' : 'SEPA simulated (no SFTP secrets)');
      qc.invalidateQueries({ queryKey: ['intl_rail_submissions'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { submissions: (submissions.data ?? []) as any[], isLoading: submissions.isLoading, submit };
}
