import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTreasuryAlerts(organizationId?: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['treasury-alerts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('treasury_alerts')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const ack = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('treasury_alerts')
        .update({ ack_at: new Date().toISOString(), ack_by: u.user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-alerts', organizationId] });
      toast.success('Alert acknowledged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...list, ack };
}
