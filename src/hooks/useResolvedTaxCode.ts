/**
 * useResolvedTaxCode — convenience hook around taxResolver.
 *
 * Fetches the candidate inputs from the database (customer/vendor row,
 * product row, available tax codes for the org) and returns the resolved
 * tax code id alongside a "reason" string for UI hints.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  resolveTaxCode,
  inferJurisdictionCode,
  type TaxResolutionResult,
  type ResolvableTaxCode,
} from '@/lib/taxResolver';

export interface UseResolvedTaxCodeArgs {
  customerId?: string | null;
  vendorId?: string | null;
  productId?: string | null;
  /** Optional explicit override (line-level) */
  overrideTaxCodeId?: string | null;
  /** Optional jurisdiction code, falls back to entity address */
  jurisdictionCode?: string | null;
  enabled?: boolean;
}

export function useResolvedTaxCode(
  args: UseResolvedTaxCodeArgs
): { data: TaxResolutionResult | null; isLoading: boolean } {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  const { data, isLoading } = useQuery({
    queryKey: [
      'resolved-tax-code',
      orgId,
      args.customerId,
      args.vendorId,
      args.productId,
      args.overrideTaxCodeId,
      args.jurisdictionCode,
    ],
    enabled: Boolean(orgId) && (args.enabled ?? true),
    queryFn: async (): Promise<TaxResolutionResult> => {
      // 1. Available tax codes
      const { data: codesRaw } = await supabase
        .from('tax_codes')
        .select('id, code, is_exempt, is_zero_rated, jurisdiction')
        .eq('organization_id', orgId!)
        .eq('is_active', true);
      const availableTaxCodes: ResolvableTaxCode[] = codesRaw ?? [];

      // 2. Entity (customer or vendor)
      let entity: any = null;
      if (args.customerId) {
        const { data } = await supabase
          .from('customers')
          .select('id, default_tax_code_id, tax_exempt, province, country')
          .eq('id', args.customerId)
          .maybeSingle();
        entity = data;
      } else if (args.vendorId) {
        const { data } = await supabase
          .from('vendors')
          .select('id, default_tax_code_id, tax_exempt, province, country')
          .eq('id', args.vendorId)
          .maybeSingle();
        entity = data;
      }

      // 3. Product
      let product: any = null;
      if (args.productId) {
        const { data } = await supabase
          .from('inventory_items')
          .select('id, default_tax_code_id, tax_category')
          .eq('id', args.productId)
          .maybeSingle();
        product = data;
      }

      // 4. Jurisdiction
      const jurisdictionCode =
        args.jurisdictionCode ?? inferJurisdictionCode(entity);

      // 5. Resolve
      return resolveTaxCode({
        lineOverrideTaxCodeId: args.overrideTaxCodeId,
        product,
        entity,
        jurisdictionCode,
        availableTaxCodes,
        orgDefaultTaxCodeId: null,
      });
    },
  });

  return { data: data ?? null, isLoading };
}
