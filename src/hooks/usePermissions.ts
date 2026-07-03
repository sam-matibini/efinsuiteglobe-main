import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';

// Permission codes matching the database
export type PermissionCode =
  // General Ledger
  | 'GL_READ'
  | 'GL_POST'
  | 'GL_VOID'
  // Financial Reports
  | 'FINANCIAL_REPORT_VIEW'
  | 'FINANCIAL_REPORT_EXPORT'
  | 'COMPILATION_CREATE'
  // Budgets
  | 'BUDGET_VIEW'
  | 'BUDGET_EDIT'
  | 'BUDGET_APPROVE'
  // Invoicing & AR
  | 'INVOICE_VIEW'
  | 'INVOICE_CREATE'
  | 'INVOICE_VOID'
  | 'PAYMENT_RECEIVE'
  // Bills & AP
  | 'BILL_VIEW'
  | 'BILL_CREATE'
  | 'BILL_APPROVE'
  | 'PAYMENT_MAKE'
  // Banking
  | 'BANK_VIEW'
  | 'BANK_RECONCILE'
  | 'BANK_TRANSFER'
  // Payroll
  | 'PAYROLL_VIEW'
  | 'PAYROLL_PROCESS'
  | 'PAYROLL_APPROVE'
  // Fixed Assets
  | 'ASSET_VIEW'
  | 'ASSET_MANAGE'
  | 'DEPRECIATION_RUN'
  // User Management
  | 'USER_VIEW'
  | 'USER_INVITE'
  | 'USER_MANAGE'
  // Organization Settings
  | 'SETTINGS_VIEW'
  | 'SETTINGS_EDIT'
  // Inventory
  | 'INVENTORY_VIEW'
  | 'INVENTORY_MANAGE'
  // Documents
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_UPLOAD';

interface Permission {
  permission_code: string;
  description: string;
  category: string;
}

/**
 * Hook to fetch and check user permissions for the current organization
 * 
 * Usage:
 * const { hasPermission, permissions, isLoading } = usePermissions();
 * 
 * // Check single permission
 * if (hasPermission('GL_POST')) { ... }
 * 
 * // Check multiple permissions (any)
 * if (hasAnyPermission(['GL_POST', 'GL_VOID'])) { ... }
 * 
 * // Check multiple permissions (all)
 * if (hasAllPermissions(['GL_READ', 'GL_POST'])) { ... }
 */
export function usePermissions() {
  const { user, isAdmin } = useAuth();
  const { organization } = useCurrentOrganization();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['user-permissions', user?.id, organization?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return [];

      const { data, error } = await supabase.rpc('get_user_org_permissions', {
        p_user_id: user.id,
        p_organization_id: organization.id,
      });

      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }

      return (data || []) as Permission[];
    },
    enabled: !!user?.id && !!organization?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Create a set of permission codes for fast lookup
  const permissionSet = new Set(permissions.map((p) => p.permission_code));

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permissionCode: PermissionCode): boolean => {
    // Global admins have all permissions
    if (isAdmin) return true;
    return permissionSet.has(permissionCode);
  };

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = (permissionCodes: PermissionCode[]): boolean => {
    if (isAdmin) return true;
    return permissionCodes.some((code) => permissionSet.has(code));
  };

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = (permissionCodes: PermissionCode[]): boolean => {
    if (isAdmin) return true;
    return permissionCodes.every((code) => permissionSet.has(code));
  };

  /**
   * Get permissions grouped by category
   */
  const getPermissionsByCategory = () => {
    const grouped: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      if (!grouped[p.category]) {
        grouped[p.category] = [];
      }
      grouped[p.category].push(p);
    });
    return grouped;
  };

  return {
    permissions,
    permissionSet,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getPermissionsByCategory,
  };
}

/**
 * Hook to check a single permission (optimized for conditional rendering)
 */
export function useHasPermission(permissionCode: PermissionCode): boolean {
  const { hasPermission, isLoading } = usePermissions();
  
  // While loading, we default to false for safety
  if (isLoading) return false;
  
  return hasPermission(permissionCode);
}
