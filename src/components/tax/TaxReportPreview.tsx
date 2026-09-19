import { useState, useMemo, Fragment } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Download, Eye, FileText, Printer, Filter, SlidersHorizontal, GitCompare, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { addPdfBrandingFooter } from '@/lib/pdfBrandingFooter';
import { cn } from '@/lib/utils';
import { TaxDateRangeBar } from '@/components/tax/TaxDateRangeBar';
import { GstHstSupportReport } from '@/components/tax/GstHstSupportReport';
import { useTaxPeriodActivity, useTaxPeriodComparisonSummaries } from '@/hooks/useTaxPeriodActivity';
import { useGstHstComparisonReports, useGstHstPeriodReport } from '@/hooks/useGstHstPeriodReport';
import {
  resolveTaxDateRange,
  resolveComparisonRanges,
  toISODate,
  sanitizeComparePeriodCountInput,
  commitComparePeriodCount,
  stepComparePeriodCount,
  MAX_COMPARE_PERIODS,
  type TaxDatePreset,
  type TaxCompareType,
} from '@/lib/taxPeriodReport';

interface TaxReportPreviewProps {
  organizationId?: string;
  organizationName?: string;
  countryCode: string;
  taxTerminology: {
    title: string;
    collectedLabel: string;
    paidLabel: string;
    netLabel: string;
    itcLabel: string;
    authorityLabel: string;
  };
  formatCurrency: (value: number) => string;
}

type ReportType = 'summary' | 'detailed' | 'by_tax_code' | 'by_jurisdiction';
type AccountTypeFilter = 'all' | 'collected' | 'paid' | 'pst';
type ReportCategory = 'gst' | 'pst';

