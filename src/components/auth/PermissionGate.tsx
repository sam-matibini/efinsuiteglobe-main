import { ReactNode } from 'react';
import { usePermissions, PermissionCode } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';

interface PermissionGateProps {
  /**
   * Single permission or array of permissions to check
   */
  permission?: PermissionCode;
  permissions?: PermissionCode[];
  
  /**
   * When multiple permissions are provided, require all (AND) or any (OR)
   * Default: 'any'
   */
  mode?: 'all' | 'any';
  
  /**
   * Content to render when user has permission
   */
  children: ReactNode;
  
  /**
   * Optional fallback content when user lacks permission
   */
  fallback?: ReactNode;
  
  /**
   * Show loading skeleton while checking permissions
   * Default: false
   */
  showLoading?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions
 * 
 * Usage:
 * <PermissionGate permission="GL_POST">
 *   <Button>Post Journal Entry</Button>
 * </PermissionGate>
 * 
 * <PermissionGate 
 *   permissions={['INVOICE_CREATE', 'INVOICE_VOID']} 
 *   mode="any"
 *   fallback={<span>No access</span>}
 * >
 *   <InvoiceActions />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  mode = 'any',
  children,
  fallback = null,
  showLoading = false,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return <Skeleton className="h-8 w-24" />;
  }

  // Determine what permissions to check
  const permsToCheck = permissions || (permission ? [permission] : []);
  
  if (permsToCheck.length === 0) {
    // No permissions specified, render children
    return <>{children}</>;
  }

  // Single permission check
  if (permsToCheck.length === 1) {
    return hasPermission(permsToCheck[0]) ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions
  const hasAccess = mode === 'all' 
    ? hasAllPermissions(permsToCheck)
    : hasAnyPermission(permsToCheck);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Higher-order component for permission-based component rendering
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permissionCode: PermissionCode,
  FallbackComponent?: React.ComponentType
) {
  return function WithPermissionComponent(props: P) {
    const { hasPermission, isLoading } = usePermissions();

    if (isLoading) {
      return <Skeleton className="h-8 w-24" />;
    }

    if (!hasPermission(permissionCode)) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }

    return <WrappedComponent {...props} />;
  };
}
