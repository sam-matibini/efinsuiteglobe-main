import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganizationModules } from './useModules';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { roleHasModuleAccess } from '@/config/roleModuleAccess';
import { isModuleInPlan } from '@/config/planModuleAccess';
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
  | 'leases';

export function useEnabledModules() {
  const { currentOrganization } = useOrganizationContext();
  const { user, isAdmin } = useAuth();
  const { data: orgModules, isLoading: modulesLoading } = useOrganizationModules(currentOrganization?.id);

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
      if (error) return null;
      return data?.role || null;
    },
    enabled: !!user?.id && !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = modulesLoading || roleLoading;

  // Effective role: use org-level role when available; only fall back to global admin as owner
  const effectiveRole = userRole || (isAdmin ? 'owner' : 'member');

  const enabledModules = useMemo(() => {
    const enabled = new Set<ModuleCode>();
    
    if (!orgModules) return enabled;
    
    orgModules.forEach(om => {
      if (om.is_enabled && om.module?.code) {
        enabled.add(om.module.code as ModuleCode);
      }
    });
    
    return enabled;
  }, [orgModules]);

  const isModuleEnabled = useCallback((code: ModuleCode): boolean => {
    // If still loading, show all (graceful fallback for loading state)
    if (isLoading) return true;
    // If no organization context yet, allow navigation (user might be on public page)
    if (!currentOrganization) return true;

    // Role-based module access check (always enforced)
    if (!roleHasModuleAccess(effectiveRole, code)) {
      return false;
    }

    // If no module configuration exists yet for this org, show core modules only by default
    if (!orgModules || orgModules.length === 0) {
      const coreModules: ModuleCode[] = [
        'general_ledger',
        'accounts_payable',
        'accounts_receivable',
        'banking',
        'reporting',
        'treasury',
        'leases',
      ];
      return coreModules.includes(code);
    }
    // Fallback: if Leases has no explicit row yet, inherit visibility from Fixed Assets
    if (code === 'leases' && !enabledModules.has('leases') && enabledModules.has('fixed_assets')) {
      return true;
    }
    // Otherwise, check explicit configuration
    return enabledModules.has(code);
  }, [isLoading, currentOrganization, orgModules, enabledModules, effectiveRole]);

  const hasAnyModule = useCallback((codes: ModuleCode[]): boolean => {
    return codes.some(code => isModuleEnabled(code));
  }, [isModuleEnabled]);

  // Auditor role is read-only across all modules
  const isReadOnly = effectiveRole === 'auditor';

  return {
    enabledModules,
    isModuleEnabled,
    hasAnyModule,
    isLoading,
    userRole: effectiveRole,
    isReadOnly,
  };
}
