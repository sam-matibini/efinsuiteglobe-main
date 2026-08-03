import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCountryScope, normalizeCountryCode } from '@/hooks/useCountryFilter';
import { getCountryTreasuryConfig } from '@/config/countryTreasuryConfig';

/**
 * Resolves the Treasury/eFinconnect configuration for the currently scoped
 * country. Precedence:
 *   1. Top-left country scope (D365-style selector)
 *   2. Organization's `country_id → countries.code`
 *   3. Organization's free-text `country` (best-effort normalization)
 *   4. Canada fallback
 */
export function useCountryTreasuryConfig() {
  const { organization } = useCurrentOrganization();
  const { country: scopedCountry } = useCountryScope();
  const countryId = organization?.country_id ?? null;

  const { data: code } = useQuery({
    queryKey: ['org-country-code', countryId],
    enabled: !!countryId && !scopedCountry,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('code')
        .eq('id', countryId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.code as string | undefined) ?? null;
    },
  });

  const resolvedCode =
    scopedCountry ??
    code ??
    normalizeCountryCode(organization?.country ?? null) ??
    null;
  const config = getCountryTreasuryConfig(resolvedCode);

  return {
    config,
    countryCode: config.countryCode,
    isLoading: !scopedCountry && !!countryId && !code,
  };
}
