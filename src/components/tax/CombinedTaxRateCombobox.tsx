/**
 * Combined Tax Rate Combobox
 * 
 * Dropdown selector for Canadian tax rates with:
 * - Province/territory grouping
 * - Combined rate display with breakdown tooltip
 * - Support for GST-only, GST+PST, and HST models
 */

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  PROVINCE_TAX_CONFIG, 
  getTaxDisplayLabel,
  type TaxModel 
} from '@/lib/splitTaxCalculator';

interface CombinedTaxRateOption {
  jurisdictionCode: string;
  jurisdictionName: string;
  taxModel: TaxModel;
  combinedRate: number;
  gstRate: number;
  pstRate: number;
  hstRate: number;
}

// Build options from PROVINCE_TAX_CONFIG
const TAX_RATE_OPTIONS: CombinedTaxRateOption[] = [
  { jurisdictionCode: 'AB', jurisdictionName: 'Alberta', taxModel: 'GST_ONLY', combinedRate: 5, gstRate: 5, pstRate: 0, hstRate: 0 },
  { jurisdictionCode: 'BC', jurisdictionName: 'British Columbia', taxModel: 'GST_PST', combinedRate: 12, gstRate: 5, pstRate: 7, hstRate: 0 },
  { jurisdictionCode: 'MB', jurisdictionName: 'Manitoba', taxModel: 'GST_PST', combinedRate: 12, gstRate: 5, pstRate: 7, hstRate: 0 },
  { jurisdictionCode: 'NB', jurisdictionName: 'New Brunswick', taxModel: 'HST', combinedRate: 15, gstRate: 0, pstRate: 0, hstRate: 15 },
  { jurisdictionCode: 'NL', jurisdictionName: 'Newfoundland', taxModel: 'HST', combinedRate: 15, gstRate: 0, pstRate: 0, hstRate: 15 },
  { jurisdictionCode: 'NS', jurisdictionName: 'Nova Scotia', taxModel: 'HST', combinedRate: 15, gstRate: 0, pstRate: 0, hstRate: 15 },
  { jurisdictionCode: 'NT', jurisdictionName: 'Northwest Territories', taxModel: 'GST_ONLY', combinedRate: 5, gstRate: 5, pstRate: 0, hstRate: 0 },
  { jurisdictionCode: 'NU', jurisdictionName: 'Nunavut', taxModel: 'GST_ONLY', combinedRate: 5, gstRate: 5, pstRate: 0, hstRate: 0 },
  { jurisdictionCode: 'ON', jurisdictionName: 'Ontario', taxModel: 'HST', combinedRate: 13, gstRate: 0, pstRate: 0, hstRate: 13 },
  { jurisdictionCode: 'PE', jurisdictionName: 'Prince Edward Island', taxModel: 'HST', combinedRate: 15, gstRate: 0, pstRate: 0, hstRate: 15 },
  { jurisdictionCode: 'QC', jurisdictionName: 'Quebec', taxModel: 'GST_PST', combinedRate: 14.975, gstRate: 5, pstRate: 9.975, hstRate: 0 },
  { jurisdictionCode: 'SK', jurisdictionName: 'Saskatchewan', taxModel: 'GST_PST', combinedRate: 11, gstRate: 5, pstRate: 6, hstRate: 0 },
  { jurisdictionCode: 'YT', jurisdictionName: 'Yukon', taxModel: 'GST_ONLY', combinedRate: 5, gstRate: 5, pstRate: 0, hstRate: 0 },
];

