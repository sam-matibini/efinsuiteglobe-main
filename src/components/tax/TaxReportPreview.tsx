import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Download, Eye, FileText, Printer, Calendar, ArrowRight, Filter, SlidersHorizontal, GitCompare, Check, ChevronDown } from 'lucide-react';
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
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { addPdfBrandingFooter } from '@/lib/pdfBrandingFooter';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

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

interface TaxAccountDetail {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  type: 'collected' | 'paid' | 'pst';
  taxCodeId?: string;
  taxCodeName?: string;
  jurisdiction?: string;
}

interface JournalEntryLine {
  entry_date: string;
  description: string;
  line_description?: string;
  reference: string;
  debit: number;
  credit: number;
  account_code: string;
  account_name: string;
  tax_code?: string;
  vendor_customer?: string;
}

type PeriodType = 'current_month' | 'last_month' | 'current_quarter' | 'last_quarter' | 'current_year' | 'last_year' | 'custom';
type ReportType = 'summary' | 'detailed' | 'by_tax_code' | 'by_jurisdiction';
type AccountTypeFilter = 'all' | 'collected' | 'paid' | 'pst';
type CompareType = 'none' | 'previous_period' | 'previous_year';
type ReportCategory = 'gst' | 'pst';

export function TaxReportPreview({
  organizationId,
  organizationName,
  countryCode,
  taxTerminology,
  formatCurrency,
}: TaxReportPreviewProps) {
  const [reportCategory, setReportCategory] = useState<ReportCategory>('gst');
  const [periodType, setPeriodType] = useState<PeriodType>('current_quarter');
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Compare With states
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareType, setCompareType] = useState<CompareType>('none');
  const [comparePeriodsCount, setComparePeriodsCount] = useState(1);
  const [compareArrangeLatest, setCompareArrangeLatest] = useState(true);
  
  // Advanced filter states
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>('all');
  const [selectedTaxCodes, setSelectedTaxCodes] = useState<string[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  const isBurundi = countryCode === 'BI';
  const isCanada = countryCode === 'CA';

  // Calculate date range based on period type
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodType === 'custom' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    switch (periodType) {
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case 'current_quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'last_quarter':
        return { start: startOfQuarter(subQuarters(now, 1)), end: endOfQuarter(subQuarters(now, 1)) };
      case 'current_year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'last_year':
        return { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) };
      default:
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
    }
  }, [periodType, customStartDate, customEndDate]);

  // Calculate comparison date ranges
  const comparisonRanges = useMemo(() => {
    if (compareType === 'none') return [];
    
    const ranges: { start: Date; end: Date; label: string }[] = [];
    
    for (let i = 1; i <= comparePeriodsCount; i++) {
      let start: Date, end: Date, label: string;
      
      if (compareType === 'previous_period') {
        // Calculate based on current period type
        switch (periodType) {
          case 'current_month':
          case 'last_month':
            start = startOfMonth(subMonths(dateRange.start, i));
            end = endOfMonth(subMonths(dateRange.start, i));
            label = format(start, 'MMM yyyy');
            break;
          case 'current_quarter':
          case 'last_quarter':
            start = startOfQuarter(subQuarters(dateRange.start, i));
            end = endOfQuarter(subQuarters(dateRange.start, i));
            label = `Q${Math.ceil((start.getMonth() + 1) / 3)} ${start.getFullYear()}`;
            break;
          default:
            start = startOfYear(subYears(dateRange.start, i));
            end = endOfYear(subYears(dateRange.start, i));
            label = start.getFullYear().toString();
        }
      } else {
        // Previous year comparison
        start = subYears(dateRange.start, i);
        end = subYears(dateRange.end, i);
        label = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
      }
      
      ranges.push({ start, end, label });
    }
    
    return compareArrangeLatest ? ranges : ranges.reverse();
  }, [compareType, comparePeriodsCount, compareArrangeLatest, periodType, dateRange]);

  const periodLabel = useMemo(() => {
    return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
  }, [dateRange]);

  // Fetch tax codes for filter
  const { data: taxCodes = [] } = useQuery({
    queryKey: ['tax-codes-filter', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('tax_codes')
        .select('id, code, name, jurisdiction')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch tax account balances
  const { data: taxAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['tax-report-accounts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name, current_balance')
        .eq('organization_id', organizationId)
        .or('name.ilike.%gst%,name.ilike.%hst%,name.ilike.%pst%,name.ilike.%vat%,name.ilike.%tax collected%,name.ilike.%tax paid%,name.ilike.%input tax%,name.ilike.%qst%,name.ilike.%tva%');
      
      if (error) throw error;
      
      return (data || []).map(acc => {
        let type: 'collected' | 'paid' | 'pst' = 'collected';
        const nameLower = acc.name.toLowerCase();
        
        // ITC/Input/Paid accounts = tax paid (deductible)
        if (nameLower.includes('input') || nameLower.includes('itc') || 
            (nameLower.includes('paid') && !nameLower.includes('payable'))) {
          type = 'paid';
        } 
        // PST/QST payable accounts = provincial tax
        else if ((nameLower.includes('pst') || nameLower.includes('qst')) && 
                 (nameLower.includes('payable') || nameLower.includes('collected'))) {
          type = 'pst';
        }
        // GST/HST Payable or Collected = tax collected (liability)
        // Default is 'collected' for GST/HST/VAT payable accounts
        
        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          balance: Math.abs(Number(acc.current_balance || 0)),
          type,
        } as TaxAccountDetail;
      });
    },
    enabled: !!organizationId,
  });

  // Filter accounts by report category
  const categoryFilteredAccounts = useMemo(() => {
    if (!isCanada) return taxAccounts;
    
    return taxAccounts.filter(acc => {
      const nameLower = acc.accountName.toLowerCase();
      if (reportCategory === 'gst') {
        return (nameLower.includes('gst') || nameLower.includes('hst')) && 
               !nameLower.includes('pst') && !nameLower.includes('qst');
      } else {
        return nameLower.includes('pst') || nameLower.includes('qst');
      }
    });
  }, [taxAccounts, reportCategory, isCanada]);

  // Fetch journal entry details for the period with enhanced data
  const { data: journalDetails = [], isLoading: journalLoading } = useQuery({
    queryKey: ['tax-report-journal', organizationId, dateRange.start, dateRange.end, taxAccounts.length],
    queryFn: async () => {
      if (!organizationId || taxAccounts.length === 0) return [];
      
      const accountIds = taxAccounts.map(a => a.accountId);
      const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.end, 'yyyy-MM-dd');
      
      // Fetch journal entries first to get IDs within date range
      const { data: journalEntries, error: jeError } = await supabase
        .from('journal_entries')
        .select('id, entry_date, description, reference')
        .eq('organization_id', organizationId)
        .gte('entry_date', startDateStr)
        .lte('entry_date', endDateStr);
      
      if (jeError) throw jeError;
      if (!journalEntries || journalEntries.length === 0) return [];
      
      const journalEntryIds = journalEntries.map(je => je.id);
      const journalEntriesMap = new Map(journalEntries.map(je => [je.id, je]));
      
      // Fetch journal entry lines for tax accounts
      const { data: lines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          journal_entry_id,
          account_id,
          debit,
          credit,
          description
        `)
        .in('journal_entry_id', journalEntryIds)
        .in('account_id', accountIds);
      
      if (linesError) throw linesError;
      
      // Fetch accounts for display
      const { data: accounts, error: accError } = await supabase
        .from('accounts')
        .select('id, code, name')
        .in('id', accountIds);
      
      if (accError) throw accError;
      
      const accountsMap = new Map(accounts?.map(a => [a.id, a]) || []);
      
      return (lines || []).map((line: any) => {
        const je = journalEntriesMap.get(line.journal_entry_id);
        const acc = accountsMap.get(line.account_id);
        
        // Extract tax code from line description (e.g., "GST - Federal on ...")
        const taxCodeMatch = line.description?.match(/^(GST|HST|PST|QST|VAT)(\s*-\s*\w+)?/i);
        const taxCode = taxCodeMatch ? taxCodeMatch[0].trim() : undefined;
        
        return {
          entry_date: je?.entry_date,
          description: je?.description || line.description,
          line_description: line.description,
          reference: je?.reference,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
          account_code: acc?.code,
          account_name: acc?.name,
          tax_code: taxCode,
        };
      }) as JournalEntryLine[];
    },
    enabled: !!organizationId && taxAccounts.length > 0,
  });

  // Filter journal details by category
  const categoryFilteredJournalDetails = useMemo(() => {
    if (!isCanada) return journalDetails;
    
    return journalDetails.filter((line: any) => {
      const nameLower = line.account_name?.toLowerCase() || '';
      const codeLower = line.tax_code?.toLowerCase() || '';
      
      if (reportCategory === 'gst') {
        return (nameLower.includes('gst') || nameLower.includes('hst') || 
                codeLower.includes('gst') || codeLower.includes('hst')) &&
               !nameLower.includes('pst') && !codeLower.includes('pst') &&
               !nameLower.includes('qst') && !codeLower.includes('qst');
      } else {
        return nameLower.includes('pst') || nameLower.includes('qst') ||
               codeLower.includes('pst') || codeLower.includes('qst');
      }
    });
  }, [journalDetails, reportCategory, isCanada]);

  // Derive available tax codes from journal details when tax_codes table is empty
  const derivedTaxCodes = useMemo(() => {
    if (taxCodes.length > 0) return [];
    
    const codes = new Set<string>();
    journalDetails.forEach((line: any) => {
      if (line.tax_code) {
        codes.add(line.tax_code);
      }
    });
    
    return Array.from(codes).map(code => ({
      id: code,
      code: code,
      name: code,
      jurisdiction: null
    }));
  }, [journalDetails, taxCodes]);

  // Combined tax codes (from table or derived)
  const allTaxCodes = taxCodes.length > 0 ? taxCodes : derivedTaxCodes;

  // Filter tax codes by category
  const filteredTaxCodesByCategory = useMemo(() => {
    if (!isCanada) return allTaxCodes;
    
    return allTaxCodes.filter(tc => {
      const codeLower = tc.code.toLowerCase();
      if (reportCategory === 'gst') {
        return codeLower.includes('gst') || codeLower.includes('hst') || 
               (!codeLower.includes('pst') && !codeLower.includes('qst'));
      } else {
        return codeLower.includes('pst') || codeLower.includes('qst');
      }
    });
  }, [allTaxCodes, reportCategory, isCanada]);

  // Filter accounts based on selected filters
  const filteredAccounts = useMemo(() => {
    let accounts = [...categoryFilteredAccounts];
    if (accountTypeFilter !== 'all') {
      accounts = accounts.filter(a => a.type === accountTypeFilter);
    }
    return accounts;
  }, [categoryFilteredAccounts, accountTypeFilter]);

  // Filter journal entries based on selected tax codes
  const filteredJournalDetails = useMemo(() => {
    let details = categoryFilteredJournalDetails;
    if (selectedTaxCodes.length > 0) {
      details = details.filter((j: any) => j.tax_code && selectedTaxCodes.includes(j.tax_code));
    }
    // Apply account type filter
    if (accountTypeFilter === 'collected') {
      details = details.filter((j: any) => j.account_name?.toLowerCase().includes('collected'));
    } else if (accountTypeFilter === 'paid') {
      details = details.filter((j: any) => 
        j.account_name?.toLowerCase().includes('paid') || 
        j.account_name?.toLowerCase().includes('input')
      );
    }
    return details;
  }, [categoryFilteredJournalDetails, selectedTaxCodes, accountTypeFilter]);

  // Calculate summary with filters applied
  const summary = useMemo(() => {
    const collected = filteredAccounts
      .filter(a => a.type === 'collected')
      .reduce((sum, a) => sum + a.balance, 0);
    
    const paid = filteredAccounts
      .filter(a => a.type === 'paid')
      .reduce((sum, a) => sum + a.balance, 0);
    
    const pst = filteredAccounts
      .filter(a => a.type === 'pst')
      .reduce((sum, a) => sum + a.balance, 0);
    
    const netPayable = collected - paid + pst;
    
    // Calculate period totals from filtered journal entries
    const periodCollected = filteredJournalDetails
      .filter(j => j.account_name.toLowerCase().includes('collected'))
      .reduce((sum, j) => sum + j.credit - j.debit, 0);
    
    const periodPaid = filteredJournalDetails
      .filter(j => j.account_name.toLowerCase().includes('paid') || j.account_name.toLowerCase().includes('input'))
      .reduce((sum, j) => sum + j.debit - j.credit, 0);
    
    return {
      collected,
      paid,
      pst,
      netPayable,
      periodCollected: Math.abs(periodCollected),
      periodPaid: Math.abs(periodPaid),
      periodNet: Math.abs(periodCollected) - Math.abs(periodPaid),
    };
  }, [filteredAccounts, filteredJournalDetails]);

  // Group by tax code for detailed report
  const groupedByTaxCode = useMemo(() => {
    const groups: Record<string, { code: string; name: string; collected: number; paid: number; net: number }> = {};
    
    filteredJournalDetails.forEach((line: any) => {
      const code = line.tax_code || 'Unclassified';
      if (!groups[code]) {
        groups[code] = { code, name: code, collected: 0, paid: 0, net: 0 };
      }
      if (line.account_name.toLowerCase().includes('collected')) {
        groups[code].collected += line.credit - line.debit;
      } else {
        groups[code].paid += line.debit - line.credit;
      }
      groups[code].net = groups[code].collected - groups[code].paid;
    });
    
    return Object.values(groups);
  }, [filteredJournalDetails]);

  const hasActiveFilters = selectedTaxCodes.length > 0 || accountTypeFilter !== 'all' || reportType !== 'summary';

  const clearFilters = () => {
    setSelectedTaxCodes([]);
    setAccountTypeFilter('all');
    setReportType('summary');
  };

  const applyComparison = () => {
    setShowCompareDialog(false);
    toast.success(compareType === 'none' 
      ? 'Comparison removed' 
      : `Comparing with ${comparePeriodsCount} ${compareType === 'previous_period' ? 'period(s)' : 'year(s)'}`
    );
  };

  const getReportCategoryTitle = () => {
    if (!isCanada) return taxTerminology.title;
    return reportCategory === 'gst' ? 'CRA GST/HST Report' : 'Provincial Sales Tax (PST) Report';
  };

  const getReportCategoryDescription = () => {
    if (!isCanada) return 'Tax reporting and analysis';
    return reportCategory === 'gst' 
      ? 'Federal GST/HST collected and ITCs for CRA filing'
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
      doc.text('Balance', pageWidth - 20, y, { align: 'right' });
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      filteredAccounts.forEach((acc, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        if (idx % 2 === 1) {
          doc.setFillColor(248, 248, 248);
          doc.rect(15, y - 4, pageWidth - 30, 6, 'F');
        }
        
        const typeLabel = acc.type === 'collected' ? 'Collected' : acc.type === 'paid' ? 'Paid/ITC' : 'PST/QST';
        doc.text(acc.accountName.substring(0, 30), 20, y);
        doc.text(acc.accountCode, 80, y);
        doc.text(typeLabel, 110, y);
        doc.text(formatCurrency(acc.balance), pageWidth - 20, y, { align: 'right' });
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

  const isLoading = accountsLoading || journalLoading;

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
              {hasActiveFilters && <Badge variant="secondary" className="ml-2">{selectedTaxCodes.length + (accountTypeFilter !== 'all' ? 1 : 0) + (reportType !== 'summary' ? 1 : 0)}</Badge>}
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

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border mb-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">{isBurundi ? 'Période:' : 'Period:'}</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger className="w-[160px] h-9">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">{isBurundi ? 'Mois Courant' : 'Current Month'}</SelectItem>
                <SelectItem value="last_month">{isBurundi ? 'Mois Dernier' : 'Last Month'}</SelectItem>
                <SelectItem value="current_quarter">{isBurundi ? 'Trimestre Courant' : 'Current Quarter'}</SelectItem>
                <SelectItem value="last_quarter">{isBurundi ? 'Trimestre Dernier' : 'Last Quarter'}</SelectItem>
                <SelectItem value="current_year">{isBurundi ? 'Année Courante' : 'Current Year'}</SelectItem>
                <SelectItem value="last_year">{isBurundi ? 'Année Dernière' : 'Last Year'}</SelectItem>
                <SelectItem value="custom">{isBurundi ? 'Personnalisé' : 'Custom Range'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {periodType === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Calendar className="w-4 h-4 mr-2" />
                    {customStartDate ? format(customStartDate, 'MMM d, yyyy') : (isBurundi ? 'Début' : 'Start')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Calendar className="w-4 h-4 mr-2" />
                    {customEndDate ? format(customEndDate, 'MMM d, yyyy') : (isBurundi ? 'Fin' : 'End')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </>
          )}

          <Badge variant="outline" className="h-9 px-3 flex items-center">
            {periodLabel}
          </Badge>

          {compareType !== 'none' && (
            <Badge variant="secondary" className="h-9 px-3 flex items-center gap-1">
              <GitCompare className="w-3 h-3" />
              vs {comparePeriodsCount} {compareType === 'previous_period' ? 'period(s)' : 'year(s)'}
            </Badge>
          )}
        </div>

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
                                checked={selectedTaxCodes.includes(tc.id)}
                                onCheckedChange={() => {
                                  if (selectedTaxCodes.includes(tc.id)) {
                                    setSelectedTaxCodes(selectedTaxCodes.filter(c => c !== tc.id));
                                  } else {
                                    setSelectedTaxCodes([...selectedTaxCodes, tc.id]);
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
            {/* Quick Summary Cards */}
            <div className={cn(
              "grid gap-4 mb-6",
              reportCategory === 'pst' ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-5"
            )}>
              {(reportCategory === 'gst' || !isCanada) && (
                <>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{taxTerminology.collectedLabel}</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(summary.collected)}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{taxTerminology.paidLabel}</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(summary.paid)}
                    </p>
                  </div>
                </>
              )}
              {reportCategory === 'pst' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">PST/QST Payable</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(summary.pst)}
                  </p>
                </div>
              )}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{taxTerminology.netLabel}</p>
                <p className={`text-xl font-bold ${summary.netPayable >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {formatCurrency(Math.abs(summary.netPayable))}
                </p>
              </div>
              {/* Refund/Owing indicator */}
              <div className={cn(
                "p-4 rounded-lg",
                summary.netPayable < 0 
                  ? "bg-emerald-50 dark:bg-emerald-950/30" 
                  : "bg-red-50 dark:bg-red-950/30"
              )}>
                <p className="text-xs text-muted-foreground mb-1">
                  {isBurundi ? 'Remboursement / Dû' : 'Refund / Owing'}
                </p>
                <p className={cn(
                  "text-xl font-bold",
                  summary.netPayable < 0 
                    ? "text-emerald-700 dark:text-emerald-400" 
                    : "text-red-700 dark:text-red-400"
                )}>
                  {summary.netPayable < 0 ? (
                    <>
                      {formatCurrency(Math.abs(summary.netPayable))}
                      <span className="text-xs font-normal ml-1">
                        {isBurundi ? '(remboursement)' : '(refund)'}
                      </span>
                    </>
                  ) : (
                    <>
                      {formatCurrency(summary.netPayable)}
                      <span className="text-xs font-normal ml-1">
                        {isBurundi ? '(dû)' : '(owing)'}
                      </span>
                    </>
                  )}
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
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Current Period</TableHead>
                        {comparisonRanges.map((range, idx) => (
                          <TableHead key={idx} className="text-right">{range.label}</TableHead>
                        ))}
                        <TableHead className="text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">{taxTerminology.collectedLabel}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(summary.collected)}</TableCell>
                        {comparisonRanges.map((_, idx) => (
                          <TableCell key={idx} className="text-right font-mono text-muted-foreground">-</TableCell>
                        ))}
                        <TableCell className="text-right font-mono">-</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">{taxTerminology.paidLabel}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(summary.paid)}</TableCell>
                        {comparisonRanges.map((_, idx) => (
                          <TableCell key={idx} className="text-right font-mono text-muted-foreground">-</TableCell>
                        ))}
                        <TableCell className="text-right font-mono">-</TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>{taxTerminology.netLabel}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(summary.netPayable)}</TableCell>
                        {comparisonRanges.map((_, idx) => (
                          <TableCell key={idx} className="text-right font-mono text-muted-foreground">-</TableCell>
                        ))}
                        <TableCell className="text-right font-mono">-</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: Historical comparison data will be populated from journal entries for each period.
                </p>
              </div>
            )}

            {/* Report Content Based on Type */}
            {reportType === 'by_tax_code' && groupedByTaxCode.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-foreground mb-3">
                  {isBurundi ? 'Résumé par Code TVA' : 'Summary by Tax Code'}
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isBurundi ? 'Code TVA' : 'Tax Code'}</TableHead>
                        <TableHead className="text-right">{taxTerminology.collectedLabel}</TableHead>
                        <TableHead className="text-right">{taxTerminology.paidLabel}</TableHead>
                        <TableHead className="text-right">{taxTerminology.netLabel}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByTaxCode.map((group) => (
                        <TableRow key={group.code}>
                          <TableCell className="font-medium">{group.code}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(Math.abs(group.collected))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600">
                            {formatCurrency(Math.abs(group.paid))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(group.net)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>{isBurundi ? 'Total' : 'Total'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(groupedByTaxCode.reduce((s, g) => s + Math.abs(g.collected), 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(groupedByTaxCode.reduce((s, g) => s + Math.abs(g.paid), 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(groupedByTaxCode.reduce((s, g) => s + g.net, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : reportType === 'detailed' && filteredJournalDetails.length > 0 ? (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-foreground mb-3">
                  {isBurundi ? 'Transactions Détaillées' : 'Detailed Transactions'} ({filteredJournalDetails.length})
                </h4>
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isBurundi ? 'Date' : 'Date'}</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>{isBurundi ? 'Code TVA' : 'Tax Code'}</TableHead>
                        <TableHead>{isBurundi ? 'Compte' : 'Account'}</TableHead>
                        <TableHead className="text-right">{isBurundi ? 'Débit' : 'Debit'}</TableHead>
                        <TableHead className="text-right">{isBurundi ? 'Crédit' : 'Credit'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJournalDetails.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">
                            {format(parseLocalDate(line.entry_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {line.description}
                          </TableCell>
                          <TableCell>
                            {line.tax_code ? (
                              <Badge variant="outline">{line.tax_code}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{line.account_code}</TableCell>
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
            ) : (
              /* Account Breakdown (Default Summary View) */
              filteredAccounts.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    {isBurundi ? 'Détail des Comptes' : 'Account Breakdown'}
                    {accountTypeFilter !== 'all' && (
                      <Badge variant="secondary" className="ml-2">
                        {accountTypeFilter === 'collected' ? (isBurundi ? 'Collectée' : 'Collected Only') : 
                         accountTypeFilter === 'paid' ? (isBurundi ? 'Payée' : 'Paid/ITC Only') : 'PST/QST Only'}
                      </Badge>
                    )}
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isBurundi ? 'Compte' : 'Account'}</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">{isBurundi ? 'Solde' : 'Balance'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAccounts.map((acc) => (
                          <TableRow key={acc.accountId}>
                            <TableCell className="font-medium">{acc.accountName}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{acc.accountCode}</TableCell>
                            <TableCell>
                              <Badge variant={acc.type === 'collected' ? 'default' : acc.type === 'paid' ? 'secondary' : 'outline'}>
                                {acc.type === 'collected' ? (isBurundi ? 'Collectée' : 'Collected') : 
                                 acc.type === 'paid' ? (isBurundi ? 'Payée' : 'Paid/ITC') : 'PST/QST'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(acc.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            )}

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
          // When comparison is currently off, reset count so it doesn't "stick" to a previous value (e.g. 5)
          if (open && compareType === 'none') {
            setComparePeriodsCount(1);
            setCompareArrangeLatest(true);
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
              <Label>Compare Based on Period/Year</Label>
              <Select
                value={compareType}
                onValueChange={(v) => {
                  const next = v as CompareType;
                  setCompareType(next);

                  // If user turns comparison off, or turns it on from "none",
                  // default to 1 (not the previous value).
                  if (next === 'none') {
                    setComparePeriodsCount(1);
                    setCompareArrangeLatest(true);
                  } else if (compareType === 'none') {
                    setComparePeriodsCount(1);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select comparison type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Comparison</SelectItem>
                  <SelectItem value="previous_period">Previous Period(s)</SelectItem>
                  <SelectItem value="previous_year">Previous Year(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {compareType !== 'none' && (
              <>
                <div className="space-y-2">
                  <Label>
                    Number of {compareType === 'previous_period' ? 'Period(s)' : 'Year(s)'}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={comparePeriodsCount}
                    onChange={(e) => setComparePeriodsCount(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="arrange-latest"
                    checked={compareArrangeLatest}
                    onCheckedChange={(checked) => setCompareArrangeLatest(!!checked)}
                  />
                  <label htmlFor="arrange-latest" className="text-sm cursor-pointer flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
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
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-2">
                {(reportCategory === 'gst' || !isCanada) && (
                  <>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>{taxTerminology.collectedLabel}</span>
                      <span className="font-mono font-medium">{formatCurrency(summary.collected)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>{taxTerminology.paidLabel}</span>
                      <span className="font-mono font-medium">{formatCurrency(summary.paid)}</span>
                    </div>
                  </>
                )}
                {reportCategory === 'pst' && (
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>PST/QST Payable</span>
                    <span className="font-mono font-medium">{formatCurrency(summary.pst)}</span>
                  </div>
                )}
                <div className="flex justify-between p-2 bg-primary/10 rounded col-span-2">
                  <span className="font-semibold">{taxTerminology.netLabel}</span>
                  <span className="font-mono font-bold">{formatCurrency(summary.netPayable)}</span>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <h3 className="font-semibold mb-3">Account Details</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((acc) => (
                    <TableRow key={acc.accountId}>
                      <TableCell>{acc.accountName}</TableCell>
                      <TableCell className="font-mono">{acc.accountCode}</TableCell>
                      <TableCell>{acc.type === 'collected' ? 'Collected' : acc.type === 'paid' ? 'Paid/ITC' : 'PST/QST'}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(acc.balance)}</TableCell>
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
