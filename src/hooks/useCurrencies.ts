import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface Currency {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  organization_id: string | null;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string | null;
  created_at: string;
}

export interface CreateCurrencyInput {
  code: string;
  name: string;
  symbol: string;
  decimal_places?: number;
  is_base?: boolean;
}

export interface CreateExchangeRateInput {
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source?: string;
}

// Default currencies (includes all 15 supported localized currencies)
const DEFAULT_CURRENCIES = [
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
];

export function useCurrencies() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const currenciesQuery = useQuery({
    queryKey: ['currencies', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('code');
      
      if (error) throw error;
      return data as Currency[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createCurrency = useMutation({
    mutationFn: async (input: CreateCurrencyInput) => {
      // If setting as base, unset any existing base currency
      if (input.is_base) {
        await supabase
          .from('currencies')
          .update({ is_base: false })
          .eq('organization_id', currentOrganization!.id);
      }

      const { data, error } = await supabase
        .from('currencies')
        .insert({
          organization_id: currentOrganization!.id,
          code: input.code,
          name: input.name,
          symbol: input.symbol,
          decimal_places: input.decimal_places || 2,
          is_base: input.is_base || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast.success('Currency added');
    },
    onError: (error) => {
      toast.error(`Failed to add currency: ${error.message}`);
    },
  });

  const updateCurrency = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Currency> & { id: string }) => {
      // If setting as base, unset any existing base currency
      if (input.is_base) {
        await supabase
          .from('currencies')
          .update({ is_base: false })
          .eq('organization_id', currentOrganization!.id);
      }

      const { error } = await supabase
        .from('currencies')
        .update(input)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast.success('Currency updated');
    },
    onError: (error) => {
      toast.error(`Failed to update currency: ${error.message}`);
    },
  });

  const initializeDefaultCurrencies = useMutation({
    mutationFn: async () => {
      const currencies = DEFAULT_CURRENCIES.map((c, index) => ({
        organization_id: currentOrganization!.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        decimal_places: c.code === 'JPY' ? 0 : 2,
        is_base: c.code === 'CAD', // Default base currency for Canadian businesses
        is_active: index < 3, // Only first 3 are active by default
      }));

      const { error } = await supabase
        .from('currencies')
        .insert(currencies);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast.success('Default currencies initialized');
    },
    onError: (error) => {
      toast.error(`Failed to initialize currencies: ${error.message}`);
    },
  });

  const seedLocalizedCurrencies = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id) throw new Error('No organization');
      const existing = new Set((currenciesQuery.data || []).map(c => c.code));
      const toInsert = DEFAULT_CURRENCIES
        .filter(c => !existing.has(c.code))
        .map(c => ({
          organization_id: currentOrganization.id,
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          decimal_places: c.code === 'JPY' || c.code === 'BIF' ? 0 : 2,
          is_base: false,
          is_active: true,
        }));
      if (toInsert.length === 0) return { inserted: 0 };
      const { error } = await supabase.from('currencies').insert(toInsert);
      if (error) throw error;
      return { inserted: toInsert.length };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast.success(`Added ${res.inserted} localized currencies`);
    },
    onError: (e: Error) => toast.error(`Failed to seed currencies: ${e.message}`),
  });

  const currencies = currenciesQuery.data || [];
  const baseCurrency = currencies.find(c => c.is_base);
  const activeCurrencies = currencies.filter(c => c.is_active);

  return {
    currencies,
    activeCurrencies,
    baseCurrency,
    isLoading: currenciesQuery.isLoading,
    error: currenciesQuery.error,
    createCurrency,
    updateCurrency,
    initializeDefaultCurrencies,
    seedLocalizedCurrencies,
    availableCurrencies: DEFAULT_CURRENCIES,
  };
}

export function useExchangeRates() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const exchangeRatesQuery = useQuery({
    queryKey: ['exchange_rates', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('effective_date', { ascending: false })
        .limit(5000);
      
      if (error) throw error;
      return data as ExchangeRate[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createExchangeRate = useMutation({
    mutationFn: async (input: CreateExchangeRateInput) => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .insert({
          organization_id: currentOrganization!.id,
          from_currency: input.from_currency,
          to_currency: input.to_currency,
          rate: input.rate,
          effective_date: input.effective_date,
          source: input.source,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange_rates'] });
      toast.success('Exchange rate added');
    },
    onError: (error) => {
      toast.error(`Failed to add exchange rate: ${error.message}`);
    },
  });

  const getExchangeRate = (fromCurrency: string, toCurrency: string, date?: string) => {
    const rates = exchangeRatesQuery.data || [];
    const effectiveDate = date || new Date().toISOString().split('T')[0];
    
    // Find the most recent rate for the currency pair on or before the effective date
    const rate = rates.find(r => 
      r.from_currency === fromCurrency && 
      r.to_currency === toCurrency &&
      r.effective_date <= effectiveDate
    );

    return rate?.rate || 1;
  };

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string, date?: string) => {
    if (fromCurrency === toCurrency) return amount;
    const rate = getExchangeRate(fromCurrency, toCurrency, date);
    return amount * rate;
  };

  return {
    exchangeRates: exchangeRatesQuery.data || [],
    isLoading: exchangeRatesQuery.isLoading,
    error: exchangeRatesQuery.error,
    createExchangeRate,
    getExchangeRate,
    convertAmount,
  };
}
