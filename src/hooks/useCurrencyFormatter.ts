import { useCallback, useMemo } from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';

// Locale mapping for Intl.NumberFormat
// Use getLocaleForCountry for comprehensive locale mapping
import { getLocaleForCountry } from '@/data/countryLocalizations';

export function useCurrencyFormatter() {
  const { preferences } = useUserPreferences();
  const { organization } = useCurrentOrganization();
  
  // Get country code and localization
  const countryCode = useMemo(() => organization?.country || 'CA', [organization?.country]);
  const localization = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const locale = useMemo(() => getLocaleForCountry(countryCode), [countryCode]);

  const formatCurrency = useCallback((value: number, options?: { 
    showCurrencySymbol?: boolean;
    showZeroAsDash?: boolean;
    forceNegativeFormat?: boolean;
    currencyOverride?: string;
  }) => {
    const { 
      showCurrencySymbol = false, 
      showZeroAsDash = false, 
      forceNegativeFormat = false,
      currencyOverride 
    } = options || {};
    
    // Handle zero display
    if (showZeroAsDash && value === 0) {
      return '-';
    }

    const absValue = Math.abs(value);
    const negativeFormat = preferences?.negative_format || 'minus';
    const currency = currencyOverride || localization.currency;
    
    // Format the absolute value
    let formatted: string;
    if (showCurrencySymbol) {
      formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(absValue);
    } else {
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(absValue);
    }

    // Apply negative formatting (also for forced negative - e.g., deductions column)
    const isNegative = value < 0 || forceNegativeFormat;
    if (isNegative && value !== 0) {
      if (negativeFormat === 'brackets') {
        return `(${formatted})`;
      } else {
        return `-${formatted}`;
      }
    }

    return formatted;
  }, [preferences?.negative_format, locale, localization.currency]);

  // Format with currency symbol (for totals, headlines)
  const formatWithSymbol = useCallback((value: number, forceNegative = false) => {
    return formatCurrency(value, { showCurrencySymbol: true, forceNegativeFormat: forceNegative });
  }, [formatCurrency]);

  // Format without symbol but show zero as dash (for report rows)
  const formatForReport = useCallback((value: number) => {
    return formatCurrency(value, { showZeroAsDash: true });
  }, [formatCurrency]);

  // Format a deduction value (always shows as negative)
  const formatDeduction = useCallback((value: number, showCurrencySymbol = true) => {
    if (value === 0) return '-';
    return formatCurrency(Math.abs(value), { 
      showCurrencySymbol, 
      forceNegativeFormat: true 
    });
  }, [formatCurrency]);

  return {
    formatCurrency,
    formatWithSymbol,
    formatForReport,
    formatDeduction,
    negativeFormat: preferences?.negative_format || 'minus',
    countryCode,
    locale,
    currencyCode: localization.currency,
    currencySymbol: localization.currencySymbol,
  };
}
