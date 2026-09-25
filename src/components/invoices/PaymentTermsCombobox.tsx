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
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PaymentTermsComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  onTermSelect?: (term: { name: string; days_until_due: number }) => void;
  placeholder?: string;
}

export function PaymentTermsCombobox({
  value,
  onChange,
  onTermSelect,
  placeholder = 'Select payment terms...',
}: PaymentTermsComboboxProps) {
  const [open, setOpen] = useState(false);
  const { paymentTerms, isLoading, availableTerms } = usePaymentTerms();

  // Combine database terms with available defaults
  const allTerms: { id?: string; name: string; days_until_due: number; early_payment_discount_percent?: number | null }[] = 
    paymentTerms.length > 0 ? paymentTerms : availableTerms;

  const selectedTerm = allTerms.find(term => 
    term.name === value || term.id === value
  );

  const displayValue = selectedTerm?.name || value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={isLoading}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-50 bg-background" align="start">
        <Command>
          <CommandInput placeholder="Search payment terms..." />
          <CommandList>
            <CommandEmpty>No payment terms found.</CommandEmpty>
            <ScrollArea className="h-[200px]">
              <CommandGroup>
                {allTerms.map((term, index) => {
                  const termKey = term.id || term.name;
                  const isSelected = term.name === value || term.id === value;
                  
                  return (
                    <CommandItem
                      key={termKey + index}
                      value={term.name}
                      onSelect={() => {
                        onChange(term.name);
                        onTermSelect?.({ name: term.name, days_until_due: term.days_until_due });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{term.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {term.days_until_due === 0 ? 'Due immediately' : `${term.days_until_due} days`}
                        </span>
                        {term.early_payment_discount_percent && term.early_payment_discount_percent > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {term.early_payment_discount_percent}% discount if paid early
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
