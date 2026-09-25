import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export function useCashFlowForecast() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const { data: forecasts = [], isLoading } = useQuery({
    queryKey: ['cashflow-forecasts', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('cashflow_forecasts')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const saveForecast = useMutation({
    mutationFn: async (params: {
      forecastName: string;
      openingBalance: number;
      periodType: string;
      startDate: string;
      endDate: string;
      forecastData: unknown;
      aiInsights?: string;
      riskAlerts?: unknown;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !orgId) throw new Error('Not authenticated');
      const { data, error } = await supabase.from('cashflow_forecasts').insert({
        organization_id: orgId,
        created_by: user.id,
        forecast_name: params.forecastName,
        opening_balance: params.openingBalance,
        period_type: params.periodType,
        start_date: params.startDate,
        end_date: params.endDate,
        forecast_data: params.forecastData as Json,
        ai_insights: params.aiInsights ?? null,
        risk_alerts: params.riskAlerts as Json ?? null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-forecasts'] });
      toast.success('Forecast saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteForecast = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cashflow_forecasts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashflow-forecasts'] });
      toast.success('Forecast deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { forecasts, isLoading, saveForecast, deleteForecast };
}
