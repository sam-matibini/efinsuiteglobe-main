import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, subMonths, subYears } from 'date-fns';
import { Plus, Search, Download, Building2, Eye, Pencil, Trash2, RotateCcw, Send, ListChecks, X, ChevronLeft, ChevronRight, Upload, Sparkles } from 'lucide-react';
import { parseLocalDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useJournalEntries, useDeleteJournalEntry, useReverseJournalEntry, usePostJournalEntry, JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { useAuth } from '@/hooks/useAuth';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { useVendors } from '@/hooks/useVendors';
import { useCustomers } from '@/hooks/useCustomers';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { AddJournalEntryDialog } from '@/components/journal/AddJournalEntryDialog';
import { EditJournalEntryDialog } from '@/components/journal/EditJournalEntryDialog';
import { ViewJournalEntryDialog } from '@/components/journal/ViewJournalEntryDialog';
import { ReverseJournalEntryDialog } from '@/components/journal/ReverseJournalEntryDialog';
import { BulkPostDialog } from '@/components/journal/BulkPostDialog';
import BulkJournalImportDialog from '@/components/journal/BulkJournalImportDialog';
import { AICategorizeLinesDialog } from '@/components/ai/AICategorizeLinesDialog';
import { AICategorizationHealth } from '@/components/banking/AICategorizationHealth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate, formatFiscalYearPeriod } from '@/lib/fiscalYearUtils';

export default function JournalEntries() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters — initialized from URL so they're shareable / persist on refresh
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? 'all');
  const [periodFilter, setPeriodFilter] = useState(searchParams.get('period') ?? 'all');
  const [accountFilter, setAccountFilter] = useState(searchParams.get('account') ?? 'all');
  const [vendorFilter, setVendorFilter] = useState(searchParams.get('vendor') ?? 'all');
  const [customerFilter, setCustomerFilter] = useState(searchParams.get('customer') ?? 'all');
  const [createdByFilter, setCreatedByFilter] = useState(searchParams.get('createdBy') ?? 'all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState(searchParams.get('fy') ?? 'all');
  const [startDate, setStartDate] = useState(searchParams.get('from') ?? '');
  const [endDate, setEndDate] = useState(searchParams.get('to') ?? '');
  const [amountMin, setAmountMin] = useState(searchParams.get('min') ?? '');
  const [amountMax, setAmountMax] = useState(searchParams.get('max') ?? '');
  const [pageSize, setPageSize] = useState<number>(() => {
    const ps = Number(searchParams.get('ps') ?? 100);
    return [50, 100, 200, 500, 1000, -1].includes(ps) ? ps : 100;
  });
  const [pageIndex, setPageIndex] = useState(0);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false);

  const [entryToView, setEntryToView] = useState<JournalEntryWithLines | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<JournalEntryWithLines | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntryWithLines | null>(null);
  const [entryToReverse, setEntryToReverse] = useState<JournalEntryWithLines | null>(null);
  const [entryToPost, setEntryToPost] = useState<JournalEntryWithLines | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [bulkPostDialogOpen, setBulkPostDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);

  const { organization, isLoading: orgLoading } = useCurrentOrganization();

  // Resolve effective server-side date range: fiscal year > start/end overrides
  const fyEndMonth = organization?.fiscal_year_end_month ?? 12;
  const fyDateRange = useMemo(() => {
    if (fiscalYearFilter === 'all') return null;
    const fy = Number(fiscalYearFilter);
    if (!Number.isFinite(fy)) return null;
    return {
      from: format(getFiscalYearStart(fy, fyEndMonth), 'yyyy-MM-dd'),
      to: format(getFiscalYearEnd(fy, fyEndMonth), 'yyyy-MM-dd'),
    };
  }, [fiscalYearFilter, fyEndMonth]);

  const serverStart = fyDateRange?.from || startDate || undefined;
  const serverEnd = fyDateRange?.to || endDate || undefined;

  const { data: entries = [], isLoading: entriesLoading } = useJournalEntries(
    organization?.id,
    {
      status: statusFilter as any,
      journalType: typeFilter as any,
      startDate: serverStart,
      endDate: serverEnd,
      accountId: accountFilter !== 'all' ? accountFilter : undefined,
      vendorId: vendorFilter !== 'all' ? vendorFilter : undefined,
      customerId: customerFilter !== 'all' ? customerFilter : undefined,
      createdBy: createdByFilter !== 'all' ? createdByFilter : undefined,
    },
  );
  const { data: accounts = [] } = useAccounts(organization?.id);
  const { vendors = [] } = useVendors();
  const { customers = [] } = useCustomers();
  const deleteEntry = useDeleteJournalEntry();
  const reverseEntry = useReverseJournalEntry();
  const postEntry = usePostJournalEntry();
  const { user } = useAuth();
  const isReadOnly = useIsReadOnly();

  // Persist filters → URL (debounced via effect)
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all') params.type = typeFilter;
    if (periodFilter !== 'all') params.period = periodFilter;
    if (accountFilter !== 'all') params.account = accountFilter;
    if (vendorFilter !== 'all') params.vendor = vendorFilter;
    if (customerFilter !== 'all') params.customer = customerFilter;
    if (createdByFilter !== 'all') params.createdBy = createdByFilter;
    if (fiscalYearFilter !== 'all') params.fy = fiscalYearFilter;
    if (startDate) params.from = startDate;
    if (endDate) params.to = endDate;
    if (amountMin) params.min = amountMin;
    if (amountMax) params.max = amountMax;
    if (pageSize !== 100) params.ps = String(pageSize);
    setSearchParams(params, { replace: true });
    setPageIndex(0);
  }, [searchQuery, statusFilter, typeFilter, periodFilter, accountFilter, vendorFilter, customerFilter, createdByFilter, fiscalYearFilter, startDate, endDate, amountMin, amountMax, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(parseLocalDate(dateStr), 'MMM d, yyyy');
  };

  const getPeriod = (dateStr: string) => {
    return format(parseLocalDate(dateStr), 'yyyy-MM');
  };

  // Get unique periods from entries
  const periods = useMemo(() => {
    const uniquePeriods = new Set<string>();
    entries.forEach((e) => {
      uniquePeriods.add(getPeriod(e.entry_date));
    });
    return Array.from(uniquePeriods).sort().reverse();
  }, [entries]);

  const deferredSearch = useDeferredValue(searchQuery);


  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const vendorMap = useMemo(
    () => new Map(vendors.map((v) => [v.id, v])),
    [vendors]
  );
  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers]
  );

  // Pre-build a lowercase search blob per entry
  const searchBlobs = useMemo(() => {
    const blobs = new Map<string, string>();
    for (const e of entries) {
      const parts: string[] = [
        e.reference || '',
        e.description || '',
        e.journal_type || '',
        e.status || '',
        e.entry_date || '',
      ];
      for (const l of e.lines || []) {
        const acc = accountMap.get(l.account_id);
        if (acc) {
          parts.push(acc.code || '', acc.name || '');
        }
        if ((l as any).description) parts.push((l as any).description);
        const d = Number((l as any).debit) || 0;
        const c = Number((l as any).credit) || 0;
        if (d) {
          parts.push(String(d), d.toFixed(2), d.toLocaleString('en-US'), d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
        if (c) {
          parts.push(String(c), c.toFixed(2), c.toLocaleString('en-US'), c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
        const vid = (l as any).vendor_id;
        const cid = (l as any).customer_id;
        if (vid) {
          const v = vendorMap.get(vid);
          if (v?.name) parts.push(v.name);
        }
        if (cid) {
          const cu = customerMap.get(cid);
          if (cu?.name) parts.push(cu.name);
        }
      }
      blobs.set(e.id, parts.join(' \u0001 ').toLowerCase());
    }
    return blobs;
  }, [entries, accountMap, vendorMap, customerMap]);

  // Available fiscal years from entries (server already filters by FY if chosen,
  // so derive from all entries' span; cheaper: derive from current entries + current year)
  const availableFiscalYears = useMemo(() => {
    const years = new Set<number>();
    const nowFy = getFiscalYearForDate(new Date(), fyEndMonth);
    years.add(nowFy);
    years.add(nowFy - 1);
    for (const e of entries) {
      years.add(getFiscalYearForDate(parseLocalDate(e.entry_date), fyEndMonth));
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [entries, fyEndMonth]);

  // Unique users from entries
  const creatorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (e.created_by && !seen.has(e.created_by)) {
        const p = (e as any).created_by_profile;
        seen.set(e.created_by, p?.full_name || p?.email || 'User');
      }
    }
    return Array.from(seen.entries());
  }, [entries]);

  // Filter entries (search + period + amount; server already applied the rest)
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    const query = deferredSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((e) => (searchBlobs.get(e.id) || '').includes(query));
    }

    if (periodFilter !== 'all') {
      filtered = filtered.filter((e) => getPeriod(e.entry_date) === periodFilter);
    }

    const min = amountMin ? Number(amountMin) : null;
    const max = amountMax ? Number(amountMax) : null;
    if (min !== null || max !== null) {
      filtered = filtered.filter((e) => {
        const total = e.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        if (min !== null && total < min) return false;
        if (max !== null && total > max) return false;
        return true;
      });
    }

    return filtered;
  }, [entries, searchBlobs, deferredSearch, periodFilter, amountMin, amountMax]);

  // Pagination slice
  const pageCount = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const pagedEntries = useMemo(() => {
    if (pageSize === -1) return filteredEntries;
    const start = pageIndex * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, pageIndex, pageSize]);

  // Footer totals across full filtered set
  const totals = useMemo(() => {
    let d = 0, c = 0;
    for (const e of filteredEntries) {
      for (const l of e.lines) { d += Number(l.debit || 0); c += Number(l.credit || 0); }
    }
    return { debit: d, credit: c };
  }, [filteredEntries]);

  const activeFilters: Array<{ key: string; label: string; clear: () => void }> = [];
  if (statusFilter !== 'all') activeFilters.push({ key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') });
  if (typeFilter !== 'all') activeFilters.push({ key: 'type', label: `Source: ${typeFilter}`, clear: () => setTypeFilter('all') });
  if (periodFilter !== 'all') activeFilters.push({ key: 'period', label: `Period: ${periodFilter}`, clear: () => setPeriodFilter('all') });
  if (accountFilter !== 'all') {
    const a = accounts.find((x) => x.id === accountFilter);
    activeFilters.push({ key: 'account', label: `Account: ${a ? `${a.code} ${a.name}` : '…'}`, clear: () => setAccountFilter('all') });
  }
  if (vendorFilter !== 'all') {
    const v = vendors.find((x) => x.id === vendorFilter);
    activeFilters.push({ key: 'vendor', label: `Vendor: ${v?.name ?? '…'}`, clear: () => setVendorFilter('all') });
  }
  if (customerFilter !== 'all') {
    const c = customers.find((x) => x.id === customerFilter);
    activeFilters.push({ key: 'customer', label: `Customer: ${c?.name ?? '…'}`, clear: () => setCustomerFilter('all') });
  }
  if (createdByFilter !== 'all') {
    const name = creatorOptions.find(([id]) => id === createdByFilter)?.[1] ?? '…';
    activeFilters.push({ key: 'createdBy', label: `Created by: ${name}`, clear: () => setCreatedByFilter('all') });
  }
  if (fiscalYearFilter !== 'all') activeFilters.push({ key: 'fy', label: `FY ${fiscalYearFilter}`, clear: () => setFiscalYearFilter('all') });
  if (startDate) activeFilters.push({ key: 'from', label: `From ${startDate}`, clear: () => setStartDate('') });
  if (endDate) activeFilters.push({ key: 'to', label: `To ${endDate}`, clear: () => setEndDate('') });
  if (amountMin) activeFilters.push({ key: 'min', label: `Min ${amountMin}`, clear: () => setAmountMin('') });
  if (amountMax) activeFilters.push({ key: 'max', label: `Max ${amountMax}`, clear: () => setAmountMax('') });

  const clearAllFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setTypeFilter('all'); setPeriodFilter('all');
    setAccountFilter('all'); setVendorFilter('all'); setCustomerFilter('all'); setCreatedByFilter('all');
    setFiscalYearFilter('all'); setStartDate(''); setEndDate(''); setAmountMin(''); setAmountMax('');
  };

  // Quick date presets
  const applyPreset = (preset: string) => {
    const today = new Date();
    setFiscalYearFilter('all');
    setPeriodFilter('all');
    let from = '', to = '';
    switch (preset) {
      case 'this_month': from = format(startOfMonth(today), 'yyyy-MM-dd'); to = format(endOfMonth(today), 'yyyy-MM-dd'); break;
      case 'last_month': {
        const lm = subMonths(today, 1);
        from = format(startOfMonth(lm), 'yyyy-MM-dd'); to = format(endOfMonth(lm), 'yyyy-MM-dd'); break;
      }
      case 'this_quarter': from = format(startOfQuarter(today), 'yyyy-MM-dd'); to = format(endOfQuarter(today), 'yyyy-MM-dd'); break;
      case 'ytd': from = format(startOfYear(today), 'yyyy-MM-dd'); to = format(today, 'yyyy-MM-dd'); break;
      case 'last_year': {
        const ly = subYears(today, 1);
        from = format(startOfYear(ly), 'yyyy-MM-dd'); to = format(new Date(ly.getFullYear(), 11, 31), 'yyyy-MM-dd'); break;
      }
      case 'all': from = ''; to = ''; break;
    }
    setStartDate(from); setEndDate(to);
  };



  const statusColors: Record<string, string> = {
    draft: 'bg-warning/15 text-warning border border-warning/30',
    posted: 'bg-success/15 text-success border border-success/30',
    reversed: 'bg-muted text-muted-foreground border border-border',
  };

  const typeLabels: Record<string, string> = {
    manual: 'Manual',
    sales: 'Sales',
    purchase: 'Purchase',
    payroll: 'Payroll',
    bank: 'Bank',
    adjustment: 'Adjustment',
    depreciation: 'Depreciation',
  };

  const isLoading = orgLoading || entriesLoading;

  const handleView = (entry: JournalEntryWithLines) => {
    setEntryToView(entry);
    setViewDialogOpen(true);
  };

  const handleEdit = (entry: JournalEntryWithLines) => {
    setEntryToEdit(entry);
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: JournalEntryWithLines) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  };

  const handleReverse = (entry: JournalEntryWithLines) => {
    setEntryToReverse(entry);
    setReverseDialogOpen(true);
  };

  const handlePost = (entry: JournalEntryWithLines) => {
    setEntryToPost(entry);
    setPostDialogOpen(true);
  };

  // No organization state
  if (!orgLoading && !organization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
            <p className="text-muted-foreground">Create and manage journal entries</p>
          </div>
        </div>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Organization Found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-1">
                Create an organization to start recording journal entries.
              </p>
            </div>
            <Button onClick={() => setCreateOrgDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        </Card>

        <CreateOrganizationDialog
          open={createOrgDialogOpen}
          onOpenChange={setCreateOrgDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground">Create and manage journal entries</p>
        </div>
        <div className="flex items-center gap-3">
          <AICategorizationHealth context="revenue" label="Revenue AI acceptance" />
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setAiCatDialogOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Categorize Lines
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={() => setBulkImportDialogOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setBulkPostDialogOpen(true)}
                disabled={!entries.some(e => e.status === 'draft')}
              >
                <ListChecks className="w-4 h-4 mr-2" />
                Bulk Post
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Journal Entry
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reference, description, account, memo, amount, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick presets */}
          <Select onValueChange={applyPreset}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Quick range" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="last_month">Last month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="last_year">Last calendar year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          {/* Fiscal year */}
          <Select value={fiscalYearFilter} onValueChange={(v) => { setFiscalYearFilter(v); if (v !== 'all') { setStartDate(''); setEndDate(''); } }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Fiscal year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fiscal years</SelectItem>
              {availableFiscalYears.map((fy) => (
                <SelectItem key={fy} value={String(fy)}>{formatFiscalYearPeriod(fy, fyEndMonth)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period (YYYY-MM) */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All periods" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periods.map((period) => (
                <SelectItem key={period} value={period}>{period}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Account */}
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All accounts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.filter((a) => !a.is_header).map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vendor */}
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All vendors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Customer */}
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All customers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Created by */}
          <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Created by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {creatorOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setFiscalYearFilter('all'); }} className="w-36" placeholder="yyyy-mm-dd" />
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setFiscalYearFilter('all'); }} className="w-36" placeholder="yyyy-mm-dd" />

          {/* Amount range */}
          <Input type="number" inputMode="decimal" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="w-28" placeholder="Min $" />
          <Input type="number" inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="w-28" placeholder="Max $" />

          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>

          {/* Source */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="depreciation">Depreciation</SelectItem>
            </SelectContent>
          </Select>

          {/* Page size */}
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Page size" /></SelectTrigger>
            <SelectContent>
              {[50, 100, 200, 500, 1000].map((n) => (
                <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
              ))}
              <SelectItem value="-1">Show all</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Result count + active filter chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Showing {pagedEntries.length.toLocaleString()} of {filteredEntries.length.toLocaleString()} matching · {entries.length.toLocaleString()} loaded
          </span>
          {activeFilters.map((f) => (
            <Badge key={f.key} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
              {f.label}
              <button onClick={f.clear} className="ml-1 rounded hover:bg-background/40 p-0.5" aria-label={`Clear ${f.label}`}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {activeFilters.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAllFilters}>
              Clear all
            </Button>
          )}
        </div>
      </Card>


      {/* Journal Entries Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No journal entries found. Create your first entry to get started.</p>
            <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Journal Entry
            </Button>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No entries match your search criteria.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Entry Number</TableHead>
                <TableHead className="w-24">Period</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-28">Debit</TableHead>
                <TableHead className="text-right w-28">Credit</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-52">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedEntries.map((entry) => {
                const totalDebits = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                const totalCredits = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
                
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onDoubleClick={() => handleView(entry)}
                    title="Double-click to view journal entry & source detail"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium font-mono text-foreground">{entry.reference}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(entry.entry_date)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getPeriod(entry.entry_date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground">{entry.description || 'No description'}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {typeLabels[entry.journal_type] || 'Manual'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {formatCurrency(totalDebits)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-600">
                      {formatCurrency(totalCredits)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[entry.status]}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => handleView(entry)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleEdit(entry)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        {!isReadOnly && entry.status === 'draft' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-primary border-primary/30 hover:bg-primary/10"
                              onClick={() => handlePost(entry)}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Post
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(entry)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {!isReadOnly && entry.status === 'posted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                            onClick={() => handleReverse(entry)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reverse
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  Totals across {filteredEntries.length.toLocaleString()} filtered entries
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totals.credit)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
        {pageSize !== -1 && filteredEntries.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={pageIndex === 0} onClick={() => setPageIndex(0)}>First</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex(pageCount - 1)}>Last</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      {organization && (
        <>
          <AddJournalEntryDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            organizationId={organization.id}
          />
          
          <ViewJournalEntryDialog
            open={viewDialogOpen}
            onOpenChange={(open) => {
              setViewDialogOpen(open);
              if (!open) setEntryToView(null);
            }}
            entry={entryToView}
          />
          
          {entryToEdit && (
            <EditJournalEntryDialog
              open={editDialogOpen}
              onOpenChange={(open) => {
                setEditDialogOpen(open);
                if (!open) setEntryToEdit(null);
              }}
              organizationId={organization.id}
              entry={entryToEdit}
            />
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {entryToDelete?.reference}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (entryToDelete && organization) {
                  deleteEntry.mutate({ id: entryToDelete.id, organizationId: organization.id });
                  setEntryToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Journal Entry Dialog */}
      <ReverseJournalEntryDialog
        open={reverseDialogOpen}
        onOpenChange={(open) => {
          setReverseDialogOpen(open);
          if (!open) setEntryToReverse(null);
        }}
        entry={entryToReverse}
        isLoading={reverseEntry.isPending}
        onConfirm={(reversalDate) => {
          if (entryToReverse && organization && user) {
            reverseEntry.mutate(
              {
                entry: {
                  id: entryToReverse.id,
                  reference: entryToReverse.reference,
                  entry_date: entryToReverse.entry_date,
                  description: entryToReverse.description,
                  lines: entryToReverse.lines.map((l) => ({
                    account_id: l.account_id,
                    description: l.description,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                  })),
                },
                organizationId: organization.id,
                userId: user.id,
                reversalDate,
              },
              {
                onSuccess: () => {
                  setReverseDialogOpen(false);
                  setEntryToReverse(null);
                },
              }
            );
          }
        }}
      />

      {/* Post to GL Confirmation */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Journal Entry to General Ledger</AlertDialogTitle>
            <AlertDialogDescription>
              This will post the journal entry to the General Ledger and update account balances. Once posted, the entry cannot be edited—only reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (entryToPost && organization && user) {
                  postEntry.mutate({
                    id: entryToPost.id,
                    organizationId: organization.id,
                    userId: user.id,
                  });
                  setEntryToPost(null);
                }
              }}
            >
              Post to GL
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />

      {organization && (
        <BulkPostDialog
          open={bulkPostDialogOpen}
          onOpenChange={setBulkPostDialogOpen}
          entries={entries}
          organizationId={organization.id}
        />
      )}

      <BulkJournalImportDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
      />
    </div>
  );
}
