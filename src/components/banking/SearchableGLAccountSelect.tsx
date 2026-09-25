import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Building2 } from 'lucide-react';
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
import { useAccounts, DbAccount } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchableGLAccountSelectProps {
  value: string;
  onValueChange: (value: string, account?: { id: string; code: string; name: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterPostable?: boolean; // Only show postable accounts (non-headers)
}

export function SearchableGLAccountSelect({
  value,
  onValueChange,
  placeholder = 'Select GL account...',
  disabled = false,
  className,
  filterPostable = true,
}: SearchableGLAccountSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const { organization } = useCurrentOrganization();
  const { data: accounts = [], isLoading } = useAccounts(organization?.id);

  // Filter to postable accounts only if requested
  const postableAccounts = useMemo(() => {
    if (!filterPostable) return accounts;
    return accounts.filter(acc => !acc.is_header && acc.is_active);
  }, [accounts, filterPostable]);

  const selectedAccount = useMemo(
    () => postableAccounts.find((acc) => acc.id === value),
    [postableAccounts, value]
  );

  const filteredAccounts = useMemo(() => {
    if (!search) return postableAccounts;
    const term = search.toLowerCase();
    return postableAccounts.filter(
      (acc) =>
        acc.code.toLowerCase().includes(term) ||
        acc.name.toLowerCase().includes(term)
    );
  }, [postableAccounts, search]);

  // Group accounts by type for better organization
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, DbAccount[]> = {};
    const typeOrder = ['asset', 'liability', 'equity', 'income', 'expense'];
    
    filteredAccounts.forEach((acc) => {
      const type = acc.account_type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });

    // Sort groups by type order
    const sortedGroups: Record<string, DbAccount[]> = {};
    typeOrder.forEach(type => {
      if (groups[type]) {
        sortedGroups[type] = groups[type].sort((a, b) => a.code.localeCompare(b.code));
      }
    });
    
    // Add any remaining types
    Object.keys(groups).forEach(type => {
      if (!sortedGroups[type]) {
        sortedGroups[type] = groups[type].sort((a, b) => a.code.localeCompare(b.code));
      }
    });

    return sortedGroups;
  }, [filteredAccounts]);

  const typeLabels: Record<string, string> = {
    asset: '🏦 Assets',
    liability: '📋 Liabilities',
    equity: '💰 Equity',
    income: '📈 Income',
    expense: '📉 Expenses',
    cogs: '📦 Cost of Goods Sold',
    other_income: '💵 Other Income',
    other_expense: '💸 Other Expenses',
    other: '📁 Other',
  };

  const handleSelect = (acc: DbAccount) => {
    onValueChange(acc.id, { id: acc.id, code: acc.code, name: acc.name });
    setOpen(false);
    setSearch('');
  };

  if (isLoading) {
    return <Skeleton className={cn("h-9 w-full", className)} />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full h-9 justify-between font-normal", className)}
          disabled={disabled}
        >
          {selectedAccount ? (
            <span className="truncate flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{selectedAccount.code}</span>
              <span>{selectedAccount.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by code or name..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <ScrollArea className="h-[300px]">
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-6">
                  <Search className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No accounts found</p>
                </div>
              </CommandEmpty>
              {Object.entries(groupedAccounts).map(([type, accs]) => (
                <CommandGroup key={type} heading={typeLabels[type] || type}>
                  {accs.map((acc) => (
                    <CommandItem
                      key={acc.id}
                      value={acc.id}
                      onSelect={() => handleSelect(acc)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 flex-shrink-0',
                          value === acc.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="font-mono text-xs mr-3 text-primary/70 flex-shrink-0 w-12">
                        {acc.code}
                      </span>
                      <span className="truncate">{acc.name}</span>
                      {acc.current_balance !== 0 && (
                        <span className="ml-auto text-xs text-muted-foreground font-mono">
                          ${Math.abs(acc.current_balance || 0).toLocaleString()}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
