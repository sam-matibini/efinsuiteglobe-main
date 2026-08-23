import { useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getCountriesByRegion,
  COUNTRY_LOCALIZATIONS,
} from '@/data/countryLocalizations';
import { getAllLocalizedCurrencies } from '@/hooks/useLocalizedCurrency';

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string) => void;
  id?: string;
  disabled?: boolean;
}

export function CountrySelect({ value, onChange, id, disabled }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = COUNTRY_LOCALIZATIONS[value];
  const byRegion = getCountriesByRegion();
  const regionOrder = Object.keys(byRegion).sort((a, b) => a.localeCompare(b));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.flag} ${selected.name}` : 'Select country'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 z-50 bg-background" align="start">
        <Command>
          <CommandInput placeholder="Search countries..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <ScrollArea className="h-[280px]">
              {regionOrder.map((region) => (
                <CommandGroup key={region} heading={region}>
                  {byRegion[region].map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.code} ${country.currency}`}
                      onSelect={() => {
                        onChange(country.code);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === country.code ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="mr-2">{country.flag}</span>
                      <span className="flex-1">{country.name}</span>
                      <span className="text-xs text-muted-foreground">{country.currency}</span>
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

interface AllCurrenciesSelectProps {
  value: string;
  onChange: (currencyCode: string) => void;
  primaryCountryCode?: string;
  id?: string;
  disabled?: boolean;
}

export function AllCurrenciesSelect({
  value,
  onChange,
  primaryCountryCode,
  id,
  disabled,
}: AllCurrenciesSelectProps) {
  const [open, setOpen] = useState(false);
  const currencies = getAllLocalizedCurrencies(primaryCountryCode);
  const selected = currencies.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.name}` : 'Select currency'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-50 bg-background" align="start">
        <Command>
          <CommandInput placeholder="Search currencies..." />
          <CommandList>
            <CommandEmpty>No currency found.</CommandEmpty>
            <ScrollArea className="h-[280px]">
              <CommandGroup>
                {currencies.map((curr) => (
                  <CommandItem
                    key={curr.code}
                    value={`${curr.code} ${curr.name}`}
                    onSelect={() => {
                      onChange(curr.code);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === curr.code ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="font-medium w-12">{curr.code}</span>
                    <span className="text-muted-foreground">{curr.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
