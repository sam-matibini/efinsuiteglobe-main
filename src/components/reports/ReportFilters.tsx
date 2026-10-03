import React, { useState, ReactNode } from 'react';
import { Calendar, ArrowLeftRight, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn, parseLocalDate } from '@/lib/utils';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import { SavedFilterMenu } from '@/components/filters/SavedFilterMenu';
import type { FinancialReportSavedFilter } from '@/lib/savedFilters';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';
import { DateRangePresetSelect } from '@/components/filters/DateRangePresetSelect';
import {
  detectDateRangePreset,
  resolveDateRangePreset,
  STATEMENT_DATE_PRESETS,
  STATEMENT_PRESET_IDS,
  toLocalISO,
  type DateRangePresetId,
} from '@/lib/dateRangePresets';

export type DatePreset = DateRangePresetId;

export interface CompareSettings {
  compareType: 'period' | 'year';
  numberOfPeriods: number;
  latestToOldest: boolean;
}

interface ReportFiltersProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  onRunReport?: () => void;
  onCompareChange?: (settings: CompareSettings | null) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  showExpandCollapse?: boolean;
  showZeroBalances?: boolean;
  onShowZeroBalancesChange?: (show: boolean) => void;
  onExport?: () => void;
  actions?: ReactNode;
  /** The currently selected start date (controlled) */
  initialStartDate?: Date;
  /** The currently selected end date (controlled) */
  initialEndDate?: Date;
  initialPreset?: DatePreset;
  /** Fiscal year end month (1-12), defaults to 12 (December) */
  fiscalYearEndMonth?: number;
}

