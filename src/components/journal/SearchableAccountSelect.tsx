import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  current_balance?: number | null;
}

interface SearchableAccountSelectProps {
  accounts: Account[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showBalance?: boolean;
}

export function SearchableAccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder = 'Select account',
  disabled = false,
  showBalance = false,
}: SearchableAccountSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { organization } = useCurrentOrganization();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(Math.abs(value));
  };

  const selectedAccount = useMemo(
    () => accounts.find((acc) => acc.id === value),
    [accounts, value]
  );

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const term = search.toLowerCase();
    return accounts.filter(
      (acc) =>
        acc.code.toLowerCase().includes(term) ||
        acc.name.toLowerCase().includes(term)
    );
  }, [accounts, search]);

  // Group accounts by type for better organization
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    filteredAccounts.forEach((acc) => {
      const type = acc.account_type?.toLowerCase() || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });
    return groups;
  }, [filteredAccounts]);

  // Order for displaying account type groups
  const typeOrder = ['asset', 'liability', 'equity', 'income', 'expense', 'other'];

  const typeLabels: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    income: 'Income',
    revenue: 'Income',
    expense: 'Expenses',
    cost: 'Expenses',
    other: 'Other',
  };

  // Sort the grouped accounts by type order
  const sortedGroups = useMemo(() => {
    const entries = Object.entries(groupedAccounts);
    return entries.sort((a, b) => {
      const aIndex = typeOrder.indexOf(a[0]);
      const bIndex = typeOrder.indexOf(b[0]);
      const aOrder = aIndex === -1 ? typeOrder.length : aIndex;
      const bOrder = bIndex === -1 ? typeOrder.length : bIndex;
      return aOrder - bOrder;
    });
  }, [groupedAccounts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between font-normal"
          disabled={disabled}
        >
          {selectedAccount ? (
            <span className="truncate">
              {selectedAccount.code} - {selectedAccount.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search accounts..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No account found.</CommandEmpty>
            {sortedGroups.map(([type, accs]) => (
              <CommandGroup key={type} heading={typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}>
                {accs.map((acc) => (
                  <CommandItem
                    key={acc.id}
                    value={acc.id}
                    onSelect={() => {
                      onValueChange(acc.id);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === acc.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-xs mr-2">{acc.code}</span>
                    <span className="truncate flex-1">{acc.name}</span>
                    {showBalance && acc.current_balance != null && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatCurrency(acc.current_balance)}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
