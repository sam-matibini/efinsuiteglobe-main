import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { taxCodeGroupLabel } from '@/lib/retailTaxRateCatalog';

interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: number;
  tax_type?: string;
  applies_to?: string | null;
}

interface SearchableTaxCodeSelectProps {
  taxCodes: TaxCode[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableTaxCodeSelect({
  taxCodes,
  value,
  onValueChange,
  placeholder = 'Select Tax',
  disabled = false,
}: SearchableTaxCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Normalize empty strings to null for comparison
  const normalizedValue = value === '' ? null : value;

  const selectedTaxCode = useMemo(
    () => taxCodes.find((tc) => tc.id === normalizedValue),
    [taxCodes, normalizedValue]
  );

  const filteredTaxCodes = useMemo(() => {
    if (!search) return taxCodes;
    const term = search.toLowerCase();
    return taxCodes.filter(
      (tc) =>
        tc.code.toLowerCase().includes(term) ||
        tc.name.toLowerCase().includes(term) ||
        (tc.tax_type || '').toLowerCase().includes(term)
    );
  }, [taxCodes, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, TaxCode[]> = {
      'Paid / ITC': [],
      Collect: [],
      Exempt: [],
    };
    filteredTaxCodes.forEach((tc) => {
      groups[taxCodeGroupLabel(tc)].push(tc);
    });
    return groups;
  }, [filteredTaxCodes]);

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
          {selectedTaxCode ? (
            <span className="truncate">
              {selectedTaxCode.code} · {selectedTaxCode.name} ({selectedTaxCode.rate}%)
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tax rates..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No tax code found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !normalizedValue ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span>No Tax</span>
              </CommandItem>
            </CommandGroup>
            {(['Paid / ITC', 'Collect', 'Exempt'] as const).map((group) =>
              grouped[group].length > 0 ? (
                <CommandGroup key={group} heading={group}>
                  {grouped[group].map((tc) => (
                    <CommandItem
                      key={tc.id}
                      value={tc.id}
                      onSelect={() => {
                        onValueChange(tc.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          normalizedValue === tc.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="font-medium mr-2">{tc.code}</span>
                      <span className="text-muted-foreground truncate mr-2">{tc.name}</span>
                      <span className="text-muted-foreground">({tc.rate}%)</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
