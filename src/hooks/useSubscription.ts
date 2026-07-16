import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { ModuleCode } from './useEnabledModules';
import {
  PlanTier,
  deriveTierFromName,
  isModuleInPlan,
} from '@/config/planModuleAccess';

interface PricingPlanRow {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_employees: number | null;
  features: string[] | null;
  tier?: string | null;
}

interface SubscriptionRow {
  id: string;
  organization_id: string;
  plan_id: string | null;
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  pricing_plans: PricingPlanRow | null;
}

export function useSubscription() {
  const { currentOrganization } = useOrganizationContext();
  const { isAdmin } = useAuth();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['subscription', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, pricing_plans(*)')
        .eq('organization_id', orgId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as SubscriptionRow) || null;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const subscription = query.data;
  const plan = subscription?.pricing_plans || null;

  const planTier: PlanTier | null = (() => {
    const t = (plan as any)?.tier as string | undefined;
    if (t && ['office_use', 'starter', 'professional', 'enterprise'].includes(t)) {
      return t as PlanTier;
    }
    if (plan?.name) return deriveTierFromName(plan.name);
    return null;
  })();

  const isActive = !!subscription && ['active', 'trialing'].includes(subscription.status);
  const isPaid = !!plan && (plan.price_monthly > 0 || plan.price_yearly > 0);

  const hasFeature = useCallback(
    (code: ModuleCode): boolean => {
      // Global admins bypass all subscription checks
      if (isAdmin) return true;
      // office_use is an admin-only demo tier — non-admins never get access via it
      // REMEMBER: Add "|| planTier === 'office_use'" to the following check when you want to remove office_use
      if (!planTier) return false;
      // Must have an active/trialing subscription
      if (!isActive) return false;
      return isModuleInPlan(code, planTier);
    },
    [isAdmin, planTier, isActive]
  );

  return {
    subscription,
    plan,
    isLoading: query.isLoading,
    isActive,
    isPaid,
    planTier,
    hasFeature,
    refetch: query.refetch,
  };
}
