import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Info } from 'lucide-react';
import { ALL_CURRENCIES } from '@/lib/currencyOptions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currency preselected when the dialog opens (the country's currency when known). */
  defaultBase: string;
  /** Country the organization is based in, and its currency — shown as the suggestion. */
  countryName?: string | null;
  countryCurrency?: string | null;
  /** 'enable' = first activation; 'correct' = re-choose a base locked before any foreign transactions. */
  mode?: 'enable' | 'correct';
  currentBase?: string | null;
  onConfirm: (baseCurrency: string) => void;
}

export function EnableMultiCurrencyDialog({ open, onOpenChange, defaultBase, countryName, countryCurrency, mode = 'enable', currentBase, onConfirm }: Props) {
  const [base, setBase] = useState(defaultBase || 'USD');
  useEffect(() => { if (open) setBase(defaultBase || 'USD'); }, [open, defaultBase]);

  const options = useMemo(
    () => ALL_CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}`, keywords: `${c.name} ${c.symbol}` })),
    [],
  );
  const differsFromCountry = !!countryCurrency && base !== countryCurrency;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            {mode === 'correct' ? 'Confirm Base Currency' : 'Enable Multi-Currency'}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {mode === 'correct' ? (
              <span className="block">
                The base currency was locked as <strong>{currentBase}</strong>, but no foreign-currency transactions have been recorded yet, so it can still be corrected.
              </span>
            ) : (
              <span className="block">
                Enabling multi-currency allows you to record transactions in foreign currencies and translate them to your base currency.
              </span>
            )}
            <span className="block font-semibold text-foreground">
              ⚠️ The base currency is your accounting currency. It is locked once enabled and cannot be changed after foreign-currency transactions begin.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label>Base Currency</Label>
          <SearchableSelect options={options} value={base} onValueChange={setBase} placeholder="Select currency" searchPlaceholder="Search currency…" />
          {countryCurrency && countryName && (
            <p className={`text-xs flex items-start gap-1.5 ${differsFromCountry ? 'text-warning' : 'text-muted-foreground'}`}>
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {differsFromCountry
                ? `Your organization is based in ${countryName}, whose currency is ${countryCurrency}. Only choose ${base} if your books are kept in ${base}.`
                : `Suggested because your organization is based in ${countryName}.`}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(base)} disabled={!base}>
            {mode === 'correct' ? `Use ${base} & Enable` : 'Enable & Lock'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
