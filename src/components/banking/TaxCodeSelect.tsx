import { useState, useMemo, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Percent, MapPin } from 'lucide-react';
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
import { useTaxCodes, TaxCode } from '@/hooks/useSalesTax';
import { useAccounts } from '@/hooks/useAccounts';
import {
  calculateSplitTaxes,
  PROVINCE_TAX_CONFIG,
} from '@/lib/splitTaxCalculator';
import { isPaidRetailTaxCode, taxCodeGroupLabel } from '@/lib/retailTaxRateCatalog';

// Fallback: resolve a tax GL account directly from the chart of accounts by
// name patterns. Used when tax_codes rows lack gl_collected/gl_paid links so
// the dialog can still post tax to the GL.
function resolveTaxAccount(
  accounts: Array<{ id: string; name: string }> | undefined,
  patterns: RegExp[],
): string | null {
  if (!accounts?.length) return null;
  for (const re of patterns) {
    const hit = accounts.find(a => re.test(a.name));
    if (hit) return hit.id;
  }
  return null;
}

// Combined provincial tax rates for Canadian place-of-supply compliance
// These are logical display options that map to actual tax calculations
interface CombinedTaxOption {
  id: string;
  code: string;
  name: string;
  combinedRate: number;
  taxModel: 'HST' | 'GST_PST' | 'GST_ONLY';
  provinceCode: string;
  breakdown: { code: string; rate: number; authority: string }[];
}

