import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TaxExceptionSeverity = 'critical' | 'warning' | 'info';
export type TaxExceptionCategory =
  | 'missing_tax_code'
  | 'rate_mismatch'
  | 'inactive_code_used'
  | 'expired_code_used'
  | 'missing_gl_mapping'
  | 'reconciliation_gap'
  | 'unmapped_jurisdiction';

export interface TaxException {
  id: string;
  category: TaxExceptionCategory;
  severity: TaxExceptionSeverity;
  title: string;
  description: string;
  entityType: 'invoice' | 'bill' | 'expense' | 'tax_code' | 'gl';
  entityId?: string;
  entityRef?: string;
  amount?: number;
  fixHref?: string;
}

interface UseTaxExceptionsParams {
  organizationId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Surfaces tax-configuration exceptions. Per-document tax detail tables
 * (invoice_taxes / bill_taxes / expense_taxes) are not populated by the
 * writers, so this hook focuses on tax_code-level issues that can be
 * detected without those rows.
 */
export function useTaxExceptions({ organizationId }: UseTaxExceptionsParams) {
  // startDate/endDate accepted for back-compat but unused (config-level checks).
  return useQuery({
    queryKey: ['tax-exceptions', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<TaxException[]> => {
      if (!organizationId) return [];
      const exceptions: TaxException[] = [];

      const { data: taxCodes } = await supabase
        .from('tax_codes')
        .select('id, code, name, rate, is_active, expiry_date, effective_date, gl_collected_account_id, gl_paid_account_id, tax_type, jurisdiction, is_zero_rated, is_exempt')
        .eq('organization_id', organizationId);

      (taxCodes ?? []).forEach((c) => {
        // Zero-rated and exempt codes book no tax, so they never require a GL mapping.
        const noTaxPosting = (c as any).is_zero_rated === true || (c as any).is_exempt === true || Number(c.rate ?? 0) === 0;
        const needsCollected = !noTaxPosting && (c.tax_type === 'sales' || c.tax_type === 'both');
        const needsPaid = !noTaxPosting && (c.tax_type === 'purchase' || c.tax_type === 'both');
        if ((needsCollected && !c.gl_collected_account_id) || (needsPaid && !c.gl_paid_account_id)) {
          exceptions.push({
            id: `gl-${c.id}`,
            category: 'missing_gl_mapping',
            severity: 'critical',
            title: `${c.code} has no GL account mapped`,
            description: `Tax code "${c.name}" is missing a ${!c.gl_collected_account_id ? 'collected' : 'paid'} GL account. Postings will fail.`,
            entityType: 'tax_code',
            entityId: c.id,
            entityRef: c.code,
            fixHref: '/tax',
          });
        }
        if (c.expiry_date && new Date(c.expiry_date) < new Date()) {
          exceptions.push({
            id: `expired-${c.id}`,
            category: 'expired_code_used',
            severity: 'warning',
            title: `${c.code} has expired`,
            description: `Tax code expired on ${c.expiry_date}. Update or replace it.`,
            entityType: 'tax_code',
            entityId: c.id,
            entityRef: c.code,
            fixHref: '/tax',
          });
        }
      });

      const sevOrder: Record<TaxExceptionSeverity, number> = { critical: 0, warning: 1, info: 2 };
      exceptions.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
      return exceptions;
    },
  });
}