export const ReportFilters = React.forwardRef<HTMLDivElement, ReportFiltersProps>(function ReportFilters({
  onDateRangeChange,
  onRunReport,
  onCompareChange,
  onExpandAll,
  onCollapseAll,
  showExpandCollapse = true,
  showZeroBalances = false,
  onShowZeroBalancesChange,
  onExport,
  actions,
  initialStartDate,
  initialEndDate,
  initialPreset = 'last-fiscal-year',
  fiscalYearEndMonth = 12,
}: ReportFiltersProps, ref) {
  // Use controlled dates directly from props - NO local duplicate state
  // The parent (via useReportFilters context) owns the date state
  const now = new Date();
  const currentFY = getFiscalYearForDate(now, fiscalYearEndMonth);
  const lastFY = currentFY - 1;
  const startDate = initialStartDate ?? getFiscalYearStart(lastFY, fiscalYearEndMonth);
  const endDate = initialEndDate ?? getFiscalYearEnd(lastFY, fiscalYearEndMonth);
  
  // Detect preset from current dates (always derived, not stored)
  const datePreset = detectDateRangePreset(startDate, endDate, STATEMENT_PRESET_IDS, now, fiscalYearEndMonth);
  
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareSettings, setCompareSettings] = useState<CompareSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Temp state for dialog
  const [tempCompareType, setTempCompareType] = useState<'period' | 'year'>('period');
  const [tempNumberOfPeriods, setTempNumberOfPeriods] = useState('1');
  const [tempLatestToOldest, setTempLatestToOldest] = useState(true);
  const { organization } = useCurrentOrganization();
  const savedReportFilters = useSavedFilters<FinancialReportSavedFilter>('financial-reports', organization?.id);

  const currentReportFilter = (): FinancialReportSavedFilter => ({
    startDate: toLocalISO(startDate),
    endDate: toLocalISO(endDate),
    datePreset,
    showZeroBalances,
    compare: compareSettings
      ? {
          type: compareSettings.compareType,
          count: compareSettings.numberOfPeriods,
          latestToOldest: compareSettings.latestToOldest,
        }
      : null,
    divisionIds: [],
  });

  const applyReportFilter = (value: FinancialReportSavedFilter) => {
    const preset = value.datePreset;
    const rolling = preset && preset !== 'custom'
      ? resolveDateRangePreset(preset as DateRangePresetId, new Date(), fiscalYearEndMonth)
      : null;
    if (rolling) {
      onDateRangeChange?.(rolling.start, rolling.end);
    } else if (value.startDate && value.endDate) {
      onDateRangeChange?.(parseLocalDate(value.startDate), parseLocalDate(value.endDate));
    }
    onShowZeroBalancesChange?.(!!value.showZeroBalances);
    if (value.compare && (value.compare.type === 'period' || value.compare.type === 'year')) {
      const settings: CompareSettings = {
        compareType: value.compare.type,
        numberOfPeriods: value.compare.count || 1,
        latestToOldest: value.compare.latestToOldest ?? true,
      };
      setCompareSettings(settings);
      onCompareChange?.(settings);
    } else {
      setCompareSettings(null);
      onCompareChange?.(null);
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    const bounds = resolveDateRangePreset(preset, new Date(), fiscalYearEndMonth);
    if (!bounds) return;
    onDateRangeChange?.(bounds.start, bounds.end);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (date) {
      // Immediately update parent state (controlled component)
      onDateRangeChange?.(date, endDate);
      setHasChanges(true);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date) {
      // Immediately update parent state (controlled component)
      onDateRangeChange?.(startDate, date);
      setHasChanges(true);
    }
  };

  const handleRunReport = () => {
    onRunReport?.();
    setHasChanges(false);
  };

  const handleApplyCompare = () => {
    const settings: CompareSettings = {
      compareType: tempCompareType,
      numberOfPeriods: parseInt(tempNumberOfPeriods),
      latestToOldest: tempLatestToOldest,
    };
    setCompareSettings(settings);
    onCompareChange?.(settings);
    setCompareDialogOpen(false);
  };

  const handleClearCompare = () => {
    setCompareSettings(null);
    onCompareChange?.(null);
  };

  const formatDateRange = () => {
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-between gap-4 bg-card rounded-lg border border-border p-4">
      <div className="flex items-center gap-4">
        {/* Quick Actions - only show expand/collapse when applicable */}
        {showExpandCollapse && onExpandAll && (
          <button 
            onClick={onExpandAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Expand All
          </button>
        )}
        {showExpandCollapse && onCollapseAll && (
          <button 
            onClick={onCollapseAll}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse All
          </button>
        )}
        <button 
          onClick={() => onShowZeroBalancesChange?.(!showZeroBalances)}
          className={`text-sm transition-colors ${showZeroBalances ? 'text-accent font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Show Zero Balances
        </button>
      </div>

      <div className="flex items-center gap-3">
        <SavedFilterMenu
          items={savedReportFilters.items}
          onSave={(filterName) => savedReportFilters.save(filterName, currentReportFilter())}
          onApply={(filter) => applyReportFilter(filter.value)}
          onDelete={savedReportFilters.remove}
        />
        {/* Date Preset Selector */}
        <DateRangePresetSelect
          value={datePreset}
          presets={STATEMENT_DATE_PRESETS}
          onValueChange={handlePresetChange}
          triggerClassName="w-56 bg-background border-border"
        />

        {/* Date Range Display/Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              {formatDateRange()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border border-border z-50" align="end">
            <div className="flex">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={handleStartDateChange}
                initialFocus
              />
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={handleEndDateChange}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Run Report Button */}
        <Button 
          onClick={handleRunReport}
          className={cn(
            "gap-2",
            hasChanges && "bg-accent hover:bg-accent/90"
          )}
        >
          <Play className="w-4 h-4" />
          Run Report
        </Button>

        {/* Compare With Button */}
        <div className="flex items-center gap-1">
          <Button 
            variant={compareSettings ? "default" : "outline"} 
            className={`gap-2 ${compareSettings ? 'bg-accent hover:bg-accent/90' : ''}`}
            onClick={() => setCompareDialogOpen(true)}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Compare
          </Button>
          {compareSettings && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClearCompare}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Custom Actions or Export Button */}
        {actions}
      </div>

      {/* Compare With Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Compare With</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Compare current period with previous periods or years
            </p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Compare Type */}
            <div className="space-y-2">
              <Label className="text-foreground">Compare Based on Period/Year</Label>
              <Select value={tempCompareType} onValueChange={(v) => setTempCompareType(v as 'period' | 'year')}>
                <SelectTrigger className="w-full border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border z-50">
                  <SelectItem value="period">Previous Period(s)</SelectItem>
                  <SelectItem value="year">Previous Year(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number of Periods - Typable Input */}
            <div className="space-y-2">
              <Label className="text-foreground">
                Number of {tempCompareType === 'period' ? 'Period(s)' : 'Year(s)'}
              </Label>
              <Input
                type="number"
                min="1"
                max="999"
                value={tempNumberOfPeriods}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty for typing, but ensure positive integers
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 999)) {
                    setTempNumberOfPeriods(value);
                  }
                }}
                onBlur={() => {
                  // Ensure valid value on blur
                  const num = parseInt(tempNumberOfPeriods);
                  if (isNaN(num) || num < 1) {
                    setTempNumberOfPeriods('1');
                  } else if (num > 999) {
                    setTempNumberOfPeriods('999');
                  }
                }}
                placeholder="Enter number..."
                className={cn("w-full")}
              />
            </div>

            {/* Arrangement Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="latestToOldest"
                checked={tempLatestToOldest}
                onCheckedChange={(checked) => setTempLatestToOldest(checked as boolean)}
              />
              <Label htmlFor="latestToOldest" className="text-sm text-muted-foreground cursor-pointer">
                Arrange period/year from latest to oldest
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompareDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyCompare} className="bg-accent hover:bg-accent/90">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
