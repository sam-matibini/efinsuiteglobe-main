import { useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { isNpoIndustry } from '@/data/industries';
import { NPO_FINANCIAL_TERMINOLOGY } from '@/hooks/useLocalizedCurrency';

/**
 * Hook that returns NPO-specific terminology when the organization is an NPO/charity.
 * Returns null for for-profit organizations (no changes to existing behavior).
 */
export function useNpoTerminology() {
  const { organization } = useCurrentOrganization();

  const npoTerms = useMemo(() => {
    if (!organization?.industry) return null;
    if (!isNpoIndustry(organization.industry)) return null;

    const countryCode = organization.country || 'CA';
    return NPO_FINANCIAL_TERMINOLOGY[countryCode] || NPO_FINANCIAL_TERMINOLOGY.CA;
  }, [organization?.industry, organization?.country]);

  const isNpo = !!npoTerms;

  return { npoTerms, isNpo };
}
