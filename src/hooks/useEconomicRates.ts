import { useState, useEffect, useMemo } from 'react';

export interface EconomicRates {
  exchangeRate: { rate: number; currency: string; isLoading: boolean; error: string | null };
  interestRate: { rate: number; isLoading: boolean; error: string | null };
  inflationRate: { rate: number; isLoading: boolean; error: string | null };
}

interface CurrencyApiResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

// Currency codes by country (15 supported countries)
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  // North America
  CA: 'CAD',
  US: 'USD',
  // Europe
  GB: 'GBP',
  DE: 'EUR',
  FR: 'EUR',
  // Asia-Pacific
  AU: 'AUD',
  IN: 'INR',
  // Africa
  ZA: 'ZAR',
  NG: 'NGN',
  GH: 'GHS',
  ZM: 'ZMW',
  KE: 'KES',
  BI: 'BIF',
  // Middle East
  AE: 'AED',
  SA: 'SAR',
};

// Fallback rates if API fails (based on approximate current rates as of 2026-01)
const FALLBACK_RATES: Record<string, EconomicRates> = {
  CA: { exchangeRate: { rate: 1.38, currency: 'CAD', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 3.25, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.3, isLoading: false, error: 'Using cached rate' } },
  US: { exchangeRate: { rate: 1.0, currency: 'USD', isLoading: false, error: null }, interestRate: { rate: 4.50, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.8, isLoading: false, error: 'Using cached rate' } },
  GB: { exchangeRate: { rate: 0.79, currency: 'GBP', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 4.50, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.5, isLoading: false, error: 'Using cached rate' } },
  DE: { exchangeRate: { rate: 0.92, currency: 'EUR', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 3.00, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.2, isLoading: false, error: 'Using cached rate' } },
  FR: { exchangeRate: { rate: 0.92, currency: 'EUR', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 3.00, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.0, isLoading: false, error: 'Using cached rate' } },
  AU: { exchangeRate: { rate: 1.55, currency: 'AUD', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 4.10, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 3.4, isLoading: false, error: 'Using cached rate' } },
  IN: { exchangeRate: { rate: 83.50, currency: 'INR', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 6.50, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 5.0, isLoading: false, error: 'Using cached rate' } },
  ZA: { exchangeRate: { rate: 18.50, currency: 'ZAR', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 8.25, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 5.3, isLoading: false, error: 'Using cached rate' } },
  NG: { exchangeRate: { rate: 1550.00, currency: 'NGN', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 27.25, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 28.0, isLoading: false, error: 'Using cached rate' } },
  GH: { exchangeRate: { rate: 15.00, currency: 'GHS', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 29.0, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 23.0, isLoading: false, error: 'Using cached rate' } },
  ZM: { exchangeRate: { rate: 27.50, currency: 'ZMW', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 13.5, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 11.5, isLoading: false, error: 'Using cached rate' } },
  KE: { exchangeRate: { rate: 129.00, currency: 'KES', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 12.0, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 5.0, isLoading: false, error: 'Using cached rate' } },
  BI: { exchangeRate: { rate: 2900.00, currency: 'BIF', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 6.5, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 15.0, isLoading: false, error: 'Using cached rate' } },
  AE: { exchangeRate: { rate: 3.67, currency: 'AED', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 5.40, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 2.0, isLoading: false, error: 'Using cached rate' } },
  SA: { exchangeRate: { rate: 3.75, currency: 'SAR', isLoading: false, error: 'Using cached rate' }, interestRate: { rate: 6.00, isLoading: false, error: 'Using cached rate' }, inflationRate: { rate: 1.6, isLoading: false, error: 'Using cached rate' } },
};

