import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Predefined common column names for financial statements
const PREDEFINED_COLUMN_NAMES = [
  { value: 'Date', group: 'Common' },
  { value: 'Transaction Date', group: 'Common' },
  { value: 'Posting Date', group: 'Common' },
  { value: 'Description', group: 'Common' },
  { value: 'Payee/Payor', group: 'Common' },
  { value: 'Payee', group: 'Common' },
  { value: 'Payor', group: 'Common' },
  { value: 'Reference', group: 'Common' },
  { value: 'Ref', group: 'Common' },
  { value: 'Reference Number', group: 'Common' },
  { value: 'Amount', group: 'Amounts' },
  { value: 'Debit', group: 'Amounts' },
  { value: 'Credit', group: 'Amounts' },
  { value: 'Balance', group: 'Amounts' },
  { value: 'Running Balance', group: 'Amounts' },
  { value: 'Type', group: 'Transaction Type' },
  { value: 'Transaction Type', group: 'Transaction Type' },
  { value: 'Deposit', group: 'Transaction Type' },
  { value: 'Withdrawal', group: 'Transaction Type' },
  { value: 'Check Number', group: 'Other' },
  { value: 'Check No', group: 'Other' },
  { value: 'Memo', group: 'Other' },
  { value: 'Notes', group: 'Other' },
  { value: 'Category', group: 'Other' },
  { value: 'Merchant', group: 'Other' },
  { value: 'Merchant Name', group: 'Other' },
  { value: 'MCC', group: 'Other' },
];

interface SearchableColumnSelectProps {
  value: string;
  onChange: (value: string) => void;
  sourceColumns: string[];
  customNames: string[];
  onAddCustomName: (name: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableColumnSelect({
  value,
  onChange,
  sourceColumns,
  customNames,
  onAddCustomName,
  placeholder = "Select source column...",
  className,
}: SearchableColumnSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCustomName, setNewCustomName] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Combine all column name options
  const allOptions = useMemo(() => {
    const options: { value: string; group: string; isSource?: boolean; isCustom?: boolean }[] = [];
    
    // Add source columns first (from uploaded file)
    sourceColumns.forEach(col => {
      options.push({ value: col, group: 'Source Columns', isSource: true });
    });
    
    // Add predefined names
    PREDEFINED_COLUMN_NAMES.forEach(item => {
      if (!sourceColumns.some(s => s.toLowerCase() === item.value.toLowerCase())) {
        options.push({ value: item.value, group: item.group });
      }
    });
    
    // Add custom names
    customNames.forEach(name => {
      if (!options.some(o => o.value.toLowerCase() === name.toLowerCase())) {
        options.push({ value: name, group: 'Custom Names', isCustom: true });
      }
    });
    
    return options;
  }, [sourceColumns, customNames]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return allOptions;
    const query = searchQuery.toLowerCase();
    return allOptions.filter(opt => 
      opt.value.toLowerCase().includes(query)
    );
  }, [allOptions, searchQuery]);

  // Group filtered options
  const groupedOptions = useMemo(() => {
    const groups: Record<string, typeof filteredOptions> = {};
    filteredOptions.forEach(opt => {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  const handleAddCustomName = () => {
    const trimmed = newCustomName.trim();
    if (trimmed && !allOptions.some(o => o.value.toLowerCase() === trimmed.toLowerCase())) {
      onAddCustomName(trimmed);
      onChange(trimmed);
      setNewCustomName('');
      setShowAddCustom(false);
      setOpen(false);
    }
  };

  const displayValue = value || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between h-9 font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search columns..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <ScrollArea className="h-[250px]">
              <CommandEmpty>
                <div className="py-2 px-3 text-sm text-muted-foreground">
                  No column found.
                </div>
              </CommandEmpty>
              
              {/* Skip option */}
              <CommandGroup heading="Options">
                <CommandItem
                  value="__skip__"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">-- Skip --</span>
                </CommandItem>
              </CommandGroup>
              
              {/* Grouped options */}
              {Object.entries(groupedOptions).map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map(item => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{item.value}</span>
                      {item.isSource && (
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          Source
                        </Badge>
                      )}
                      {item.isCustom && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          Custom
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </ScrollArea>
            
            <CommandSeparator />
            
            {/* Add custom name section */}
            <div className="p-2">
              {showAddCustom ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="Enter custom name..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomName();
                      }
                      if (e.key === 'Escape') {
                        setShowAddCustom(false);
                        setNewCustomName('');
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleAddCustomName}
                    disabled={!newCustomName.trim()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setShowAddCustom(false);
                      setNewCustomName('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start h-8 text-sm text-muted-foreground"
                  onClick={() => setShowAddCustom(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add custom column name
                </Button>
              )}
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
