import React, { useState, ReactNode } from 'react';
import { ArrowLeftRight, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';
import { DateRangePicker } from './DateRangePicker';

/** @deprecated Presets now live in lib/reportDateRanges; kept for existing imports. */
export type DatePreset = 'today' | 'this-month' | 'this-quarter' | 'fiscal-year-to-date' | 'last-fiscal-year' | 'custom';

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

// Helper to format date in local timezone (avoids UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareSettings, setCompareSettings] = useState<CompareSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Temp state for dialog
  const [tempCompareType, setTempCompareType] = useState<'period' | 'year'>('period');
  const [tempNumberOfPeriods, setTempNumberOfPeriods] = useState('1');
  const [tempLatestToOldest, setTempLatestToOldest] = useState(true);

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
        {/* Report period — Zoho Books–style preset list with a Custom range */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          fiscalYearEndMonth={fiscalYearEndMonth}
          onChange={(start, end) => { onDateRangeChange?.(start, end); setHasChanges(true); }}
        />

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
