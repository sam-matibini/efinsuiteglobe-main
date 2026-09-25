import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';

export interface VarianceData {
  id: string;
  category: string;
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  type: 'volume' | 'price' | 'efficiency' | 'capacity' | 'fx' | 'mixed';
  aiInsight: string | null;
}

export function useBudgetVariance(budgetId?: string, period?: string) {
  const { currentOrganization } = useOrganizationContext();

  return useQuery({
    queryKey: ['budget-variance', currentOrganization?.id, budgetId, period],
    queryFn: async () => {
      if (!currentOrganization?.id || !budgetId) return [];

      // Fetch budget line items with their actuals
      const { data: lineItems, error: lineError } = await supabase
        .from('budget_line_items')
        .select(`
          id,
          line_description,
          account_id,
          accounts:account_id (name, code),
          annual_total,
          period_1, period_2, period_3, period_4, period_5, period_6,
          period_7, period_8, period_9, period_10, period_11, period_12
        `)
        .eq('budget_master_id', budgetId);

      if (lineError) throw lineError;

      // Fetch actuals for each line item
      const { data: actuals, error: actualsError } = await supabase
        .from('budget_actuals')
        .select('*')
        .in('budget_line_item_id', lineItems?.map(li => li.id) || []);

      if (actualsError) throw actualsError;

      // Calculate variance for each line item
      const varianceData: VarianceData[] = (lineItems || []).map((item: any) => {
        // Sum actuals for this line item
        const itemActuals = actuals?.filter(a => a.budget_line_item_id === item.id) || [];
        const totalActual = itemActuals.reduce((sum, a) => sum + (a.actual_amount || 0), 0);
        const budgeted = item.annual_total || 0;
        const variance = budgeted - totalActual; // Positive = favorable (under budget)
        const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

        // Determine variance type based on AI analysis or default
        const aiRecord = itemActuals.find(a => a.ai_explanation);
        let varianceType: VarianceData['type'] = 'mixed';
        if (aiRecord?.variance_type) {
          varianceType = aiRecord.variance_type as VarianceData['type'];
        }

        return {
          id: item.id,
          category: item.line_description,
          account_id: item.account_id,
          account_code: item.accounts?.code || null,
          account_name: item.accounts?.name || null,
          budgeted,
          actual: totalActual,
          variance,
          variancePercent,
          type: varianceType,
          aiInsight: aiRecord?.ai_explanation || null,
        };
      });

      return varianceData;
    },
    enabled: !!currentOrganization?.id && !!budgetId,
  });
}

export function useBudgetActualsSummary(budgetId?: string) {
  const { currentOrganization } = useOrganizationContext();

  return useQuery({
    queryKey: ['budget-actuals-summary', currentOrganization?.id, budgetId],
    queryFn: async () => {
      if (!currentOrganization?.id || !budgetId) return null;

      // Get budget total
      const { data: budget, error: budgetError } = await supabase
        .from('budget_masters')
        .select('total_amount')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;

      // Get all line items
      const { data: lineItems, error: lineError } = await supabase
        .from('budget_line_items')
        .select('id, annual_total')
        .eq('budget_master_id', budgetId);

      if (lineError) throw lineError;

      // Get all actuals
      const { data: actuals, error: actualsError } = await supabase
        .from('budget_actuals')
        .select('actual_amount')
        .in('budget_line_item_id', lineItems?.map(li => li.id) || []);

      if (actualsError) throw actualsError;

      const totalBudgeted = lineItems?.reduce((sum, li) => sum + (li.annual_total || 0), 0) || 0;
      const totalActual = actuals?.reduce((sum, a) => sum + (a.actual_amount || 0), 0) || 0;

      return {
        totalBudgeted,
        totalActual,
        variance: totalBudgeted - totalActual,
        variancePercent: totalBudgeted > 0 ? ((totalBudgeted - totalActual) / totalBudgeted) * 100 : 0,
      };
    },
    enabled: !!currentOrganization?.id && !!budgetId,
  });
}