// Central bank policy rates by country (updated periodically from official sources)
// Interest rates and inflation are harder to get from free APIs, so we use estimates
const POLICY_RATES: Record<string, { interestRate: number; inflationRate: number; lastUpdated: string }> = {
  CA: { interestRate: 3.25, inflationRate: 2.3, lastUpdated: '2026-01' },
  US: { interestRate: 4.50, inflationRate: 2.8, lastUpdated: '2026-01' },
  GB: { interestRate: 4.50, inflationRate: 2.5, lastUpdated: '2026-01' },
  DE: { interestRate: 3.00, inflationRate: 2.2, lastUpdated: '2026-01' },
  FR: { interestRate: 3.00, inflationRate: 2.0, lastUpdated: '2026-01' },
  AU: { interestRate: 4.10, inflationRate: 3.4, lastUpdated: '2026-01' },
  IN: { interestRate: 6.50, inflationRate: 5.0, lastUpdated: '2026-01' },
  ZA: { interestRate: 8.25, inflationRate: 5.3, lastUpdated: '2026-01' },
  NG: { interestRate: 27.25, inflationRate: 28.0, lastUpdated: '2026-01' },
  GH: { interestRate: 29.0, inflationRate: 23.0, lastUpdated: '2026-01' },
  ZM: { interestRate: 13.5, inflationRate: 11.5, lastUpdated: '2026-01' },
  KE: { interestRate: 12.0, inflationRate: 5.0, lastUpdated: '2026-01' },
  BI: { interestRate: 6.5, inflationRate: 15.0, lastUpdated: '2026-01' },
  AE: { interestRate: 5.40, inflationRate: 2.0, lastUpdated: '2026-01' },
  SA: { interestRate: 6.00, inflationRate: 1.6, lastUpdated: '2026-01' },
};

export function useEconomicRates(countryCode: string): EconomicRates {
  const [exchangeRate, setExchangeRate] = useState<{ rate: number; currency: string; isLoading: boolean; error: string | null }>({
    rate: 1,
    currency: CURRENCY_BY_COUNTRY[countryCode] || 'USD',
    isLoading: true,
    error: null,
  });

  const currency = CURRENCY_BY_COUNTRY[countryCode] || 'USD';
  const policyRates = POLICY_RATES[countryCode] || POLICY_RATES.US;

  // Fetch real-time exchange rates
  useEffect(() => {
    if (countryCode === 'US') {
      // USD is the base, no conversion needed
      setExchangeRate({ rate: 1, currency: 'USD', isLoading: false, error: null });
      return;
    }

    const fetchExchangeRate = async () => {
      setExchangeRate(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        // Using exchangerate-api.com free tier (no API key needed for basic requests)
        // This gives us real-time exchange rates
        const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates');
        }
        
        const data: CurrencyApiResponse = await response.json();
        
        if (data.result !== 'success' || !data.conversion_rates) {
          throw new Error('Invalid response from exchange rate API');
        }
        
        const rate = data.conversion_rates[currency];
        
        if (rate === undefined) {
          throw new Error(`Currency ${currency} not found`);
        }
        
        setExchangeRate({
          rate: Math.round(rate * 100) / 100, // Round to 2 decimal places
          currency,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.warn('Failed to fetch exchange rate, using fallback:', error);
        const fallback = FALLBACK_RATES[countryCode] || FALLBACK_RATES.US;
        setExchangeRate({
          ...fallback.exchangeRate,
          currency,
        });
      }
    };

    fetchExchangeRate();
    
    // Refresh exchange rates every 30 minutes
    const interval = setInterval(fetchExchangeRate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [countryCode, currency]);

  // Interest and inflation rates come from policy data
  // These are updated less frequently (monthly/quarterly by central banks)
  const interestRate = useMemo(() => ({
    rate: policyRates.interestRate,
    isLoading: false,
    error: null,
  }), [policyRates.interestRate]);

  const inflationRate = useMemo(() => ({
    rate: policyRates.inflationRate,
    isLoading: false,
    error: null,
  }), [policyRates.inflationRate]);

  return {
    exchangeRate,
    interestRate,
    inflationRate,
  };
}
