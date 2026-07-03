import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';

interface CurrencySelectProps {
  value: string | null | undefined;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Reusable currency selector backed by the org's active currencies.
 * Falls back to a base-only list when multi-currency is disabled.
 */
export function CurrencySelect({
  value,
  onChange,
  placeholder = 'Select currency',
  disabled,
  id,
}: CurrencySelectProps) {
  const { activeCurrencies, baseCurrency, availableCurrencies } = useCurrencies();
  const { settings } = useMultiCurrencySettings();

  const mcEnabled = !!settings?.multi_currency_enabled;

  // If multi-currency disabled or no active currencies, show base only
  const options = mcEnabled && activeCurrencies.length > 0
    ? activeCurrencies.map(c => ({ code: c.code, name: c.name, symbol: c.symbol }))
    : baseCurrency
      ? [{ code: baseCurrency.code, name: baseCurrency.name, symbol: baseCurrency.symbol }]
      : availableCurrencies.map(c => ({ code: c.code, name: c.name, symbol: c.symbol }));

  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72 z-50">
        {options.map(o => (
          <SelectItem key={o.code} value={o.code}>
            <span className="font-medium">{o.code}</span>
            <span className="text-muted-foreground ml-2">— {o.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