export function TaxReportPreview({
  organizationId,
  organizationName,
  countryCode,
  taxTerminology,
  formatCurrency,
}: TaxReportPreviewProps) {
  const [reportCategory, setReportCategory] = useState<ReportCategory>('gst');
  const [periodType, setPeriodType] = useState<TaxDatePreset>('this_quarter');
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Compare With states (applied vs dialog draft so the count field can be typed)
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareType, setCompareType] = useState<TaxCompareType>('none');
  const [comparePeriodsCount, setComparePeriodsCount] = useState(1);
  const [compareArrangeLatest, setCompareArrangeLatest] = useState(true);
  const [draftCompareType, setDraftCompareType] = useState<TaxCompareType>('none');
  const [draftCompareCount, setDraftCompareCount] = useState('1');
  const [draftArrangeLatest, setDraftArrangeLatest] = useState(true);
  
  // Advanced filter states
  const [reportType, setReportType] = useState<ReportType>('detailed');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>('all');
  const [selectedTaxCodes, setSelectedTaxCodes] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  const isBurundi = countryCode === 'BI';
  const isCanada = countryCode === 'CA';

  const dateRange = useMemo(
    () => resolveTaxDateRange(periodType, new Date(), customStartDate, customEndDate),
    [periodType, customStartDate, customEndDate],
  );

  const comparisonRanges = useMemo(
    () => resolveComparisonRanges(compareType, comparePeriodsCount, dateRange, periodType, compareArrangeLatest),
    [compareType, comparePeriodsCount, compareArrangeLatest, periodType, dateRange],
  );

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
  }, [dateRange]);

  const periodStartStr = toISODate(dateRange.start);
  const periodEndStr = toISODate(dateRange.end);

  const {
    allTaxCodes: filteredTaxCodesByCategory,
    journalDetails: filteredJournalDetails,
    periodSummary,
    detailRows,
    detailGroups,
    filingForm: journalFilingForm,
    isLoading: journalLoading,
    isRefreshing: journalRefreshing,
    refetch: refetchJournal,
  } = useTaxPeriodActivity({
    organizationId,
    countryCode,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    category: isCanada ? reportCategory : 'all',
    accountTypeFilter,
    selectedTaxCodes,
    authorityLabel: taxTerminology.authorityLabel,
  });

  const gstJournal = useMemo(() => ({
    taxCollected: periodSummary.taxCollected,
    itcClaimed: periodSummary.itcClaimed,
    taxableSales: periodSummary.taxableSales,
    rows: periodSummary.rows,
  }), [periodSummary]);

  const useGstEngine = isCanada && reportCategory === 'gst';

  const {
    snapshot: gstSnapshot,
    isLoading: gstLoading,
    isFetching: gstFetching,
    refetch: refetchGst,
  } = useGstHstPeriodReport({
    organizationId,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    journal: gstJournal,
    authority: taxTerminology.authorityLabel,
    enabled: useGstEngine,
  });

  const movementComparisons = useTaxPeriodComparisonSummaries({
    organizationId,
    ranges: comparisonRanges,
    category: isCanada ? reportCategory : 'all',
    enabled: compareType !== 'none' && !useGstEngine,
  });

  const gstComparisons = useGstHstComparisonReports({
    organizationId,
    ranges: comparisonRanges,
    enabled: compareType !== 'none' && useGstEngine,
    authority: taxTerminology.authorityLabel,
  });

  const filingForm = useGstEngine ? gstSnapshot.form : journalFilingForm;
  const isLoading = journalLoading || (useGstEngine && gstLoading);
  const isRefreshing = journalRefreshing || (useGstEngine && gstFetching);
  const refetch = () => Promise.all([refetchJournal(), useGstEngine ? refetchGst() : Promise.resolve()]);

  const summary = useMemo(() => ({
    collected: useGstEngine ? gstSnapshot.gstHstCollected : periodSummary.taxCollected,
    paid: useGstEngine ? gstSnapshot.itc : periodSummary.itcClaimed,
    pst: reportCategory === 'pst' ? periodSummary.taxCollected : 0,
    netPayable: useGstEngine ? gstSnapshot.netTax : periodSummary.netPayable,
    taxableSales: useGstEngine ? gstSnapshot.taxableSales : periodSummary.taxableSales,
    zeroRatedSales: useGstEngine ? gstSnapshot.zeroRatedSales : 0,
    exemptSales: useGstEngine ? gstSnapshot.exemptSales : 0,
    exemptZeroRatedSales: useGstEngine ? gstSnapshot.exemptZeroRatedSales : 0,
  }), [useGstEngine, gstSnapshot, periodSummary, reportCategory]);

  const groupedByTaxCode = (useGstEngine ? gstSnapshot.byTaxCode : periodSummary.byTaxCode).map((row) => ({
    code: row.code,
    name: row.name,
    collected: row.taxCollected,
    paid: row.itcClaimed,
    net: row.taxDue,
    rate: row.rate,
    taxableAmount: row.taxableAmount,
  }));

  const hasActiveFilters = selectedTaxCodes.length > 0 || accountTypeFilter !== 'all' || reportType !== 'detailed';

  const clearFilters = () => {
    setSelectedTaxCodes([]);
    setAccountTypeFilter('all');
    setReportType('detailed');
  };

  const applyComparison = () => {
    const count = commitComparePeriodCount(draftCompareCount);
    setCompareType(draftCompareType);
    setComparePeriodsCount(count);
    setCompareArrangeLatest(draftArrangeLatest);
    setDraftCompareCount(String(count));
    setShowCompareDialog(false);
    toast.success(draftCompareType === 'none'
      ? 'Comparison removed'
      : `Comparing with ${count} ${draftCompareType === 'previous_period' ? 'period(s)' : 'year(s)'}`
    );
  };

  const getReportCategoryTitle = () => {
    if (!isCanada) return taxTerminology.title;
    return reportCategory === 'gst' ? 'CRA GST/HST Report' : 'Provincial Sales Tax (PST) Report';
  };

  const getReportCategoryDescription = () => {
    if (!isCanada) return 'Tax reporting and analysis';
    return reportCategory === 'gst' 
      ? 'CRA GST/HST working copy: taxable sales, exempt/zero-rated sales, GST/HST collected, and ITCs for the selected period'
      : 'Provincial sales tax (MB PST, SK PST, BC PST, QST) reporting';
  };

  const generatePdf = async (download: boolean = true) => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;
      
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(getReportCategoryTitle(), pageWidth / 2, y, { align: 'center' });
      y += 8;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(organizationName || 'Organization', pageWidth / 2, y, { align: 'center' });
      y += 6;
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(periodLabel, pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 15;
      
      // Summary Section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 15, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      // Build summary data based on category
      const summaryData: [string, string][] = [];
      
      if (reportCategory === 'gst' || !isCanada) {
        summaryData.push(['Taxable sales', formatCurrency(summary.taxableSales)]);
        if (useGstEngine) {
          summaryData.push(['Zero-rated sales', formatCurrency(summary.zeroRatedSales)]);
          summaryData.push(['Exempt / other revenue', formatCurrency(summary.exemptSales)]);
        }
        summaryData.push([taxTerminology.collectedLabel, formatCurrency(summary.collected)]);
        summaryData.push([taxTerminology.paidLabel, formatCurrency(summary.paid)]);
      }
      
      if (reportCategory === 'pst' && summary.pst !== 0) {
        summaryData.push(['PST/QST Payable', formatCurrency(summary.pst)]);
      }
      
      summaryData.push([taxTerminology.netLabel, formatCurrency(summary.netPayable)]);
      
      summaryData.forEach(([label, value], idx) => {
        const isLast = idx === summaryData.length - 1;
        if (isLast) {
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(240, 240, 240);
          doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
        }
        doc.text(label, 20, y);
        doc.text(value, pageWidth - 20, y, { align: 'right' });
        y += 8;
        if (isLast) doc.setFont('helvetica', 'normal');
      });
      
      y += 10;
      
      // Account Details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Account Details', 15, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(230, 230, 230);
      doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
      doc.text('Account', 20, y);
      doc.text('Code', 80, y);
      doc.text('Type', 110, y);
      doc.text('Period activity', pageWidth - 20, y, { align: 'right' });
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      (periodSummary.byAccount.length > 0 ? periodSummary.byAccount : []).forEach((acc, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(15, y - 4, pageWidth - 30, 6, 'F');
        }
        
        const typeLabel = acc.side === 'collected' ? 'Collected' : 'Paid/ITC';
        doc.text(acc.accountName.substring(0, 30), 20, y);
        doc.text(acc.accountCode, 80, y);
        doc.text(typeLabel, 110, y);
        doc.text(formatCurrency(acc.periodAmount), pageWidth - 20, y, { align: 'right' });
        y += 6;
      });
      
      y += 10;
      
      // Transaction Details (if space allows)
      if (filteredJournalDetails.length > 0 && y < 200) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Recent Transactions', 15, y);
        y += 8;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
        doc.text('Date', 20, y);
        doc.text('Description', 45, y);
        doc.text('Account', 110, y);
        doc.text('Debit', 155, y);
        doc.text('Credit', pageWidth - 20, y, { align: 'right' });
        y += 7;
        
        doc.setFont('helvetica', 'normal');
        const maxLines = Math.min(filteredJournalDetails.length, 15);
        for (let i = 0; i < maxLines; i++) {
          const line = filteredJournalDetails[i];
          if (y > 260) break;
          
          if (i % 2 === 1) {
            doc.setFillColor(248, 248, 248);
            doc.rect(15, y - 4, pageWidth - 30, 5, 'F');
          }
          
          doc.text(format(parseLocalDate(line.entry_date), 'MM/dd'), 20, y);
          doc.text((line.description || '').substring(0, 30), 45, y);
          doc.text(line.account_code || '', 110, y);
          doc.text(line.debit > 0 ? formatCurrency(line.debit) : '', 155, y);
          doc.text(line.credit > 0 ? formatCurrency(line.credit) : '', pageWidth - 20, y, { align: 'right' });
          y += 5;
        }
        
        if (filteredJournalDetails.length > maxLines) {
          y += 3;
          doc.setTextColor(100);
          doc.text(`... and ${filteredJournalDetails.length - maxLines} more transactions`, 20, y);
          doc.setTextColor(0);
        }
      }
      
      // Add branding footer
      await addPdfBrandingFooter({ doc });
      
      if (download) {
        const categoryPrefix = isCanada ? (reportCategory === 'gst' ? 'gst-hst' : 'pst') : 'tax';
        const filename = `${categoryPrefix}-report-${format(dateRange.start, 'yyyyMMdd')}-${format(dateRange.end, 'yyyyMMdd')}.pdf`;
        doc.save(filename);
        toast.success('Tax report downloaded');
      } else {
        // Open in new window for preview
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isBurundi ? 'Rapports TVA' : 'Tax Reports'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isBurundi 
                ? 'Prévisualiser et télécharger les rapports avant de soumettre'
                : 'Preview and download detailed reports before filing returns'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCompareDialog(true)}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              {compareType !== 'none' && <Badge variant="secondary" className="mr-1">{comparePeriodsCount}</Badge>}
              Compare With
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {isBurundi ? 'Filtres' : 'Filters'}
              {hasActiveFilters && <Badge variant="secondary" className="ml-2">{selectedTaxCodes.length + (accountTypeFilter !== 'all' ? 1 : 0) + (reportType !== 'detailed' ? 1 : 0)}</Badge>}
            </Button>
          </div>
        </div>

        {/* Report Category Tabs (Canada only) */}
        {isCanada && (
          <Tabs value={reportCategory} onValueChange={(v) => setReportCategory(v as ReportCategory)} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="gst"
                className="gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-emerald-500"
              >
                <FileText className="w-4 h-4" />
                CRA GST/HST
              </TabsTrigger>
              <TabsTrigger
                value="pst"
                className="gap-2 data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-400 data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-sky-500"
              >
                <FileText className="w-4 h-4" />
                Provincial (PST/QST)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Report Category Header */}
        <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
          <h4 className="font-medium text-foreground">{getReportCategoryTitle()}</h4>
          <p className="text-sm text-muted-foreground">{getReportCategoryDescription()}</p>
        </div>

        {/* Zoho-style date range: Date Range + From + To + Run Report */}
        <TaxDateRangeBar
          preset={periodType}
          start={dateRange.start}
          end={dateRange.end}
          periodLabel={periodLabel}
          countryCode={countryCode}
          isRefreshing={isRefreshing && !isLoading}
          onPresetChange={(next) => {
            setPeriodType(next);
            if (next !== 'custom') {
              setCustomStartDate(undefined);
              setCustomEndDate(undefined);
            }
          }}
          onStartChange={(date) => {
            setPeriodType('custom');
            setCustomStartDate(date);
            setCustomEndDate((prev) => prev ?? dateRange.end);
          }}
          onEndChange={(date) => {
            setPeriodType('custom');
            setCustomEndDate(date);
            setCustomStartDate((prev) => prev ?? dateRange.start);
          }}
          onRun={() => {
            void refetch();
          }}
        />
        {compareType !== 'none' && (
          <div className="mb-4">
            <Badge variant="secondary" className="h-9 px-3 inline-flex items-center gap-1">
              <GitCompare className="w-3 h-3" />
              vs {comparePeriodsCount} {compareType === 'previous_period' ? 'period(s)' : 'year(s)'}
            </Badge>
          </div>
        )}

        {/* Advanced Filters */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg border mb-4">
              {/* Report Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isBurundi ? 'Type de Rapport' : 'Report Type'}</Label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">{isBurundi ? 'Résumé' : 'Summary'}</SelectItem>
                    <SelectItem value="detailed">{isBurundi ? 'Détaillé' : 'Detailed Transactions'}</SelectItem>
                    <SelectItem value="by_tax_code">{isBurundi ? 'Par Code TVA' : 'By Tax Code'}</SelectItem>
                    <SelectItem value="by_jurisdiction">{isBurundi ? 'Par Juridiction' : 'By Jurisdiction'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Account Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isBurundi ? 'Type de Compte' : 'Account Type'}</Label>
                <Select value={accountTypeFilter} onValueChange={(v) => setAccountTypeFilter(v as AccountTypeFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isBurundi ? 'Tous les Types' : 'All Types'}</SelectItem>
                    <SelectItem value="collected">{isBurundi ? 'Collectée' : 'Tax Collected'}</SelectItem>
                    <SelectItem value="paid">{isBurundi ? 'Payée' : 'Tax Paid/ITC'}</SelectItem>
                    {isCanada && reportCategory === 'pst' && <SelectItem value="pst">PST/QST Only</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {/* Tax Code Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isBurundi ? 'Codes TVA' : 'Tax Codes'}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Filter className="w-4 h-4 mr-2" />
                      {selectedTaxCodes.length === 0 
                        ? (isBurundi ? 'Tous les codes' : 'All Codes')
                        : `${selectedTaxCodes.length} ${isBurundi ? 'sélectionné(s)' : 'selected'}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{isBurundi ? 'Filtrer par Code' : 'Filter by Tax Code'}</Label>
                      {filteredTaxCodesByCategory.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          {isBurundi ? 'Aucun code disponible' : 'No tax codes available'}
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {filteredTaxCodesByCategory.map((tc) => (
                            <div key={tc.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={tc.id}
                                checked={selectedTaxCodes.includes(tc.code)}
                                onCheckedChange={() => {
                                  if (selectedTaxCodes.includes(tc.code)) {
                                    setSelectedTaxCodes(selectedTaxCodes.filter(c => c !== tc.code));
                                  } else {
                                    setSelectedTaxCodes([...selectedTaxCodes, tc.code]);
                                  }
                                }}
                              />
                              <label htmlFor={tc.id} className="text-sm cursor-pointer">
                                {tc.code} - {tc.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedTaxCodes.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => setSelectedTaxCodes([])}
                        >
                          {isBurundi ? 'Effacer' : 'Clear Selection'}
                        </Button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Clear Filters */}
              <div className="space-y-2">
                <Label className="text-sm font-medium invisible">Actions</Label>
                {hasActiveFilters && (
                  <Button variant="ghost" className="w-full" onClick={clearFilters}>
                    {isBurundi ? 'Réinitialiser Filtres' : 'Clear All Filters'}
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            {/* Quick Summary Cards — period activity from invoices/bills/expenses */}
            <div className={cn('grid gap-4 mb-6 grid-cols-1', useGstEngine ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
              {(reportCategory === 'gst' || !isCanada) && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isBurundi ? 'Ventes taxables' : useGstEngine ? 'Taxable sales (line 90A)' : 'Taxable sales'}
                  </p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(summary.taxableSales)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
                </div>
              )}
              {useGstEngine && (
                <div className="p-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Exempt / zero-rated sales</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(summary.exemptZeroRatedSales)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Zero-rated {formatCurrency(summary.zeroRatedSales)} · Exempt {formatCurrency(summary.exemptSales)}
                  </p>
                </div>
              )}
              {(reportCategory === 'gst' || !isCanada) && (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      {useGstEngine ? 'GST/HST collected (line 103)' : taxTerminology.collectedLabel}
                    </p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(summary.collected)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">
                      {useGstEngine ? 'Input tax credits (line 106)' : taxTerminology.paidLabel}
                    </p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(summary.paid)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">{periodLabel}</p>
                  </div>
                </>
              )}
              {reportCategory === 'pst' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">PST/QST collected</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(summary.pst)}
                  </p>
                </div>
              )}
              <div className={cn(
                "p-4 rounded-lg",
                summary.netPayable < 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : "bg-amber-50 dark:bg-amber-950/30"
              )}>
                <p className="text-xs text-muted-foreground mb-1">
                  {summary.netPayable < 0
                    ? (isBurundi ? 'Remboursement' : 'Refund due')
                    : (isBurundi ? 'Montant dû' : 'Tax due')}
                </p>
                <p className={cn(
                  "text-xl font-bold",
                  summary.netPayable < 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                )}>
                  {formatCurrency(Math.abs(summary.netPayable))}
                  <span className="text-xs font-normal ml-1">
                    {summary.netPayable < 0
                      ? (isBurundi ? '(remboursement)' : '(refund)')
                      : (isBurundi ? '(dû)' : '(owing)')}
                  </span>
                </p>
              </div>
            </div>

            {/* Comparison Table (if comparing) */}
            {compareType !== 'none' && comparisonRanges.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <GitCompare className="w-4 h-4" />
                  Period Comparison
                </h4>
                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Current Period</TableHead>
                        {(useGstEngine ? gstComparisons : movementComparisons).map((range) => (
                          <TableHead key={range.label} className="text-right">{range.label}</TableHead>
                        ))}
                        <TableHead className="text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(useGstEngine
                        ? [
                            { label: 'Taxable sales', current: summary.taxableSales, read: (i: number) => gstComparisons[i]?.snapshot.taxableSales ?? 0 },
                            { label: 'Zero-rated sales', current: summary.zeroRatedSales, read: (i: number) => gstComparisons[i]?.snapshot.zeroRatedSales ?? 0 },
                            { label: 'Exempt / other revenue', current: summary.exemptSales, read: (i: number) => gstComparisons[i]?.snapshot.exemptSales ?? 0 },
                            { label: 'GST/HST collected', current: summary.collected, read: (i: number) => gstComparisons[i]?.snapshot.gstHstCollected ?? 0 },
                            { label: 'Input tax credits', current: summary.paid, read: (i: number) => gstComparisons[i]?.snapshot.itc ?? 0 },
                            { label: 'Net tax', current: summary.netPayable, read: (i: number) => gstComparisons[i]?.snapshot.netTax ?? 0, net: true },
                          ]
                        : [
                            { label: taxTerminology.collectedLabel, current: summary.collected, read: (i: number) => movementComparisons[i]?.summary.taxCollected ?? 0 },
                            { label: taxTerminology.paidLabel, current: summary.paid, read: (i: number) => movementComparisons[i]?.summary.itcClaimed ?? 0 },
                            { label: taxTerminology.netLabel, current: summary.netPayable, read: (i: number) => movementComparisons[i]?.summary.netPayable ?? 0, net: true },
                          ]
                      ).map((row) => {
                        const compareValue = row.read(0);
                        const change = row.current - compareValue;
                        const ranges = useGstEngine ? gstComparisons : movementComparisons;
                        return (
                          <TableRow key={row.label} className={row.net ? 'bg-muted/50 font-medium' : undefined}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(row.current)}</TableCell>
                            {ranges.map((range, index) => (
                              <TableCell key={`${row.label}-${range.label}`} className="text-right font-mono">
                                {range.isLoading ? '…' : formatCurrency(row.read(index))}
                              </TableCell>
                            ))}
                            <TableCell className={cn(
                              'text-right font-mono',
                              change > 0 ? 'text-amber-700' : change < 0 ? 'text-emerald-700' : undefined,
                            )}>
                              {ranges[0]?.isLoading ? '…' : `${change > 0 ? '+' : ''}${formatCurrency(change)}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Change is current period vs {(useGstEngine ? gstComparisons : movementComparisons)[0]?.label || 'the previous period'}.
                  Each comparison column uses that period's invoices, bills, expenses, posted banking, and GST/HST journal activity.
                </p>
              </div>
            )}

            {/* Report Content Based on Type */}
            <>
                {(reportType === 'summary' || reportType === 'detailed') && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {filingForm.formName}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {useGstEngine
                      ? 'CRA GST34 working copy for the selected period. Line 90 is taxable sales including zero-rated supplies; line 91 is exempt/other revenue; line 103 is GST/HST collected; line 106 is ITCs.'
                      : isCanada
                      ? 'Structured like a CRA GST/HST return (Zoho GST summary). Amounts are activity in the selected period, excluding remittances.'
                      : 'Return-style summary for the selected period. Amounts exclude tax-authority settlements.'}
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Line</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-32">Formula</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filingForm.lines.map((line) => (
                          <TableRow key={line.code} className={line.category === 'net' ? 'bg-muted/50 font-medium' : undefined}>
                            <TableCell className="font-mono text-xs">{line.code}</TableCell>
                            <TableCell>{line.label}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {line.formula ?? '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(line.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                )}

                {useGstEngine && (
                  <GstHstSupportReport
                    periods={[
                      { id: 'current', label: 'Current period', snapshot: gstSnapshot },
                      ...gstComparisons.map((range) => ({
                        id: range.label,
                        label: range.label,
                        snapshot: range.snapshot,
                        isLoading: range.isLoading,
                      })),
                    ]}
                    formatCurrency={formatCurrency}
                  />
                )}

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {isBurundi ? 'Par code de taxe' : 'Tax liability by tax code'}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    QuickBooks-style liability: taxable sales, tax collected, credits, and tax due for {periodLabel}.
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isBurundi ? 'Code TVA' : 'Tax code'}</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Taxable sales</TableHead>
                          <TableHead className="text-right">{taxTerminology.collectedLabel}</TableHead>
                          <TableHead className="text-right">{taxTerminology.paidLabel}</TableHead>
                          <TableHead className="text-right">{taxTerminology.netLabel}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedByTaxCode.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-sm text-muted-foreground text-center py-6">
                              No tax activity in this period.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {groupedByTaxCode.map((group) => (
                              <TableRow key={group.code}>
                                <TableCell className="font-medium">
                                  {group.code}
                                  {group.name && group.name !== group.code && (
                                    <span className="block text-xs text-muted-foreground font-normal">{group.name}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {group.rate ? `${group.rate}%` : '—'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(group.taxableAmount)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-green-600">
                                  {formatCurrency(group.collected)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-blue-600">
                                  {formatCurrency(group.paid)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {formatCurrency(group.net)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={2}>{isBurundi ? 'Total' : 'Total'}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(groupedByTaxCode.reduce((s, g) => s + g.taxableAmount, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(groupedByTaxCode.reduce((s, g) => s + g.collected, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(groupedByTaxCode.reduce((s, g) => s + g.paid, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(groupedByTaxCode.reduce((s, g) => s + g.net, 0))}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {(reportType === 'summary' || reportType === 'detailed') && periodSummary.byAccount.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-foreground mb-1">
                      {isBurundi ? 'Activité des comptes' : 'Account activity this period'}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Credits minus debits on tax GLs during {periodLabel}. This is not the lifetime account balance.
                    </p>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{isBurundi ? 'Compte' : 'Account'}</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Period activity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {periodSummary.byAccount.map((acc) => (
                            <TableRow key={`${acc.accountCode}-${acc.accountName}`}>
                              <TableCell className="font-medium">{acc.accountName}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{acc.accountCode}</TableCell>
                              <TableCell>
                                <Badge variant={acc.side === 'collected' ? 'default' : 'secondary'}>
                                  {acc.side === 'collected' ? (isBurundi ? 'Collectée' : 'Collected') : (isBurundi ? 'Payée' : 'Paid/ITC')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(acc.periodAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {reportType !== 'summary' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {isBurundi ? 'Détail des transactions' : 'Sales tax detail'}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    QuickBooks-style tax liability detail grouped by tax code for {periodLabel}. Changing Date Range, From, or To reloads these amounts.
                  </p>
                  <div className="border rounded-lg overflow-hidden max-h-[32rem] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Tax code</TableHead>
                          <TableHead className="text-right">Taxable</TableHead>
                          <TableHead className="text-right">Tax amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-sm text-muted-foreground text-center py-6">
                              No tax postings in this date range.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {detailGroups.map((group) => (
                              <Fragment key={group.taxCode}>
                                <TableRow className="bg-muted/40">
                                  <TableCell colSpan={6} className="font-medium">
                                    {group.taxCode}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                      ({group.rows.length} {group.rows.length === 1 ? 'transaction' : 'transactions'})
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(group.taxableAmount)}</TableCell>
                                  <TableCell className="text-right font-mono text-sm">{formatCurrency(group.taxAmount)}</TableCell>
                                </TableRow>
                                {group.rows.map((row, idx) => (
                                  <TableRow key={`${group.taxCode}-${row.date}-${row.number}-${idx}`}>
                                    <TableCell className="text-sm whitespace-nowrap">
                                      {row.date ? format(parseLocalDate(row.date), 'MMM d, yyyy') : '—'}
                                    </TableCell>
                                    <TableCell className="text-sm">{row.type}</TableCell>
                                    <TableCell className="font-mono text-xs">{row.number || '—'}</TableCell>
                                    <TableCell className="text-sm max-w-[220px] truncate">{row.description}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {row.accountCode} {row.accountName}
                                    </TableCell>
                                    <TableCell>
                                      {row.taxCode ? <Badge variant="outline">{row.taxCode}</Badge> : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {row.taxableAmount ? formatCurrency(row.taxableAmount) : '—'}
                                    </TableCell>
                                    <TableCell className={cn(
                                      'text-right font-mono text-sm',
                                      row.side === 'collected' ? 'text-green-700' : 'text-blue-700',
                                    )}>
                                      {formatCurrency(row.taxAmount)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </Fragment>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={6}>Total ({detailRows.length} transactions)</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(detailRows.reduce((s, r) => s + r.taxableAmount, 0))}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(detailRows.reduce((s, r) => s + r.taxAmount, 0))}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                )}
            </>

            <Separator className="my-4" />

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="w-4 h-4 mr-2" />
                {countryCode === 'BI' ? 'Prévisualiser' : 'Preview Report'}
              </Button>
              <Button onClick={() => generatePdf(true)} disabled={isGenerating}>
                <Download className="w-4 h-4 mr-2" />
                {isGenerating 
                  ? (countryCode === 'BI' ? 'Génération...' : 'Generating...') 
                  : (countryCode === 'BI' ? 'Télécharger PDF' : 'Download PDF')}
              </Button>
              <Button variant="ghost" onClick={() => generatePdf(false)} disabled={isGenerating}>
                <Printer className="w-4 h-4 mr-2" />
                {countryCode === 'BI' ? 'Imprimer' : 'Print'}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Compare With Dialog */}
      <Dialog
        open={showCompareDialog}
        onOpenChange={(open) => {
          setShowCompareDialog(open);
          if (open) {
            setDraftCompareType(compareType);
            setDraftCompareCount(String(comparePeriodsCount));
            setDraftArrangeLatest(compareArrangeLatest);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compare With</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Compare current period with previous periods or years
            </p>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="compare-type">Compare Based on Period/Year</Label>
              <Select
                value={draftCompareType}
                onValueChange={(v) => {
                  const next = v as TaxCompareType;
                  setDraftCompareType(next);
                  if (next === 'none') {
                    setDraftCompareCount('1');
                    setDraftArrangeLatest(true);
                  } else if (draftCompareType === 'none') {
                    setDraftCompareCount('1');
                  }
                }}
              >
                <SelectTrigger id="compare-type">
                  <SelectValue placeholder="Select comparison type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Comparison</SelectItem>
                  <SelectItem value="previous_period">Previous Period(s)</SelectItem>
                  <SelectItem value="previous_year">Previous Year(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draftCompareType !== 'none' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="compare-count">
                    Number of {draftCompareType === 'previous_period' ? 'Period(s)' : 'Year(s)'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="Decrease period count"
                      disabled={commitComparePeriodCount(draftCompareCount) <= 1}
                      onClick={() => setDraftCompareCount(String(stepComparePeriodCount(draftCompareCount, -1)))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="compare-count"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-9 text-center"
                      value={draftCompareCount}
                      onChange={(e) => setDraftCompareCount(sanitizeComparePeriodCountInput(e.target.value))}
                      onBlur={() => setDraftCompareCount(String(commitComparePeriodCount(draftCompareCount)))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setDraftCompareCount(String(stepComparePeriodCount(draftCompareCount, 1)));
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setDraftCompareCount(String(stepComparePeriodCount(draftCompareCount, -1)));
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label="Increase period count"
                      disabled={commitComparePeriodCount(draftCompareCount) >= MAX_COMPARE_PERIODS}
                      onClick={() => setDraftCompareCount(String(stepComparePeriodCount(draftCompareCount, 1)))}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter 1–{MAX_COMPARE_PERIODS}. Use + / − or type the number.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="arrange-latest"
                    checked={draftArrangeLatest}
                    onCheckedChange={(checked) => setDraftArrangeLatest(!!checked)}
                  />
                  <label htmlFor="arrange-latest" className="text-sm cursor-pointer">
                    Arrange period/year from latest to oldest
                  </label>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Cancel
            </Button>
            <Button onClick={applyComparison}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {getReportCategoryTitle()} Preview
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Header */}
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-bold">{getReportCategoryTitle()}</h2>
              <p className="text-muted-foreground">{organizationName}</p>
              <p className="text-sm text-muted-foreground">{periodLabel}</p>
            </div>

            {/* Summary */}
            <div>
              <h3 className="font-semibold mb-3">{filingForm.formName}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Line</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filingForm.lines.map((line) => (
                    <TableRow key={line.code}>
                      <TableCell className="font-mono text-xs">{line.code}</TableCell>
                      <TableCell>{line.label}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Account Details */}
            <div>
              <h3 className="font-semibold mb-3">Account activity this period</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Period activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodSummary.byAccount.map((acc) => (
                    <TableRow key={`${acc.accountCode}-${acc.accountName}`}>
                      <TableCell>{acc.accountName}</TableCell>
                      <TableCell className="font-mono">{acc.accountCode}</TableCell>
                      <TableCell>{acc.side === 'collected' ? 'Collected' : 'Paid/ITC'}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(acc.periodAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Recent Transactions */}
            {filteredJournalDetails.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Recent Transactions ({filteredJournalDetails.length})</h3>
                <div className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJournalDetails.slice(0, 20).map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{format(parseLocalDate(line.entry_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-sm">{line.description}</TableCell>
                          <TableCell className="text-sm font-mono">{line.account_code}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowPreview(false); generatePdf(true); }}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
