import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { format, startOfYear, endOfYear, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { useGenerateConsolidatedReport, ConsolidationGroup, ConsolidationGroupMember } from '@/hooks/useConsolidation';

interface GenerateConsolidatedReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ConsolidationGroup;
  members: ConsolidationGroupMember[];
}

export function GenerateConsolidatedReportDialog({
  open,
  onOpenChange,
  group,
  members,
}: GenerateConsolidatedReportDialogProps) {
  const [reportType, setReportType] = useState<'balance_sheet' | 'income_statement' | 'cash_flow' | 'changes_in_equity'>('balance_sheet');
  const [periodStart, setPeriodStart] = useState<Date>(startOfYear(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = useGenerateConsolidatedReport();

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // Generate placeholder report data
      // In a real implementation, this would aggregate data from all member organizations
      const reportData = {
        generated_at: new Date().toISOString(),
        members: members.map(m => ({
          organization_id: m.organization_id,
          organization_name: m.organization?.name,
          ownership_percentage: m.ownership_percentage,
          consolidation_method: m.consolidation_method,
          functional_currency: m.functional_currency,
        })),
        // Placeholder consolidated figures
        totals: {
          total_assets: 0,
          total_liabilities: 0,
          total_equity: 0,
          total_revenue: 0,
          total_expenses: 0,
          net_income: 0,
        },
      };

      const eliminationEntries = [
        {
          type: 'intercompany_receivable_payable',
          description: 'Elimination of intercompany balances',
          amount: 0,
        },
        {
          type: 'intercompany_revenue_expense',
          description: 'Elimination of intercompany transactions',
          amount: 0,
        },
      ];

      const currencyTranslations = group.consolidation_type === 'international' ? {
        base_currency: group.base_currency,
        translations: members.map(m => ({
          from_currency: m.functional_currency,
          to_currency: group.base_currency,
          rate: 1, // Placeholder
        })),
      } : null;

      await generateReport.mutateAsync({
        group_id: group.id,
        report_type: reportType,
        period_start: format(periodStart, 'yyyy-MM-dd'),
        period_end: format(periodEnd, 'yyyy-MM-dd'),
        base_currency: group.base_currency,
        report_data: reportData,
        elimination_entries: eliminationEntries,
        currency_translations: currencyTranslations || undefined,
      });

      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const presetPeriods = [
    { label: 'This Year', start: startOfYear(new Date()), end: new Date() },
    { label: 'Last Year', start: startOfYear(subYears(new Date(), 1)), end: endOfYear(subYears(new Date(), 1)) },
    { label: 'Last Quarter', start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 - 3, 1), end: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 0) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Consolidated Report
          </DialogTitle>
          <DialogDescription>
            Create a consolidated financial statement for {group.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report Type */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balance_sheet">Consolidated Balance Sheet</SelectItem>
                <SelectItem value="income_statement">Consolidated Income Statement</SelectItem>
                <SelectItem value="cash_flow">Consolidated Cash Flow</SelectItem>
                <SelectItem value="changes_in_equity">Consolidated Changes in Equity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Period Selection */}
          <div className="space-y-3">
            <Label>Reporting Period</Label>
            <div className="flex flex-wrap gap-2">
              {presetPeriods.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPeriodStart(preset.start);
                    setPeriodEnd(preset.end);
                  }}
                  className={cn(
                    format(periodStart, 'yyyy-MM-dd') === format(preset.start, 'yyyy-MM-dd') &&
                    format(periodEnd, 'yyyy-MM-dd') === format(preset.end, 'yyyy-MM-dd')
                      ? 'border-primary bg-primary/10'
                      : ''
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(periodStart, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={periodStart}
                      onSelect={(date) => date && setPeriodStart(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(periodEnd, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={periodEnd}
                      onSelect={(date) => date && setPeriodEnd(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-medium">Consolidation Summary</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• {members.length} entities will be consolidated</p>
              <p>• Base currency: {group.base_currency}</p>
              <p>• Type: {group.consolidation_type === 'international' ? 'International (with FX translation)' : 'Domestic'}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || members.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Report'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
