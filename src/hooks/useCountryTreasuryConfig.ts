import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryTreasuryConfig } from '@/config/countryTreasuryConfig';

/**
 * Resolves the ISO alpha-2 country code for the current organization
 * (via `organizations.country_id -> countries.code`) and returns the
 * matching Treasury configuration. Falls back to Canada if unknown.
 */
export function useCountryTreasuryConfig() {
  const { organization } = useCurrentOrganization();
  const countryId = organization?.country_id ?? null;

  const { data: code } = useQuery({
    queryKey: ['org-country-code', countryId],
    enabled: !!countryId,
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

  const resolvedCode = code ?? (organization?.country ?? null);
  const config = getCountryTreasuryConfig(resolvedCode);

  return { config, countryCode: config.countryCode, isLoading: !!countryId && !code };
}
