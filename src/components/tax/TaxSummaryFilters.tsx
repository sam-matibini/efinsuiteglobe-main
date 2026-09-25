import { useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';

export type TaxReportType = 'summary' | 'detailed' | 'by_tax_code' | 'by_jurisdiction';
export type TaxAccountType = 'all' | 'collected' | 'paid' | 'pst';

interface TaxSummaryFiltersProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  reportType: TaxReportType;
  onReportTypeChange: (type: TaxReportType) => void;
  accountType: TaxAccountType;
  onAccountTypeChange: (type: TaxAccountType) => void;
  selectedTaxCodes: string[];
  onSelectedTaxCodesChange: (codes: string[]) => void;
  availableTaxCodes: { id: string; code: string; name: string }[];
  countryCode: string;
  onClearFilters: () => void;
}

export function TaxSummaryFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  reportType,
  onReportTypeChange,
  accountType,
  onAccountTypeChange,
  selectedTaxCodes,
  onSelectedTaxCodesChange,
  availableTaxCodes,
  countryCode,
  onClearFilters,
}: TaxSummaryFiltersProps) {
  const isBurundi = countryCode === 'BI';

  const hasActiveFilters = useMemo(() => {
    return selectedTaxCodes.length > 0 || accountType !== 'all' || reportType !== 'summary';
  }, [selectedTaxCodes, accountType, reportType]);

  const handleTaxCodeToggle = (codeId: string) => {
    if (selectedTaxCodes.includes(codeId)) {
      onSelectedTaxCodesChange(selectedTaxCodes.filter(c => c !== codeId));
    } else {
      onSelectedTaxCodesChange([...selectedTaxCodes, codeId]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
      {/* Date Range */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Calendar className="w-4 h-4 mr-2" />
              {format(startDate, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={startDate}
              onSelect={(date) => date && onStartDateChange(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground">to</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Calendar className="w-4 h-4 mr-2" />
              {format(endDate, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={endDate}
              onSelect={(date) => date && onEndDateChange(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Report Type */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">
          {isBurundi ? 'Type:' : 'Report:'}
        </Label>
        <Select value={reportType} onValueChange={(v) => onReportTypeChange(v as TaxReportType)}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">{isBurundi ? 'Résumé' : 'Summary'}</SelectItem>
            <SelectItem value="detailed">{isBurundi ? 'Détaillé' : 'Detailed'}</SelectItem>
            <SelectItem value="by_tax_code">{isBurundi ? 'Par Code TVA' : 'By Tax Code'}</SelectItem>
            <SelectItem value="by_jurisdiction">{isBurundi ? 'Par Juridiction' : 'By Jurisdiction'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Account Type Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">
          {isBurundi ? 'Compte:' : 'Account:'}
        </Label>
        <Select value={accountType} onValueChange={(v) => onAccountTypeChange(v as TaxAccountType)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isBurundi ? 'Tous' : 'All Types'}</SelectItem>
            <SelectItem value="collected">{isBurundi ? 'Collectée' : 'Collected'}</SelectItem>
            <SelectItem value="paid">{isBurundi ? 'Payée' : 'Paid/ITC'}</SelectItem>
            {countryCode === 'CA' && <SelectItem value="pst">PST</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Tax Code Filter */}
      {availableTaxCodes.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="w-4 h-4 mr-2" />
              {isBurundi ? 'Codes TVA' : 'Tax Codes'}
              {selectedTaxCodes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTaxCodes.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {isBurundi ? 'Filtrer par Code' : 'Filter by Tax Code'}
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {availableTaxCodes.map((tc) => (
                  <div key={tc.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={tc.id}
                      checked={selectedTaxCodes.includes(tc.id)}
                      onCheckedChange={() => handleTaxCodeToggle(tc.id)}
                    />
                    <label
                      htmlFor={tc.id}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {tc.code} - {tc.name}
                    </label>
                  </div>
                ))}
              </div>
              {selectedTaxCodes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => onSelectedTaxCodesChange([])}
                >
                  {isBurundi ? 'Effacer' : 'Clear Selection'}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={onClearFilters}>
          <X className="w-4 h-4 mr-1" />
          {isBurundi ? 'Réinitialiser' : 'Clear Filters'}
        </Button>
      )}
    </div>
  );
}
