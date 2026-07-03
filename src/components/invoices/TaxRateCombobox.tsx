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
import { useTaxCodes, type TaxCode } from '@/hooks/useSalesTax';
import { ScrollArea } from '@/components/ui/scroll-area';

// Combined provincial tax rates for Canadian transactions
interface CombinedTaxOption {
  code: string;
  name: string;
  rate: number;
  taxModel: 'HST' | 'GST_PST' | 'GST_ONLY';
  breakdown: { code: string; rate: number; authority: string }[];
}

const COMBINED_TAX_OPTIONS: CombinedTaxOption[] = [
  { code: 'BC', name: 'British Columbia', rate: 12, taxModel: 'GST_PST', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 7, authority: 'BC' }] },
  { code: 'MB', name: 'Manitoba', rate: 12, taxModel: 'GST_PST', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 7, authority: 'MB' }] },
  { code: 'SK', name: 'Saskatchewan', rate: 11, taxModel: 'GST_PST', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 6, authority: 'SK' }] },
  { code: 'QC', name: 'Quebec', rate: 14.975, taxModel: 'GST_PST', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'QST', rate: 9.975, authority: 'Revenu Québec' }] },
  { code: 'ON', name: 'Ontario', rate: 13, taxModel: 'HST', breakdown: [{ code: 'HST', rate: 13, authority: 'CRA' }] },
  { code: 'NB', name: 'New Brunswick', rate: 15, taxModel: 'HST', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { code: 'NL', name: 'Newfoundland', rate: 15, taxModel: 'HST', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { code: 'NS', name: 'Nova Scotia', rate: 15, taxModel: 'HST', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { code: 'PE', name: 'Prince Edward Island', rate: 15, taxModel: 'HST', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { code: 'AB', name: 'Alberta', rate: 5, taxModel: 'GST_ONLY', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { code: 'NT', name: 'Northwest Territories', rate: 5, taxModel: 'GST_ONLY', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { code: 'NU', name: 'Nunavut', rate: 5, taxModel: 'GST_ONLY', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { code: 'YT', name: 'Yukon', rate: 5, taxModel: 'GST_ONLY', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
];

// Individual federal/provincial tax components (always shown as fallback)
interface IndividualTaxOption {
  code: string;
  name: string;
  rate: number;
}

const INDIVIDUAL_TAX_OPTIONS: IndividualTaxOption[] = [
  { code: 'GST', name: 'GST (5%)', rate: 5 },
  { code: 'HST', name: 'HST (13%)', rate: 13 },
  { code: 'PST', name: 'PST (7%)', rate: 7 },
  { code: 'QST', name: 'QST (9.975%)', rate: 9.975 },
];

const EXEMPT_TAX_OPTIONS: IndividualTaxOption[] = [
  { code: 'EXEMPT', name: 'Exempt', rate: 0 },
  { code: 'ZR-EXP', name: 'Zero-rated Export', rate: 0 },
];

interface TaxRateComboboxProps {
  organizationId?: string;
  value?: number;
  onChange: (rate: number) => void;
  placeholder?: string;
  showCombinedRates?: boolean;
}

export function TaxRateCombobox({
  organizationId,
  value,
  onChange,
  placeholder = 'Select tax rate...',
  showCombinedRates = true,
}: TaxRateComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: taxCodes = [], isLoading } = useTaxCodes(organizationId);

  // Filter tax codes by search
  const filteredTaxCodes = useMemo(() => {
    if (!search) return taxCodes;
    const term = search.toLowerCase();
    return taxCodes.filter(
      code => code.name.toLowerCase().includes(term) ||
              code.code.toLowerCase().includes(term) ||
              code.rate.toString().includes(term)
    );
  }, [taxCodes, search]);

  // Filter combined options by search
  const filteredCombinedOptions = useMemo(() => {
    if (!search) return COMBINED_TAX_OPTIONS;
    const term = search.toLowerCase();
    return COMBINED_TAX_OPTIONS.filter(
      opt => opt.code.toLowerCase().includes(term) ||
             opt.name.toLowerCase().includes(term) ||
             opt.rate.toString().includes(term)
    );
  }, [search]);

  // De-dupe hardcoded individual/exempt options against DB tax codes (by code)
  const dbCodeSet = useMemo(
    () => new Set(taxCodes.map(c => c.code.toUpperCase())),
    [taxCodes]
  );

  const filterIndividual = (list: IndividualTaxOption[]) => {
    const term = search.toLowerCase();
    return list.filter(opt => {
      if (dbCodeSet.has(opt.code.toUpperCase())) return false;
      if (!search) return true;
      return (
        opt.code.toLowerCase().includes(term) ||
        opt.name.toLowerCase().includes(term) ||
        opt.rate.toString().includes(term)
      );
    });
  };

  const filteredIndividualOptions = useMemo(
    () => filterIndividual(INDIVIDUAL_TAX_OPTIONS),
    [search, dbCodeSet]
  );
  const filteredExemptOptions = useMemo(
    () => filterIndividual(EXEMPT_TAX_OPTIONS),
    [search, dbCodeSet]
  );

  // Group tax codes by type for better organization
  const groupedCodes = filteredTaxCodes.reduce((acc, code) => {
    const group = code.tax_type || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(code);
    return acc;
  }, {} as Record<string, TaxCode[]>);

  // Group combined options by tax model
  const groupedCombinedOptions = useMemo(() => {
    const groups: Record<string, CombinedTaxOption[]> = {
      'HST Provinces': [],
      'GST + PST Provinces': [],
      'GST Only': [],
    };
    
    filteredCombinedOptions.forEach(option => {
      if (option.taxModel === 'HST') {
        groups['HST Provinces'].push(option);
      } else if (option.taxModel === 'GST_PST') {
        groups['GST + PST Provinces'].push(option);
      } else {
        groups['GST Only'].push(option);
      }
    });
    
    return groups;
  }, [filteredCombinedOptions]);

  const selectedCode = taxCodes.find(code => code.rate === value);
  const selectedCombined = COMBINED_TAX_OPTIONS.find(opt => opt.rate === value);
  
  const displayValue = selectedCombined 
    ? `${selectedCombined.name} (${selectedCombined.rate}%)`
    : selectedCode 
      ? `${selectedCode.name} (${selectedCode.rate}%)`
      : value !== undefined && value !== null
        ? `${value}%`
        : null;

  // Order for display
  const groupOrder = ['GST', 'HST', 'PST', 'QST', 'GST+PST', 'GST+QST', 'exempt', 'zero-rated', 'out-of-scope'];
  const sortedGroups = Object.keys(groupedCodes).sort((a, b) => {
    const aIdx = groupOrder.indexOf(a);
    const bIdx = groupOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const getTaxModelBadge = (model: string) => {
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
          className="w-full justify-between font-normal h-8 text-xs px-2"
          disabled={isLoading}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 z-50 bg-background" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search tax rates..." 
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No tax codes found.</CommandEmpty>
            <ScrollArea className="h-[320px]">
              {/* Combined Provincial Rates */}
              {showCombinedRates && Object.entries(groupedCombinedOptions).map(([group, options]) => (
                options.length > 0 && (
                  <CommandGroup key={group} heading={group}>
                    {options.map((option) => {
                      const isSelected = option.rate === value;
                      
                      return (
                        <TooltipProvider key={option.code}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CommandItem
                                value={`combined-${option.code}`}
                                onSelect={() => {
                                  onChange(option.rate);
                                  setOpen(false);
                                  setSearch('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    isSelected ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <div className="flex items-center gap-2 flex-1">
                                  <MapPin className="w-3 h-3 text-muted-foreground" />
                                  <span className="font-medium">{option.code}</span>
                                  <span className="text-muted-foreground text-xs truncate">
                                    {option.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {getTaxModelBadge(option.taxModel)}
                                  <Badge variant="outline" className="text-xs px-1.5 py-0 tabular-nums">
                                    {option.rate}%
                                  </Badge>
                                </div>
                              </CommandItem>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[200px]">
                              {option.taxModel === 'GST_PST' ? (
                                <div className="space-y-1">
                                  <p className="font-medium">Separate Tax Accounting</p>
                                  <div className="text-xs space-y-0.5">
                                    {option.breakdown.map((tax, idx) => (
                                      <p key={idx}>{tax.code} {tax.rate}% ({tax.authority})</p>
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground pt-1">
                                    Combined: {option.rate}%
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-medium">{option.breakdown[0]?.code} {option.rate}%</p>
                                  <p className="text-xs text-muted-foreground">
                                    {option.breakdown[0]?.authority}
                                  </p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </CommandGroup>
                )
              ))}

              {/* Exempt / Zero-rated */}
              {filteredExemptOptions.length > 0 && (
                <CommandGroup heading="Exempt">
                  {filteredExemptOptions.map((opt) => {
                    const isSelected = opt.rate === value;
                    return (
                      <CommandItem
                        key={`exempt-${opt.code}`}
                        value={`exempt-${opt.code}`}
                        onSelect={() => {
                          onChange(opt.rate);
                          setOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium">{opt.code}</span>
                          <span className="text-muted-foreground text-xs truncate">{opt.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 tabular-nums">
                          {opt.rate}%
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Individual Tax Rates (Federal/Provincial components) */}
              {filteredIndividualOptions.length > 0 && (
                <CommandGroup heading="Individual Tax Rates">
                  {filteredIndividualOptions.map((opt) => {
                    const isSelected = opt.rate === value;
                    return (
                      <CommandItem
                        key={`indiv-${opt.code}`}
                        value={`indiv-${opt.code}`}
                        onSelect={() => {
                          onChange(opt.rate);
                          setOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium">{opt.code}</span>
                          <span className="text-muted-foreground text-xs truncate">{opt.name}</span>
                        </div>
                        <Badge variant="default" className="text-xs px-1.5 py-0 tabular-nums">
                          {opt.rate}%
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}


              {/* Individual Tax Codes */}
              {sortedGroups.map((group) => (
                <CommandGroup key={group} heading={group.toUpperCase()}>
                  {groupedCodes[group].map((code) => {
                    const isSelected = code.rate === value;
                    
                    return (
                      <CommandItem
                        key={code.id}
                        value={`${code.name} ${code.code} ${code.rate}`}
                        onSelect={() => {
                          onChange(code.rate);
                          setOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{code.code}</span>
                            <span className="text-muted-foreground">{code.rate}%</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {code.name}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