interface CombinedTaxRateComboboxProps {
  value?: string;
  onValueChange: (jurisdictionCode: string, option: CombinedTaxRateOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCombinedRate?: boolean;
}

export function CombinedTaxRateCombobox({
  value,
  onValueChange,
  placeholder = 'Select province/territory...',
  disabled = false,
  className,
  showCombinedRate = true,
}: CombinedTaxRateComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const selectedOption = useMemo(
    () => TAX_RATE_OPTIONS.find(o => o.jurisdictionCode === value) ?? null,
    [value]
  );
  
  const filteredOptions = useMemo(() => {
    if (!search) return TAX_RATE_OPTIONS;
    const term = search.toLowerCase();
    return TAX_RATE_OPTIONS.filter(
      o =>
        o.jurisdictionCode.toLowerCase().includes(term) ||
        o.jurisdictionName.toLowerCase().includes(term)
    );
  }, [search]);
  
  // Group by tax model
  const groupedOptions = useMemo(() => {
    const groups: Record<string, CombinedTaxRateOption[]> = {
      'HST Provinces': [],
      'GST + PST Provinces': [],
      'GST Only': [],
    };
    
    filteredOptions.forEach(option => {
      if (option.taxModel === 'HST') {
        groups['HST Provinces'].push(option);
      } else if (option.taxModel === 'GST_PST') {
        groups['GST + PST Provinces'].push(option);
      } else {
        groups['GST Only'].push(option);
      }
    });
    
    return groups;
  }, [filteredOptions]);
  
  const handleSelect = (option: CombinedTaxRateOption | null) => {
    onValueChange(option?.jurisdictionCode || '', option);
    setOpen(false);
    setSearch('');
  };
  
  const getTaxModelBadge = (model: TaxModel) => {
    switch (model) {
      case 'HST':
        return <Badge variant="default" className="text-[10px] px-1 py-0">HST</Badge>;
      case 'GST_PST':
        return <Badge variant="secondary" className="text-[10px] px-1 py-0">GST+PST</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] px-1 py-0">GST</Badge>;
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
          disabled={disabled}
        >
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>{selectedOption.jurisdictionName}</span>
              {showCombinedRate && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-auto">
                  {selectedOption.combinedRate}%
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search provinces..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No provinces found.</CommandEmpty>
            
            {/* No Tax Option */}
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => handleSelect(null)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">No Tax / Exempt</span>
              </CommandItem>
            </CommandGroup>
            
            {/* Grouped by Tax Model */}
            {Object.entries(groupedOptions).map(([group, options]) => (
              options.length > 0 && (
                <CommandGroup key={group} heading={group}>
                  {options.map((option) => (
                    <TooltipProvider key={option.jurisdictionCode}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CommandItem
                            value={option.jurisdictionCode}
                            onSelect={() => handleSelect(option)}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                value === option.jurisdictionCode ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <span className="font-medium">{option.jurisdictionCode}</span>
                              <span className="text-muted-foreground text-sm">
                                {option.jurisdictionName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getTaxModelBadge(option.taxModel)}
                              <Badge 
                                variant="outline"
                                className="text-xs px-1.5 py-0 tabular-nums"
                              >
                                {option.combinedRate}%
                              </Badge>
                            </div>
                          </CommandItem>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <TaxBreakdownTooltip option={option} />
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </CommandGroup>
              )
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TaxBreakdownTooltip({ option }: { option: CombinedTaxRateOption }) {
  if (option.taxModel === 'HST') {
    return (
      <div className="space-y-1">
        <p className="font-medium">HST {option.hstRate}%</p>
        <p className="text-xs text-muted-foreground">
          Single combined tax (CRA)
        </p>
      </div>
    );
  }
  
  if (option.taxModel === 'GST_PST') {
    return (
      <div className="space-y-1">
        <p className="font-medium">Separate Tax Accounting Required</p>
        <div className="text-xs space-y-0.5">
          <p>GST {option.gstRate}% (CRA)</p>
          <p>
            {option.jurisdictionCode === 'QC' ? 'QST' : 'PST'} {option.pstRate}%{' '}
            ({option.jurisdictionCode === 'QC' ? 'Revenu Québec' : 'Provincial'})
          </p>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Combined: {option.combinedRate}%
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      <p className="font-medium">GST {option.gstRate}%</p>
      <p className="text-xs text-muted-foreground">
        Federal only (CRA)
      </p>
    </div>
  );
}

// Export the options for use in other components
export { TAX_RATE_OPTIONS };
export type { CombinedTaxRateOption };
