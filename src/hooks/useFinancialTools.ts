import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export function useFinancialTools(toolType?: string) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['financial-tools', orgId, toolType],
    queryFn: async () => {
      if (!orgId) return [];
      let query = supabase
        .from('ai_financial_tools')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (toolType) query = query.eq('tool_type', toolType);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const saveTool = useMutation({
    mutationFn: async (params: {
      toolType: string;
      name: string;
      inputs: Record<string, unknown>;
      results: Record<string, unknown>;
      aiInsights?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !orgId) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('ai_financial_tools').insert({
        organization_id: orgId,
        created_by: user.id,
        tool_type: params.toolType,
        name: params.name,
        inputs: params.inputs as Json,
        results: params.results as Json,
        ai_insights: params.aiInsights ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-tools'] });
      toast.success('Calculation saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_financial_tools').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-tools'] });
      toast.success('Calculation deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { tools, isLoading, saveTool, deleteTool };
}