const COMBINED_TAX_OPTIONS: CombinedTaxOption[] = [
  { id: 'combined-bc', code: 'BC', name: 'British Columbia', combinedRate: 12, taxModel: 'GST_PST', provinceCode: 'BC', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 7, authority: 'BC' }] },
  { id: 'combined-mb', code: 'MB', name: 'Manitoba', combinedRate: 12, taxModel: 'GST_PST', provinceCode: 'MB', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 7, authority: 'MB' }] },
  { id: 'combined-sk', code: 'SK', name: 'Saskatchewan', combinedRate: 11, taxModel: 'GST_PST', provinceCode: 'SK', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'PST', rate: 6, authority: 'SK' }] },
  { id: 'combined-qc', code: 'QC', name: 'Quebec', combinedRate: 14.975, taxModel: 'GST_PST', provinceCode: 'QC', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }, { code: 'QST', rate: 9.975, authority: 'Revenu Québec' }] },
  { id: 'combined-on', code: 'ON', name: 'Ontario', combinedRate: 13, taxModel: 'HST', provinceCode: 'ON', breakdown: [{ code: 'HST', rate: 13, authority: 'CRA' }] },
  { id: 'combined-nb', code: 'NB', name: 'New Brunswick', combinedRate: 15, taxModel: 'HST', provinceCode: 'NB', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { id: 'combined-nl', code: 'NL', name: 'Newfoundland', combinedRate: 15, taxModel: 'HST', provinceCode: 'NL', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { id: 'combined-ns', code: 'NS', name: 'Nova Scotia', combinedRate: 15, taxModel: 'HST', provinceCode: 'NS', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { id: 'combined-pe', code: 'PE', name: 'Prince Edward Island', combinedRate: 15, taxModel: 'HST', provinceCode: 'PE', breakdown: [{ code: 'HST', rate: 15, authority: 'CRA' }] },
  { id: 'combined-ab', code: 'AB', name: 'Alberta', combinedRate: 5, taxModel: 'GST_ONLY', provinceCode: 'AB', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { id: 'combined-nt', code: 'NT', name: 'Northwest Territories', combinedRate: 5, taxModel: 'GST_ONLY', provinceCode: 'NT', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { id: 'combined-nu', code: 'NU', name: 'Nunavut', combinedRate: 5, taxModel: 'GST_ONLY', provinceCode: 'NU', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
  { id: 'combined-yt', code: 'YT', name: 'Yukon', combinedRate: 5, taxModel: 'GST_ONLY', provinceCode: 'YT', breakdown: [{ code: 'GST', rate: 5, authority: 'CRA' }] },
];

const COMBINED_PAID_TAX_OPTIONS: CombinedTaxOption[] = COMBINED_TAX_OPTIONS.map((opt) => ({
  ...opt,
  id: opt.id.replace('combined-', 'combined-paid-'),
  name: opt.taxModel === 'HST'
    ? `${opt.name} — HST Paid (ITC)`
    : opt.taxModel === 'GST_PST'
      ? `${opt.name} — GST Paid (ITC) + ${opt.provinceCode === 'QC' ? 'QST Paid (ITR)' : 'PST Paid'}`
      : `${opt.name} — GST Paid (ITC)`,
  breakdown: opt.breakdown.map((b) => ({
    ...b,
    code: b.code === 'GST' ? 'GST-ITC' : b.code === 'HST' ? 'HST-ITC' : b.code === 'QST' ? 'QST-ITR' : 'PST-PAID',
  })),
}));

interface TaxCodeSelectProps {
  organizationId?: string;
  value: string | null | undefined;
  onValueChange: (taxCode: TaxCode | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCombinedRates?: boolean;
  /** Prefer collect, paid/ITC, or both groups in the picker. */
  direction?: 'collected' | 'paid' | 'both';
}

export function TaxCodeSelect({
  organizationId,
  value,
  onValueChange,
  placeholder = 'Select Tax',
  disabled = false,
  className,
  showCombinedRates = true,
  direction = 'both',
}: TaxCodeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const { data: taxCodes = [], isLoading } = useTaxCodes(organizationId);
  const { data: orgAccounts = [] } = useAccounts(organizationId);



  // Normalize empty strings to null for comparison
  const normalizedValue = value === '' ? null : value;
  
  const selectedTaxCode = useMemo(
    () => taxCodes.find((tc) => tc.id === normalizedValue) ?? null,
    [taxCodes, normalizedValue]
  );

  // Check if a combined option is selected (by ID or by matching rate + jurisdiction)
  const selectedCombinedOption = useMemo(() => {
    if (!normalizedValue) return null;
    
    // First check by direct ID match
    const byId = [...COMBINED_TAX_OPTIONS, ...COMBINED_PAID_TAX_OPTIONS].find(opt => opt.id === normalizedValue);
    if (byId) return byId;
    
    // If we have a selected tax code, try to match it to a combined option
    // This handles cases where a tax code was selected but should display as combined
    if (selectedTaxCode) {
      // Match by jurisdiction and combined rate
      const byJurisdiction = COMBINED_TAX_OPTIONS.find(opt => 
        opt.provinceCode === selectedTaxCode.jurisdiction && 
        Math.abs(opt.combinedRate - selectedTaxCode.rate) < 0.01
      );
      if (byJurisdiction) return byJurisdiction;
      
      // Match GST+PST/GST+QST combined codes
      if (selectedTaxCode.tax_type === 'GST+PST' || selectedTaxCode.tax_type === 'GST+QST') {
        const byRate = COMBINED_TAX_OPTIONS.find(opt => 
          Math.abs(opt.combinedRate - selectedTaxCode.rate) < 0.01 &&
          opt.taxModel === 'GST_PST'
        );
        if (byRate) return byRate;
      }
    }
    
    return null;
  }, [normalizedValue, selectedTaxCode]);

  const filteredTaxCodes = useMemo(() => {
    if (!search) return taxCodes;
    const term = search.toLowerCase();
    return taxCodes.filter(
      (tc) =>
        tc.code.toLowerCase().includes(term) ||
        tc.name.toLowerCase().includes(term) ||
        tc.tax_type.toLowerCase().includes(term)
    );
  }, [taxCodes, search]);

  const filterCombined = (list: CombinedTaxOption[]) => {
    if (!search) return list;
    const term = search.toLowerCase();
    return list.filter(
      (opt) =>
        opt.code.toLowerCase().includes(term) ||
        opt.name.toLowerCase().includes(term) ||
        opt.combinedRate.toString().includes(term) ||
        opt.id.includes('paid')
    );
  };

  const filteredCombinedOptions = useMemo(
    () => filterCombined(COMBINED_TAX_OPTIONS),
    [search],
  );
  const filteredCombinedPaidOptions = useMemo(
    () => filterCombined(COMBINED_PAID_TAX_OPTIONS),
    [search],
  );

  // Group tax codes by type
  const groupedTaxCodes = useMemo(() => {
    const groups: Record<string, TaxCode[]> = {
      'Paid / ITC': [],
      'Collect': [],
      'Exempt': [],
    };
    filteredTaxCodes.forEach((tc) => {
      const group = taxCodeGroupLabel(tc);
      if (!groups[group]) groups[group] = [];
      groups[group].push(tc);
    });
    return groups;
  }, [filteredTaxCodes]);

  // Group combined options by tax model
  const groupCombinedByModel = (options: CombinedTaxOption[]) => {
    const groups: Record<string, CombinedTaxOption[]> = {
      'HST Provinces': [],
      'GST + PST Provinces': [],
      'GST Only': [],
    };
    options.forEach(option => {
      if (option.taxModel === 'HST') groups['HST Provinces'].push(option);
      else if (option.taxModel === 'GST_PST') groups['GST + PST Provinces'].push(option);
      else groups['GST Only'].push(option);
    });
    return groups;
  };

  const groupedCombinedOptions = useMemo(
    () => groupCombinedByModel(filteredCombinedOptions),
    [filteredCombinedOptions],
  );
  const groupedCombinedPaidOptions = useMemo(
    () => groupCombinedByModel(filteredCombinedPaidOptions),
    [filteredCombinedPaidOptions],
  );

  const handleSelect = (taxCode: TaxCode | null) => {
    onValueChange(taxCode);
    setOpen(false);
    setSearch('');
  };

  const handleSelectCombined = (option: CombinedTaxOption) => {
    const isPaidOption = option.id.includes('-paid-');
    // Find or create a matching tax code for this combined rate
    const matchingCode = taxCodes.find(tc => 
      tc.rate === option.combinedRate && 
      (tc.jurisdiction === option.provinceCode || tc.tax_type.includes(option.taxModel)) &&
      (isPaidOption
        ? isPaidRetailTaxCode(tc.code, tc.applies_to)
        : !isPaidRetailTaxCode(tc.code, tc.applies_to))
    );
    
    if (matchingCode) {
      onValueChange(matchingCode);
    } else {
      // Look up the org's individual tax codes so we can attach real GL accounts
      // to the synthetic combined code. Without this, calculateTax falls into the
      // GST_PST split branch with empty glAccounts and the dialog shows the
      // "Tax GL accounts not configured" warning even when accounts exist.
      const findCode = (predicate: (tc: TaxCode) => boolean) =>
        taxCodes.find(predicate);

      const gstCode = findCode(tc =>
        tc.code.toUpperCase() === 'GST' || tc.tax_type?.toUpperCase() === 'GST'
      );
      const hstCode = findCode(tc =>
        tc.code.toUpperCase().startsWith('HST') || tc.tax_type?.toUpperCase() === 'HST'
      );
      const pstCode = findCode(tc => {
        const code = tc.code.toUpperCase();
        const type = (tc.tax_type || '').toUpperCase();
        if (option.provinceCode === 'QC') {
          return code === 'QST' || type === 'QST' || code === 'PST' || type === 'PST';
        }
        return code === 'PST' || type === 'PST' || code.startsWith('PST');
      });

      // Chart-of-accounts fallbacks (used when tax_codes lack GL links)
      const gstHstCollectedFallback = resolveTaxAccount(orgAccounts, [
        /^GST\/HST Payable/i,
        /^GST\/HST Collected/i,
      ]);
      const gstHstPaidFallback = resolveTaxAccount(orgAccounts, [
        /^GST\/HST.*Input Tax Credit/i,
        /^GST\/HST Paid/i,
        /^GST\/HST Receivable/i,
      ]);
      const pstCollectedFallback = resolveTaxAccount(orgAccounts, [
        /^PST Payable/i,
        /^PST Collected/i,
        /^QST Payable/i,
      ]);
      const pstPaidFallback = resolveTaxAccount(orgAccounts, [
        /^PST Paid/i,
        /^QST.*Input Tax/i,
      ]);

      let gl_collected_account_id: string | null = null;
      let gl_paid_account_id: string | null = null;
      let component_taxes: Array<{
        code: string;
        rate: number;
        isRecoverable: boolean;
        authority: 'CRA' | 'Provincial' | 'Revenu Quebec';
        glCollectedAccountId: string | null;
        glPaidAccountId: string | null;
      }> | undefined;

      if (option.taxModel === 'HST') {
        const src = hstCode || gstCode;
        gl_collected_account_id = src?.gl_collected_account_id ?? gstHstCollectedFallback;
        gl_paid_account_id = src?.gl_paid_account_id ?? gstHstPaidFallback;
      } else if (option.taxModel === 'GST_PST') {
        const gstBd = option.breakdown.find(b => b.code === 'GST');
        const pstBd = option.breakdown.find(b => b.code !== 'GST');
        const isQC = option.provinceCode === 'QC';
        component_taxes = [
          {
            code: 'GST',
            rate: gstBd?.rate ?? 5,
            isRecoverable: true,
            authority: 'CRA',
            glCollectedAccountId: gstCode?.gl_collected_account_id ?? gstHstCollectedFallback,
            glPaidAccountId: gstCode?.gl_paid_account_id ?? gstHstPaidFallback,
          },
          {
            code: isQC ? 'QST' : `PST-${option.provinceCode}`,
            rate: pstBd?.rate ?? 0,
            isRecoverable: isQC,
            authority: isQC ? 'Revenu Quebec' : 'Provincial',
            glCollectedAccountId: pstCode?.gl_collected_account_id ?? pstCollectedFallback,
            glPaidAccountId: pstCode?.gl_paid_account_id ?? pstPaidFallback,
          },
        ];
      } else {
        // GST_ONLY
        gl_collected_account_id = gstCode?.gl_collected_account_id ?? gstHstCollectedFallback;
        gl_paid_account_id = gstCode?.gl_paid_account_id ?? gstHstPaidFallback;
      }

      const isPaid = option.id.includes('-paid-');
      // Create a synthetic tax code for the combined rate
      const syntheticCode: TaxCode = {
        id: option.id,
        organization_id: organizationId || '',
        code: isPaid
          ? (option.taxModel === 'HST' ? `HST-${option.code}-ITC` : `GST+PST-${option.code}-ITC`)
          : (option.taxModel === 'HST' ? `HST-${option.code}` : `GST+PST-${option.code}`),
        name: `${option.name} (${option.combinedRate}%)`,
        rate: option.combinedRate,
        jurisdiction: option.provinceCode,
        tax_type: option.taxModel === 'HST' ? 'HST' : option.taxModel === 'GST_PST' ? 'GST+PST' : 'GST',
        is_recoverable: option.taxModel !== 'GST_PST' || option.provinceCode === 'QC',
        is_compound: false,
        is_active: true,
        applies_to: isPaid ? 'purchases' : 'both',
        gl_collected_account_id: isPaid ? null : gl_collected_account_id,
        gl_paid_account_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // @ts-ignore - Extended field consumed by calculateTax for split posting
        component_taxes,
      };
      onValueChange(syntheticCode);
    }
    setOpen(false);
    setSearch('');
  };

  const getTaxModelBadge = (model: string) => {
    switch (model) {
      case 'HST':
        return <Badge className="text-[10px] px-1.5 py-0 bg-slate-700 text-white border-0">HST</Badge>;
      case 'GST_PST':
        return <Badge className="text-[10px] px-1.5 py-0 bg-slate-700 text-white border-0">GST+PST</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0 bg-slate-700 text-white border-0">GST</Badge>;
    }
  };

  // Display value
  const displayValue = selectedCombinedOption 
    ? `${selectedCombinedOption.name} (${selectedCombinedOption.combinedRate}%)`
    : selectedTaxCode 
      ? `${selectedTaxCode.code} (${selectedTaxCode.rate}%)`
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          disabled={disabled || isLoading}
        >
          {displayValue ? (
            <div className="flex items-center gap-2 truncate">
              {selectedCombinedOption ? (
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              ) : (
                <Percent className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{displayValue}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{isLoading ? 'Loading...' : placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tax rates..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[350px]">
            <CommandEmpty>
              {taxCodes.length === 0 
                ? 'No tax codes configured. Set up in Settings → Sales Tax.'
                : 'No matching tax codes.'
              }
            </CommandEmpty>
            
            {/* No Tax Option */}
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => handleSelect(null)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !normalizedValue ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="text-muted-foreground">No Tax</span>
              </CommandItem>
            </CommandGroup>

            {/* Combined Provincial Tax Rates */}
            {showCombinedRates && direction !== 'paid' && Object.entries(groupedCombinedOptions).map(([group, options]) => (
              options.length > 0 && (
                <CommandGroup key={group} heading={group}>
                  {options.map((option) => (
                    <CombinedRateItem
                      key={option.id}
                      option={option}
                      selected={normalizedValue === option.id ||
                        (selectedTaxCode?.rate === option.combinedRate && selectedTaxCode?.jurisdiction === option.provinceCode && !isPaidRetailTaxCode(selectedTaxCode.code, selectedTaxCode.applies_to))}
                      onSelect={() => handleSelectCombined(option)}
                      badge={getTaxModelBadge(option.taxModel)}
                    />
                  ))}
                </CommandGroup>
              )
            ))}

            {showCombinedRates && direction !== 'collected' && Object.entries(groupedCombinedPaidOptions).map(([group, options]) => (
              options.length > 0 && (
                <CommandGroup key={`paid-${group}`} heading={`${group} — Paid (ITC)`}>
                  {options.map((option) => (
                    <CombinedRateItem
                      key={option.id}
                      option={option}
                      selected={normalizedValue === option.id || selectedTaxCode?.id === option.id}
                      onSelect={() => handleSelectCombined(option)}
                      badge={getTaxModelBadge(option.taxModel)}
                    />
                  ))}
                </CommandGroup>
              )
            ))}

            {/* Individual Tax Codes: Paid / ITC, Collect, Exempt */}
            {(['Paid / ITC', 'Collect', 'Exempt'] as const)
              .filter((group) => {
                if (direction === 'paid' && group === 'Collect') return false;
                if (direction === 'collected' && group === 'Paid / ITC') return false;
                return (groupedTaxCodes[group] || []).length > 0;
              })
              .map((group) => (
              <CommandGroup key={group} heading={group === 'Collect' ? 'Collect' : group}>
                {(groupedTaxCodes[group] || []).map((tc) => (
                  <CommandItem
                    key={tc.id}
                    value={tc.id}
                    onSelect={() => handleSelect(tc)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        normalizedValue === tc.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium">{tc.code}</span>
                      <span className="text-muted-foreground text-sm truncate">{tc.name}</span>
                    </div>
                    <Badge 
                      className={`text-xs px-1.5 py-0 border-0 ${tc.rate > 0 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {tc.rate}%
                    </Badge>
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

function CombinedRateItem({
  option,
  selected,
  onSelect,
  badge,
}: {
  option: CombinedTaxOption;
  selected: boolean;
  onSelect: () => void;
  badge: ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CommandItem value={option.id} onSelect={onSelect}>
            <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
            <div className="flex items-center gap-2 flex-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium">{option.code}</span>
              <span className="text-muted-foreground text-sm truncate">{option.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {badge}
              <Badge className="text-xs px-1.5 py-0 tabular-nums bg-teal-600 text-white border-0">
                {option.combinedRate}%
              </Badge>
            </div>
          </CommandItem>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          <TaxBreakdownTooltip option={option} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TaxBreakdownTooltip({ option }: { option: CombinedTaxOption }) {
  if (option.taxModel === 'HST') {
    return (
      <div className="space-y-1">
        <p className="font-medium">HST {option.combinedRate}%</p>
        <p className="text-xs text-muted-foreground">
          Single combined tax administered by CRA
        </p>
      </div>
    );
  }
  
  if (option.taxModel === 'GST_PST') {
    return (
      <div className="space-y-1">
        <p className="font-medium">Separate Tax Accounting</p>
        <div className="text-xs space-y-0.5">
          {option.breakdown.map((tax, idx) => (
            <p key={idx}>
              {tax.code} {tax.rate}% ({tax.authority})
            </p>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t">
          Combined: {option.combinedRate}%
        </p>
        <p className="text-[10px] text-warning">
          ⚠️ Posted separately to GL
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      <p className="font-medium">GST {option.breakdown[0]?.rate || 5}%</p>
      <p className="text-xs text-muted-foreground">
        Federal tax only (CRA)
      </p>
    </div>
  );
}

// Tax calculation helper
export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: Array<{
    code: string;
    rate: number;
    amount: number;
    glAccountId: string | null;
  }>;
}

export type TaxTxDirection = 'deposit' | 'withdrawal' | 'transfer';

export function calculateTax(
  amount: number, 
  taxCode: TaxCode | null, 
  isInclusive: boolean = false,
  txType: TaxTxDirection = 'withdrawal'
): TaxCalculationResult {
  const forcePaid = isPaidRetailTaxCode(taxCode?.code || '', taxCode?.applies_to);
  const isCollected = txType === 'deposit' && !forcePaid;
  if (!taxCode || taxCode.rate === 0) {
    return {
      subtotal: amount,
      taxAmount: 0,
      total: amount,
      taxBreakdown: [],
    };
  }

  // Check if this is a combined provincial tax code (GST+PST)
  const isGstPst = taxCode.tax_type === 'GST+PST' || taxCode.tax_type === 'GST+QST';
  const jurisdiction = taxCode.jurisdiction || '';
  const provinceConfig = PROVINCE_TAX_CONFIG[jurisdiction];
  
  // If this is a GST+PST province, use the split calculator
  if (isGstPst && provinceConfig && provinceConfig.taxModel === 'GST_PST') {
    // Pull per-component GL accounts from the combined code's component_taxes (set by useSalesTax).
    // This guarantees PST routes to its dedicated PST Paid (Non-Recoverable) account, not GST ITC.
    const components = (taxCode as unknown as {
      component_taxes?: Array<{ code: string; glPaidAccountId?: string | null; glCollectedAccountId?: string | null }>;
    }).component_taxes;

    const gstComponent = components?.find(c => c.code === 'GST');
    const pstComponent = components?.find(c => c.code !== 'GST');

    const glAccounts = {
      gst: isCollected
        ? (gstComponent?.glCollectedAccountId ?? gstComponent?.glPaidAccountId ?? undefined)
        : (gstComponent?.glPaidAccountId ?? gstComponent?.glCollectedAccountId ?? undefined),
      pst: isCollected
        ? (pstComponent?.glCollectedAccountId ?? pstComponent?.glPaidAccountId ?? undefined)
        : (pstComponent?.glPaidAccountId ?? pstComponent?.glCollectedAccountId ?? undefined),
    };

    const splitCalc = calculateSplitTaxes(amount, jurisdiction, isInclusive, glAccounts);

    return {
      subtotal: splitCalc.taxableAmount,
      taxAmount: splitCalc.totalTax,
      total: splitCalc.grossAmount,
      taxBreakdown: splitCalc.taxes.map(t => ({
        code: t.type === 'QST' ? 'QST' : t.type === 'PST' ? 'PST' : t.code,
        rate: t.rate,
        amount: t.amount,
        glAccountId: t.glAccountId || null,
      })),
    };
  }

  // Standard single-tax calculation
  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (isInclusive) {
    // Tax is included in the amount
    total = amount;
    subtotal = amount / (1 + taxCode.rate / 100);
    taxAmount = total - subtotal;
  } else {
    // Tax is added on top
    subtotal = amount;
    taxAmount = amount * (taxCode.rate / 100);
    total = subtotal + taxAmount;
  }

// Single tax breakdown — route to collected for deposits (sales) and paid for purchases.
  const singleGl = isCollected
    ? (taxCode.gl_collected_account_id || taxCode.gl_paid_account_id)
    : (taxCode.gl_paid_account_id || taxCode.gl_collected_account_id);
  const taxBreakdown: TaxCalculationResult['taxBreakdown'] = [{
    code: taxCode.code,
    rate: taxCode.rate,
    amount: Math.round(taxAmount * 100) / 100,
    glAccountId: singleGl,
  }];

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    taxBreakdown,
  };
}