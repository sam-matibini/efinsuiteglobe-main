import { useMemo } from 'react';
import { useCurrentOrganization } from './useOrganization';
import { getPayrollLocalization } from '@/data/payrollLocalization';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

export function usePayrollLocalization() {
  const { organization } = useCurrentOrganization();

  const countryCode = useMemo(() => {
    if (organization?.country) {
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA'; // Default to Canada
  }, [organization?.country]);

  const payrollConfig = useMemo(() => getPayrollLocalization(countryCode), [countryCode]);

  return {
    countryCode,
    payrollConfig,
    sidebarLabels: payrollConfig.sidebarLabels,
    taxSlipsLabel: payrollConfig.sidebarLabels.taxSlips,
    separationDocLabel: payrollConfig.sidebarLabels.separationDoc,
    remittancesLabel: payrollConfig.sidebarLabels.remittances,
  };
}
