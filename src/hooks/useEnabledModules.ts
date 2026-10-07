import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationModules } from './useModules';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { normalizeOrgRole } from '@/config/roleModuleAccess';
import { isModuleInPlan } from '@/config/planModuleAccess';
import { isModuleEnabledForRole, isReadOnlyOrgRole, type OrgModuleRow } from '@/lib/roleAccess';
import { useSubscription } from './useSubscription';



export type ModuleCode =
  | 'general_ledger'
  | 'accounts_payable'
  | 'accounts_receivable'
  | 'payroll'
  | 'banking'
  | 'fixed_assets'
  | 'budgeting'
  | 'practice_management'
  | 'donations'
  | 'inventory'
  | 'reporting'
  | 'docsign'
  | 'communication'
  | 'accountant_dashboard'
  | 'treasury'
  | 'leases'
  | 'cra_tax';

export function useEnabledModules() {
  const { currentOrganization } = useOrganizationContext();
  const { user, isAdmin } = useAuth();
  const { data: orgModules, isLoading: modulesLoading } = useOrganizationModules(currentOrganization?.id);
  const { planTier, isLoading: subLoading } = useSubscription();


  // Fetch the user's role in the current organization
  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ['user-org-role-modules', user?.id, currentOrganization?.id],
    queryFn: async () => {
      if (!user?.id || !currentOrganization?.id) return null;
      const { data, error } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();
      // Throw so a failed read is not cached as the member role.
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!user?.id && !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = modulesLoading || roleLoading || subLoading;

  const effectiveRole = userRole
    ? normalizeOrgRole(userRole)
    : (isAdmin ? 'owner' : 'member');

  const moduleRows = useMemo<OrgModuleRow[] | null>(() => {
    if (!orgModules) return null;
    return orgModules.map((om) => ({
      code: om.module?.code ?? null,
      is_enabled: om.is_enabled,
    }));
  }, [orgModules]);

  const enabledModules = useMemo(() => {
    const enabled = new Set<ModuleCode>();
    if (!moduleRows) return enabled;
    moduleRows.forEach((row) => {
      if (row.is_enabled !== false && row.code) enabled.add(row.code as ModuleCode);
    });
    return enabled;
  }, [moduleRows]);

  const isModuleEnabled = useCallback((code: ModuleCode): boolean => {
    if (isLoading) return true;
    if (!currentOrganization) return true;
    return isModuleEnabledForRole(effectiveRole, code, moduleRows);
  }, [isLoading, currentOrganization, moduleRows, effectiveRole]);

  const hasAnyModule = useCallback((codes: ModuleCode[]): boolean => {
    return codes.some(code => isModuleEnabled(code));
  }, [isModuleEnabled]);

  // Plan-based gating (separate from role/org gating so sidebar can show locked items)
  const isModuleInCurrentPlan = useCallback((code: ModuleCode): boolean => {
    if (isAdmin) return true;
    // The role card is the access list. Do not lock a module that role already has.
    if (!isLoading && currentOrganization && isModuleEnabled(code)) return true;
    return isModuleInPlan(code, planTier);
  }, [isAdmin, isLoading, currentOrganization, isModuleEnabled, planTier]);

  const isReadOnly = isReadOnlyOrgRole(effectiveRole);

  return {
    enabledModules,
    isModuleEnabled,
    isModuleInCurrentPlan,
    hasAnyModule,
    isLoading,
    userRole: effectiveRole,
    isReadOnly,
    planTier,
  };
}

