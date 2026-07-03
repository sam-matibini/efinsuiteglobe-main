import React, { useState, useMemo } from 'react';
import { 
  Download, Search, Filter, ChevronDown, ChevronRight, FileSpreadsheet, 
  FileText, Printer, RefreshCw, Eye, Building2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { useDetailedLedger, useLedgerDimensions, DetailedLedgerFilters, LedgerEntry } from '@/hooks/useDetailedLedger';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Date presets
const getDatePreset = (preset: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  switch (preset) {
    case 'this-month':
      return { from: formatLocalDate(new Date(year, month, 1)), to: formatLocalDate(new Date(year, month + 1, 0)) };
    case 'last-month':
      return { from: formatLocalDate(new Date(year, month - 1, 1)), to: formatLocalDate(new Date(year, month, 0)) };
    case 'this-quarter':
      const q = Math.floor(month / 3);
      return { from: formatLocalDate(new Date(year, q * 3, 1)), to: formatLocalDate(new Date(year, q * 3 + 3, 0)) };
    case 'this-year':
      return { from: formatLocalDate(new Date(year, 0, 1)), to: formatLocalDate(new Date(year, 11, 31)) };
    case 'last-year':
      return { from: formatLocalDate(new Date(year - 1, 0, 1)), to: formatLocalDate(new Date(year - 1, 11, 31)) };
    default:
      return { from: formatLocalDate(new Date(year, month, 1)), to: formatLocalDate(new Date(year, month + 1, 0)) };
  }
};

const sourceModuleLabels: Record<string, string> = {
  manual: 'Manual',
  sales: 'Sales',
  purchase: 'Purchases',
  payroll: 'Payroll',
  bank: 'Banking',
  adjustment: 'Adjustment',
  depreciation: 'Depreciation'
};

const sourceModuleColors: Record<string, string> = {
  manual: 'bg-secondary',
  sales: 'bg-green-100 text-green-800',
  purchase: 'bg-orange-100 text-orange-800',
  payroll: 'bg-purple-100 text-purple-800',
  bank: 'bg-blue-100 text-blue-800',
  adjustment: 'bg-yellow-100 text-yellow-800',
  depreciation: 'bg-gray-100 text-gray-800'
};

export default function DetailedLedger() {
  const [datePreset, setDatePreset] = useState('this-month');
  const [dateFrom, setDateFrom] = useState(() => getDatePreset('this-month').from);
  const [dateTo, setDateTo] = useState(() => getDatePreset('this-month').to);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'account' | 'date' | 'source' | 'none'>('account');
  const [sortField, _setSortField] = useState<'date' | 'amount' | 'account'>('date');
  const [sortDirection, _setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dimension filters
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCostCenters, setSelectedCostCenters] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedFunds, setSelectedFunds] = useState<string[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedSourceModules, setSelectedSourceModules] = useState<string[]>([]);
  const [amountMin, setAmountMin] = useState<string>('');
  const [amountMax, setAmountMax] = useState<string>('');
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: dimensions } = useLedgerDimensions();

  // Build filters object
  const filters: DetailedLedgerFilters = useMemo(() => ({
    startDate: dateFrom,
    endDate: dateTo,
    accountIds: selectedAccounts.length ? selectedAccounts : undefined,
    costCenterIds: selectedCostCenters.length ? selectedCostCenters : undefined,
    departmentIds: selectedDepartments.length ? selectedDepartments : undefined,
    projectIds: selectedProjects.length ? selectedProjects : undefined,
    fundIds: selectedFunds.length ? selectedFunds : undefined,
    vendorIds: selectedVendors.length ? selectedVendors : undefined,
    customerIds: selectedCustomers.length ? selectedCustomers : undefined,
    sourceModules: selectedSourceModules.length ? selectedSourceModules : undefined,
    amountMin: amountMin ? parseFloat(amountMin) : undefined,
    amountMax: amountMax ? parseFloat(amountMax) : undefined,
    searchTerm: searchTerm || undefined
  }), [dateFrom, dateTo, selectedAccounts, selectedCostCenters, selectedDepartments, 
      selectedProjects, selectedFunds, selectedVendors, selectedCustomers, 
      selectedSourceModules, amountMin, amountMax, searchTerm]);

  const { data: ledgerData = [], isLoading, refetch } = useDetailedLedger(filters);
  const { data: journalEntries = [] } = useJournalEntries(organization?.id);
  const selectedEntry = useMemo(() => 
    journalEntries.find(e => e.id === selectedEntryId) || null, 
    [journalEntries, selectedEntryId]
  );
  const { formatWithSymbol: formatCurrency } = useCurrencyFormatter();

  // Handle preset change
  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const dates = getDatePreset(preset);
      setDateFrom(dates.from);
      setDateTo(dates.to);
    }
  };

  // Group and process data
  const processedData = useMemo(() => {
    let sorted = [...ledgerData];
    
    // Sort
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.net_amount) - Math.abs(b.net_amount);
          break;
        case 'account':
          comparison = a.account_code.localeCompare(b.account_code);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Group if needed
    if (groupBy === 'none') {
      return { groups: [{ key: 'all', label: 'All Transactions', entries: sorted }] };
    }

    const grouped = new Map<string, { label: string; entries: LedgerEntry[] }>();
    
    for (const entry of sorted) {
      let key: string;
      let label: string;
      
      switch (groupBy) {
        case 'account':
          key = entry.account_id;
          label = `${entry.account_code} - ${entry.account_name}`;
          break;
        case 'date':
          key = entry.txn_date;
          label = formatDateDisplay(entry.txn_date);
          break;
        case 'source':
          key = entry.source_module;
          label = sourceModuleLabels[entry.source_module] || entry.source_module;
          break;
        default:
          key = 'all';
          label = 'All Transactions';
      }

      if (!grouped.has(key)) {
        grouped.set(key, { label, entries: [] });
      }
      grouped.get(key)!.entries.push(entry);
    }

    // Calculate running balances within each account group
    if (groupBy === 'account') {
      grouped.forEach((group) => {
        let runningBalance = 0;
        for (const entry of group.entries) {
          if (entry.normal_balance === 'debit') {
            runningBalance += entry.debit - entry.credit;
          } else {
            runningBalance += entry.credit - entry.debit;
          }
          entry.running_balance = runningBalance;
        }
      });
    }

    return { groups: Array.from(grouped.entries()).map(([key, val]) => ({ key, ...val })) };
  }, [ledgerData, groupBy, sortField, sortDirection]);

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-CA');
  };

  // Calculate totals
  const totals = useMemo(() => {
    return ledgerData.reduce((acc, entry) => ({
      debit: acc.debit + entry.debit,
      credit: acc.credit + entry.credit,
      count: acc.count + 1
    }), { debit: 0, credit: 0, count: 0 });
  }, [ledgerData]);

  // Toggle account expansion
  const toggleAccountExpansion = (key: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedAccounts(newExpanded);
  };

  // Expand/Collapse all
  const expandAll = () => {
    setExpandedAccounts(new Set(processedData.groups.map(g => g.key)));
  };
  
  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedAccounts([]);
    setSelectedCostCenters([]);
    setSelectedDepartments([]);
    setSelectedProjects([]);
    setSelectedFunds([]);
    setSelectedVendors([]);
    setSelectedCustomers([]);
    setSelectedSourceModules([]);
    setAmountMin('');
    setAmountMax('');
    setSearchTerm('');
  };

  const activeFilterCount = [
    selectedAccounts.length,
    selectedCostCenters.length,
    selectedDepartments.length,
    selectedProjects.length,
    selectedFunds.length,
    selectedVendors.length,
    selectedCustomers.length,
    selectedSourceModules.length,
    amountMin ? 1 : 0,
    amountMax ? 1 : 0
  ].reduce((a, b) => a + (b > 0 ? 1 : 0), 0);

  // Export to Excel
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    const exportData = ledgerData.map(entry => ({
      'Date': formatDateDisplay(entry.txn_date),
      'Period': entry.posting_period,
      'Reference': entry.reference_no,
      'Source': sourceModuleLabels[entry.source_module] || entry.source_module,
      'Account Code': entry.account_code,
      'Account Name': entry.account_name,
      'Description': entry.entry_description,
      'Line Memo': entry.line_memo || '',
      'Debit': entry.debit || '',
      'Credit': entry.credit || '',
      'Net Amount': entry.net_amount,
      'Cost Center': entry.cost_center_name || '',
      'Department': entry.department_name || '',
      'Project': entry.project_name || '',
      'Fund': entry.fund_name || '',
      'Vendor': entry.vendor_name || '',
      'Customer': entry.customer_name || '',
      'Tax Code': entry.tax_code || '',
      'Currency': entry.currency
    }));

    const sheet = XLSX.utils.json_to_sheet(exportData);
    sheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 25 }, { wch: 35 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 8 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, sheet, 'Detailed Ledger');
    XLSX.writeFile(workbook, `Detailed_Ledger_${dateFrom}_to_${dateTo}.xlsx`);
    toast.success('Exported to Excel');
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    
    doc.setFontSize(10);
    doc.text(organization?.name?.toUpperCase() || 'ORGANIZATION', pageWidth / 2, y, { align: 'center' });
    y += 8;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Detailed Ledger', pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`From ${formatDateDisplay(dateFrom)} To ${formatDateDisplay(dateTo)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(8);
    doc.text(`Total Entries: ${totals.count} | Total Debits: ${formatCurrency(totals.debit)} | Total Credits: ${formatCurrency(totals.credit)}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Simple table header
    doc.setFont('helvetica', 'bold');
    doc.text('Date', 15, y);
    doc.text('Reference', 40, y);
    doc.text('Account', 70, y);
    doc.text('Description', 120, y);
    doc.text('Debit', 200, y, { align: 'right' });
    doc.text('Credit', 230, y, { align: 'right' });
    doc.text('Balance', 265, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    
    for (const entry of ledgerData.slice(0, 100)) {
      if (y > 180) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(formatDateDisplay(entry.txn_date), 15, y);
      doc.text(entry.reference_no.substring(0, 15), 40, y);
      doc.text(entry.account_code.substring(0, 10), 70, y);
      doc.text((entry.entry_description || '').substring(0, 30), 120, y);
      doc.text(entry.debit ? formatCurrency(entry.debit) : '', 200, y, { align: 'right' });
      doc.text(entry.credit ? formatCurrency(entry.credit) : '', 230, y, { align: 'right' });
      doc.text(entry.running_balance ? formatCurrency(entry.running_balance) : '', 265, y, { align: 'right' });
      y += 5;
    }
    
    doc.save(`Detailed_Ledger_${dateFrom}_to_${dateTo}.pdf`);
    toast.success('Exported to PDF');
  };

  // Print
  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  // Drill down to source document
  const handleDrillDown = (entry: LedgerEntry) => {
    // Open journal entry viewer
    setSelectedEntryId(entry.journal_entry_id);
  };

  if (orgLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
          <p className="text-muted-foreground mb-4">Create an organization to get started.</p>
          <Button onClick={() => setCreateOrgDialogOpen(true)}>Create Organization</Button>
        </Card>
        <CreateOrganizationDialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 print:p-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detailed Ledger</h1>
          <p className="text-muted-foreground">
            Multi-dimensional transaction analysis with drill-down capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export to Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export to PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Preset */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Period:</Label>
              <Select value={datePreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setDatePreset('custom'); }}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setDatePreset('custom'); }}
                className="w-[140px]"
              />
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Group By */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Group:</Label>
              <Select value={groupBy} onValueChange={(v: typeof groupBy) => setGroupBy(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account">By Account</SelectItem>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="source">By Source</SelectItem>
                  <SelectItem value="none">No Grouping</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Filters Button */}
            <Button 
              variant={activeFilterCount > 0 ? "default" : "outline"} 
              size="sm"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Entries</div>
            <div className="text-2xl font-bold">{totals.count.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Debits</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totals.debit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Credits</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.credit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Difference</div>
            <div className={cn(
              "text-2xl font-bold",
              Math.abs(totals.debit - totals.credit) < 0.01 ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(Math.abs(totals.debit - totals.credit))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expand/Collapse Controls */}
      {groupBy !== 'none' && (
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      )}

      {/* Ledger Data */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : ledgerData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found for the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {processedData.groups.map((group) => (
                <Collapsible
                  key={group.key}
                  open={groupBy === 'none' || expandedAccounts.has(group.key)}
                  onOpenChange={() => toggleAccountExpansion(group.key)}
                >
                  {groupBy !== 'none' && (
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted cursor-pointer border-b">
                        <div className="flex items-center gap-2">
                          {expandedAccounts.has(group.key) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{group.label}</span>
                          <Badge variant="secondary">{group.entries.length} entries</Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-green-600">
                            Dr: {formatCurrency(group.entries.reduce((s, e) => s + e.debit, 0))}
                          </span>
                          <span className="text-blue-600">
                            Cr: {formatCurrency(group.entries.reduce((s, e) => s + e.credit, 0))}
                          </span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead className="w-[100px]">Reference</TableHead>
                          <TableHead className="w-[80px]">Source</TableHead>
                          {groupBy !== 'account' && <TableHead>Account</TableHead>}
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right w-[120px]">Debit</TableHead>
                          <TableHead className="text-right w-[120px]">Credit</TableHead>
                          {groupBy === 'account' && (
                            <TableHead className="text-right w-[120px]">Balance</TableHead>
                          )}
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map((entry) => (
                          <TableRow 
                            key={entry.line_id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleDrillDown(entry)}
                          >
                            <TableCell className="font-mono text-sm">
                              {formatDateDisplay(entry.txn_date)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {entry.reference_no}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="secondary" 
                                className={cn("text-xs", sourceModuleColors[entry.source_module])}
                              >
                                {sourceModuleLabels[entry.source_module] || entry.source_module}
                              </Badge>
                            </TableCell>
                            {groupBy !== 'account' && (
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-mono text-muted-foreground">{entry.account_code}</span>
                                  {' '}{entry.account_name}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="max-w-[300px]">
                                <div className="truncate">{entry.entry_description || entry.line_memo}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {entry.cost_center_name && (
                                    <Badge variant="outline" className="text-xs">CC: {entry.cost_center_code}</Badge>
                                  )}
                                  {entry.department_name && (
                                    <Badge variant="outline" className="text-xs">Dept: {entry.department_code}</Badge>
                                  )}
                                  {entry.project_name && (
                                    <Badge variant="outline" className="text-xs">Proj: {entry.project_code}</Badge>
                                  )}
                                  {entry.vendor_name && (
                                    <Badge variant="outline" className="text-xs">V: {entry.vendor_name}</Badge>
                                  )}
                                  {entry.customer_name && (
                                    <Badge variant="outline" className="text-xs">C: {entry.customer_name}</Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.debit > 0 ? formatCurrency(entry.debit) : ''}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {entry.credit > 0 ? formatCurrency(entry.credit) : ''}
                            </TableCell>
                            {groupBy === 'account' && (
                              <TableCell className="text-right font-mono">
                                {entry.running_balance !== undefined ? formatCurrency(entry.running_balance) : ''}
                              </TableCell>
                            )}
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDrillDown(entry); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Filters Dialog */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advanced Filters</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Accounts */}
            <div className="space-y-2">
              <Label className="font-medium">Accounts</Label>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                {dimensions?.accounts.map(acc => (
                  <div key={acc.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`acc-${acc.id}`}
                      checked={selectedAccounts.includes(acc.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAccounts(prev => 
                          checked ? [...prev, acc.id] : prev.filter(id => id !== acc.id)
                        );
                      }}
                    />
                    <label htmlFor={`acc-${acc.id}`} className="text-sm cursor-pointer">
                      {acc.code} - {acc.name}
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Source Modules */}
            <div className="space-y-2">
              <Label className="font-medium">Source Modules</Label>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                {dimensions?.sourceModules.map(mod => (
                  <div key={mod} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`mod-${mod}`}
                      checked={selectedSourceModules.includes(mod)}
                      onCheckedChange={(checked) => {
                        setSelectedSourceModules(prev => 
                          checked ? [...prev, mod] : prev.filter(m => m !== mod)
                        );
                      }}
                    />
                    <label htmlFor={`mod-${mod}`} className="text-sm cursor-pointer">
                      {sourceModuleLabels[mod] || mod}
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* Cost Centers */}
            {dimensions?.costCenters && dimensions.costCenters.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Cost Centers</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.costCenters.map(cc => (
                    <div key={cc.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`cc-${cc.id}`}
                        checked={selectedCostCenters.includes(cc.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCostCenters(prev => 
                            checked ? [...prev, cc.id] : prev.filter(id => id !== cc.id)
                          );
                        }}
                      />
                      <label htmlFor={`cc-${cc.id}`} className="text-sm cursor-pointer">
                        {cc.code} - {cc.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Departments */}
            {dimensions?.departments && dimensions.departments.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Departments</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.departments.map(dept => (
                    <div key={dept.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`dept-${dept.id}`}
                        checked={selectedDepartments.includes(dept.id)}
                        onCheckedChange={(checked) => {
                          setSelectedDepartments(prev => 
                            checked ? [...prev, dept.id] : prev.filter(id => id !== dept.id)
                          );
                        }}
                      />
                      <label htmlFor={`dept-${dept.id}`} className="text-sm cursor-pointer">
                        {dept.code} - {dept.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Projects */}
            {dimensions?.projects && dimensions.projects.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Projects</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.projects.map(proj => (
                    <div key={proj.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`proj-${proj.id}`}
                        checked={selectedProjects.includes(proj.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProjects(prev => 
                            checked ? [...prev, proj.id] : prev.filter(id => id !== proj.id)
                          );
                        }}
                      />
                      <label htmlFor={`proj-${proj.id}`} className="text-sm cursor-pointer">
                        {proj.code} - {proj.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Funds */}
            {dimensions?.funds && dimensions.funds.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Funds</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.funds.map(fund => (
                    <div key={fund.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`fund-${fund.id}`}
                        checked={selectedFunds.includes(fund.id)}
                        onCheckedChange={(checked) => {
                          setSelectedFunds(prev => 
                            checked ? [...prev, fund.id] : prev.filter(id => id !== fund.id)
                          );
                        }}
                      />
                      <label htmlFor={`fund-${fund.id}`} className="text-sm cursor-pointer">
                        {fund.code} - {fund.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Vendors */}
            {dimensions?.vendors && dimensions.vendors.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Vendors</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.vendors.map(v => (
                    <div key={v.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`vendor-${v.id}`}
                        checked={selectedVendors.includes(v.id)}
                        onCheckedChange={(checked) => {
                          setSelectedVendors(prev => 
                            checked ? [...prev, v.id] : prev.filter(id => id !== v.id)
                          );
                        }}
                      />
                      <label htmlFor={`vendor-${v.id}`} className="text-sm cursor-pointer">
                        {v.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Customers */}
            {dimensions?.customers && dimensions.customers.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Customers</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2">
                  {dimensions.customers.map(c => (
                    <div key={c.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`customer-${c.id}`}
                        checked={selectedCustomers.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setSelectedCustomers(prev => 
                            checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                          );
                        }}
                      />
                      <label htmlFor={`customer-${c.id}`} className="text-sm cursor-pointer">
                        {c.name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Amount Range */}
            <div className="space-y-2 md:col-span-2">
              <Label className="font-medium">Amount Range</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Min Amount"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground">to</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Max Amount"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={clearFilters}>
              Clear All
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Journal Entry Dialog */}
      <Dialog open={!!selectedEntryId} onOpenChange={(open) => !open && setSelectedEntryId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Journal Entry Details</span>
              {selectedEntry && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-50 bg-popover">
                      <DropdownMenuItem onClick={() => {
                        if (!selectedEntry) return;
                        const workbook = XLSX.utils.book_new();
                        const exportData = selectedEntry.lines.map(line => {
                          const lineAny = line as any;
                          return {
                            'Account Code': lineAny.account?.code || lineAny.accounts?.code || '',
                            'Account Name': lineAny.account?.name || lineAny.accounts?.name || '',
                            'Memo': line.description || '',
                            'Debit': line.debit || 0,
                            'Credit': line.credit || 0,
                          };
                        });
                        const sheet = XLSX.utils.json_to_sheet(exportData);
                        sheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
                        XLSX.utils.book_append_sheet(workbook, sheet, 'Journal Entry');
                        XLSX.writeFile(workbook, `Journal_Entry_${selectedEntry.reference}.xlsx`);
                        toast.success('Exported to Excel');
                      }}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export to Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (!selectedEntry) return;
                        const doc = new jsPDF();
                        const pageWidth = doc.internal.pageSize.getWidth();
                        let y = 20;
                        
                        doc.setFontSize(10);
                        doc.text(organization?.name?.toUpperCase() || '', pageWidth / 2, y, { align: 'center' });
                        y += 8;
                        
                        doc.setFontSize(14);
                        doc.setFont('helvetica', 'bold');
                        doc.text('Journal Entry', pageWidth / 2, y, { align: 'center' });
                        y += 10;
                        
                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`Reference: ${selectedEntry.reference}`, 15, y);
                        doc.text(`Date: ${formatDateDisplay(selectedEntry.entry_date)}`, 100, y);
                        doc.text(`Status: ${selectedEntry.status}`, 160, y);
                        y += 8;
                        doc.text(`Description: ${selectedEntry.description || ''}`, 15, y);
                        y += 12;
                        
                        // Table header
                        doc.setFont('helvetica', 'bold');
                        doc.text('Account', 15, y);
                        doc.text('Memo', 80, y);
                        doc.text('Debit', 145, y, { align: 'right' });
                        doc.text('Credit', 180, y, { align: 'right' });
                        y += 6;
                        doc.setLineWidth(0.3);
                        doc.line(15, y - 2, 195, y - 2);
                        
                        doc.setFont('helvetica', 'normal');
                        let totalDebits = 0;
                        let totalCredits = 0;
                        
                        for (const line of selectedEntry.lines) {
                          if (y > 270) {
                            doc.addPage();
                            y = 20;
                          }
                          const lineAny = line as any;
                          const accountCode = lineAny.account?.code || lineAny.accounts?.code || '';
                          const accountName = lineAny.account?.name || lineAny.accounts?.name || '';
                          doc.text(`${accountCode} ${accountName}`.substring(0, 35), 15, y);
                          doc.text((line.description || '').substring(0, 30), 80, y);
                          if (line.debit > 0) {
                            doc.text(formatCurrency(line.debit), 145, y, { align: 'right' });
                            totalDebits += line.debit;
                          }
                          if (line.credit > 0) {
                            doc.text(formatCurrency(line.credit), 180, y, { align: 'right' });
                            totalCredits += line.credit;
                          }
                          y += 6;
                        }
                        
                        // Totals line
                        y += 2;
                        doc.setLineWidth(0.3);
                        doc.line(130, y - 4, 195, y - 4);
                        doc.setFont('helvetica', 'bold');
                        doc.text('Totals:', 15, y);
                        doc.text(formatCurrency(totalDebits), 145, y, { align: 'right' });
                        doc.text(formatCurrency(totalCredits), 180, y, { align: 'right' });
                        
                        doc.save(`Journal_Entry_${selectedEntry.reference}.pdf`);
                        toast.success('Exported to PDF');
                      }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export to PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm flex-shrink-0">
                <div><span className="text-muted-foreground">Reference:</span> {selectedEntry.reference}</div>
                <div><span className="text-muted-foreground">Date:</span> {formatDateDisplay(selectedEntry.entry_date)}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge>{selectedEntry.status}</Badge></div>
              </div>
              <div className="flex-shrink-0"><span className="text-muted-foreground">Description:</span> {selectedEntry.description}</div>
              
              <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.lines.map((line) => {
                      const lineAny = line as any;
                      const accountCode = lineAny.account?.code || lineAny.accounts?.code || '';
                      const accountName = lineAny.account?.name || lineAny.accounts?.name || '';
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">
                            {accountCode && accountName ? `${accountCode} - ${accountName}` : accountCode || accountName || '-'}
                          </TableCell>
                          <TableCell>{line.description || '-'}</TableCell>
                          <TableCell className="text-right">{line.debit > 0 ? formatCurrency(line.debit) : ''}</TableCell>
                          <TableCell className="text-right">{line.credit > 0 ? formatCurrency(line.credit) : ''}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </ScrollArea>
              </div>
              
              {/* Totals row */}
              <div className="flex justify-end gap-8 text-sm font-semibold border-t pt-3 flex-shrink-0">
                <span>Total Debits: {formatCurrency(selectedEntry.lines.reduce((sum, l) => sum + l.debit, 0))}</span>
                <span>Total Credits: {formatCurrency(selectedEntry.lines.reduce((sum, l) => sum + l.credit, 0))}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateOrganizationDialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen} />
    </div>
  );
}
