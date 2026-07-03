import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, User, UserPlus } from 'lucide-react';
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
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { QuickAddCustomerCCDialog } from './QuickAddCustomerCCDialog';

interface SearchableCustomerSelectProps {
  value: string;
  onValueChange: (customerId: string, customer?: Customer) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableCustomerSelect({
  value,
  onValueChange,
  placeholder = 'Link to customer/donor...',
  disabled = false,
  className,
}: SearchableCustomerSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { customers, isLoading } = useCustomers();

  const filtered = useMemo(() => {
    if (!search) return customers;
    const lower = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower)
    );
  }, [customers, search]);

  const selected = useMemo(
    () => customers.find((c) => c.id === value),
    [customers, value]
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between font-normal', className)}
            disabled={disabled || isLoading}
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {selected ? selected.name : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customers..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[240px]">
              <CommandEmpty>
                <div className="py-1 text-center">
                  <p className="text-sm text-muted-foreground mb-2">No customer found.</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setQuickAddOpen(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Add "{search}" as new donor
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {/* Quick-add button at top */}
                <CommandItem
                  value="__add_new__"
                  onSelect={() => {
                    setOpen(false);
                    setQuickAddOpen(true);
                  }}
                  className="text-primary"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  <span className="font-medium">Add new donor...</span>
                </CommandItem>
                {value && (
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onValueChange('', undefined);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="text-muted-foreground italic"
                  >
                    Clear selection
                  </CommandItem>
                )}
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onValueChange(c.id, c);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === c.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{c.name}</span>
                      {c.email && (
                        <span className="text-xs text-muted-foreground">{c.email}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <QuickAddCustomerCCDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialName={search}
        onCustomerCreated={(customerId, customerName) => {
          onValueChange(customerId, { id: customerId, name: customerName } as Customer);
          setSearch('');
        }}
      />
    </>
  );
}
