import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCallback } from 'react';

/**
 * Hook to log audit events for compliance tracking
 * 
 * Usage:
 * const { logEvent } = useAuditLog();
 * 
 * await logEvent('USER_ROLE_CHANGED', 'user', userId, 
 *   { role: 'member' }, 
 *   { role: 'admin' }
 * );
 */
export function useAuditLog() {
  const { organization } = useCurrentOrganization();

  const logEvent = useCallback(async (
    action: string,
    entityType?: string,
    entityId?: string,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>
  ): Promise<string | null> => {
    if (!organization?.id) {
      console.warn('Cannot log audit event: no organization context');
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('log_audit_event', {
        p_organization_id: organization.id,
        p_action: action,
        p_entity_type: entityType || null,
        p_entity_id: entityId || null,
        p_old_values: oldValues ? JSON.stringify(oldValues) : null,
        p_new_values: newValues ? JSON.stringify(newValues) : null,
      });

      if (error) {
        console.error('Failed to log audit event:', error);
        return null;
      }

      return data as string;
    } catch (err) {
      console.error('Audit log error:', err);
      return null;
    }
  }, [organization?.id]);

  return { logEvent };
}

// Common audit action types
export const AuditActions = {
  // Authentication
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_SIGNUP: 'USER_SIGNUP',
  USER_LOGOUT: 'USER_LOGOUT',
  
  // User management
  USER_INVITED: 'USER_INVITED',
  USER_JOINED: 'USER_JOINED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_REMOVED: 'USER_REMOVED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  
  // Organization
  ORG_SETTINGS_UPDATED: 'ORG_SETTINGS_UPDATED',
  ORG_CREATED: 'ORG_CREATED',
  
  // Financial
  JOURNAL_POSTED: 'JOURNAL_POSTED',
  JOURNAL_VOIDED: 'JOURNAL_VOIDED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  INVOICE_VOIDED: 'INVOICE_VOIDED',
  BILL_CREATED: 'BILL_CREATED',
  PAYMENT_MADE: 'PAYMENT_MADE',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  
  // Payroll
  PAYROLL_PROCESSED: 'PAYROLL_PROCESSED',
  PAYROLL_APPROVED: 'PAYROLL_APPROVED',
  
  // Assets
  ASSET_ADDED: 'ASSET_ADDED',
  ASSET_DISPOSED: 'ASSET_DISPOSED',
  DEPRECIATION_RUN: 'DEPRECIATION_RUN',
  
  // Budgets
  BUDGET_CREATED: 'BUDGET_CREATED',
  BUDGET_APPROVED: 'BUDGET_APPROVED',
  
  // Reports
  REPORT_GENERATED: 'REPORT_GENERATED',
  REPORT_EXPORTED: 'REPORT_EXPORTED',
} as const;
