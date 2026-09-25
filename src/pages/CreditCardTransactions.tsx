import { useState, useMemo, useCallback } from 'react';
import { Search, Download, Upload, ArrowUpRight, ArrowDownLeft, Link2, Check, AlertCircle, MoreHorizontal, Building2, Plus, Filter, Calendar, Edit, ArrowUpDown, ArrowUp, ArrowDown, CreditCard, ArrowLeft, RefreshCw, Sparkles, Lock, Eye, FileSpreadsheet, Trash2, CheckSquare, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, parseLocalDate } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CreditCardImportDialog } from '@/components/banking/CreditCardImportDialog';
import { StatementExtractionDialog } from '@/components/banking/StatementExtractionDialog';
import { EditCreditCardTransactionDialog } from '@/components/banking/EditCreditCardTransactionDialog';
import { MatchPaymentDialog } from '@/components/banking/MatchPaymentDialog';
import { useCreditCards, useCreditCardTransactions, CreditCardTransaction, ExtendedCreditCardTransaction } from '@/hooks/useCreditCards';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactionRules } from '@/hooks/useTransactionRules';
import { useApplyCCRules } from '@/hooks/useCreditCardRuleAnalysis';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { classifyCreditCardType, normalizeCreditCardAmount } from '@/lib/creditCardImportNormalizer';

type SortField = 'transaction_date' | 'description' | 'payee_payor' | 'reference' | 'category' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

export default function CreditCardTransactions() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { creditCards, isLoading: cardsLoading } = useCreditCards();
  const currentCard = creditCards.find(c => c.id === cardId);
  const { transactions, isLoading: txLoading, totalCharges, totalPayments, importTransactions, updateTransaction, matchPaymentTransactions, unimportTransactions } = useCreditCardTransactions(cardId, currentCard?.gl_account_id);
  const { data: glAccounts = [] } = useAccounts(organization?.id);
  const { rules, activeRules } = useTransactionRules();
  const applyCCRules = useApplyCCRules();
  const { formatCurrency: formatLocalizedCurrency, formatDate: formatLocalizedDate } = useLocalizedCurrency();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedCreditCardTransaction | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('transaction_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchSourceTransaction, setMatchSourceTransaction] = useState<ExtendedCreditCardTransaction | null>(null);


  const formatCurrency = (value: number, currency: string = 'CAD') => {
    return formatLocalizedCurrency(Math.abs(value), { showSymbol: true });
  };

  const formatDate = (date: string) => {
    return formatLocalizedDate(date, 'medium');
  };

  const statusConfig: Record<string, { label: string; icon: typeof AlertCircle; color: string }> = {
    pending: { label: 'Pending', icon: AlertCircle, color: 'bg-amber-500/10 text-amber-600' },
    unmatched: { label: 'Unmatched', icon: AlertCircle, color: 'bg-warning/10 text-warning' },
    matched: { label: 'Matched', icon: Link2, color: 'bg-blue-500/10 text-blue-600' },
    reconciled: { label: 'Reconciled', icon: Lock, color: 'bg-success/10 text-success' },
  };

  // Get unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Date range helper - uses string comparisons to avoid timezone issues
  const getDateRangeFilter = useCallback(() => {
    const now = new Date();
    const formatLocalDate = (d: Date) => format(d, 'yyyy-MM-dd');
    
    switch (dateRange) {
      case 'this-month':
        return { start: formatLocalDate(startOfMonth(now)), end: formatLocalDate(endOfMonth(now)) };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return { start: formatLocalDate(startOfMonth(lastMonth)), end: formatLocalDate(endOfMonth(lastMonth)) };
      case 'last-3-months':
        return { start: formatLocalDate(startOfMonth(subMonths(now, 2))), end: formatLocalDate(endOfMonth(now)) };
      case 'this-year':
        return { start: formatLocalDate(startOfYear(now)), end: formatLocalDate(endOfYear(now)) };
      case 'custom':
        return { 
          start: customStartDate ? formatLocalDate(customStartDate) : null, 
          end: customEndDate ? formatLocalDate(customEndDate) : null 
        };
      default:
        return null;
    }
  }, [dateRange, customStartDate, customEndDate]);

  const filteredTransactions = useMemo(() => {
    const dateFilter = getDateRangeFilter();
    
    const filtered = transactions.filter(t => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        t.description.toLowerCase().includes(searchLower) ||
        (t.payee_payor?.toLowerCase().includes(searchLower) ?? false) ||
        (t.reference?.toLowerCase().includes(searchLower) ?? false) ||
        (t.category?.toLowerCase().includes(searchLower) ?? false);
      
      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = t.status === statusFilter;
      }
      
      // Type filter
      const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      
      // Date range filter - use string comparison to avoid timezone issues
      let matchesDate = true;
      if (dateFilter && dateFilter.start && dateFilter.end) {
        const txDateStr = t.transaction_date.substring(0, 10); // Extract YYYY-MM-DD
        matchesDate = txDateStr >= dateFilter.start && txDateStr <= dateFilter.end;
      }
      
      // Amount filter
      let matchesAmount = true;
      const txAmount = Math.abs(Number(t.amount));
      if (amountMin && !isNaN(parseFloat(amountMin))) {
        matchesAmount = txAmount >= parseFloat(amountMin);
      }
      if (amountMax && !isNaN(parseFloat(amountMax))) {
        matchesAmount = matchesAmount && txAmount <= parseFloat(amountMax);
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesDate && matchesAmount;
    });

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortField) {
        case 'transaction_date':
          return dir * (parseLocalDate(a.transaction_date).getTime() - parseLocalDate(b.transaction_date).getTime());
        case 'description':
          return dir * a.description.localeCompare(b.description);
        case 'payee_payor':
          return dir * ((a.payee_payor || '').localeCompare(b.payee_payor || ''));
        case 'reference':
          return dir * ((a.reference || '').localeCompare(b.reference || ''));
        case 'category':
          return dir * ((a.category || '').localeCompare(b.category || ''));
        case 'amount':
          return dir * (Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)));
        case 'status':
          return dir * ((a.status || '').localeCompare(b.status || ''));
        default:
          return 0;
      }
    });
  }, [transactions, searchQuery, statusFilter, typeFilter, categoryFilter, getDateRangeFilter, amountMin, amountMax, sortField, sortDirection]);

  // Sort toggle handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Sort header component
  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={cn("cursor-pointer hover:bg-muted/50 transition-colors select-none", className)}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-primary" />
          ) : (
            <ArrowDown className="w-3 h-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-muted-foreground opacity-50" />
        )}
      </div>
    </TableHead>
  );

  const activeFiltersCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    categoryFilter !== 'all',
    dateRange !== 'all',
    amountMin !== '',
    amountMax !== '',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setDateRange('all');
    setAmountMin('');
    setAmountMax('');
    setSearchQuery('');
  };

  const handleImport = async (txns: Omit<CreditCardTransaction, 'id' | 'created_at' | 'updated_at'>[]) => {
    if (!cardId) return;
    await importTransactions.mutateAsync(txns);
    setImportDialogOpen(false);
  };

  const handleEditTransaction = (transaction: ExtendedCreditCardTransaction) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleSaveTransaction = async (updates: Partial<CreditCardTransaction>) => {
    if (!updates.id) return;
    await updateTransaction.mutateAsync({ id: updates.id, ...updates });
  };

  const handleRefreshRules = useCallback(async () => {
    if (!organization?.id || !cardId) return;
    
    await applyCCRules.mutateAsync({
      transactions,
      rules,
      organizationId: organization.id,
      creditCardId: cardId,
    });
  }, [organization?.id, cardId, transactions, rules, applyCCRules]);

  const handleExtractionImport = (data: Record<string, unknown>[]) => {
    if (!cardId) return;

    const creditCardGlAccountId = currentCard?.gl_account_id || null;

    const mappedTransactions = data.map(tx => {
      // CC convention: POSITIVE = charge (purchase), NEGATIVE = payment (into card).
      // Prefer mapped debit/credit columns when present.
      const rawAmount = Number(tx.amount || 0);
      const debit = Number(tx.debit || 0);    // charges column
      const credit = Number(tx.credit || 0);  // payments/credits column
      const explicitType = typeof tx.type === 'string' ? String(tx.type) : '';
      const description = String(tx.description || '');

      let transactionType: 'charge' | 'payment' | 'credit' | 'fee' | 'interest';
      let magnitude: number;

      if (debit > 0 || credit > 0) {
        // Explicit split columns win
        if (debit >= credit) {
          transactionType = 'charge';
          magnitude = Math.abs(debit);
        } else {
          transactionType = 'payment';
          magnitude = Math.abs(credit);
        }
      } else {
        transactionType = classifyCreditCardType(rawAmount, explicitType, description);
        magnitude = normalizeCreditCardAmount(rawAmount);
      }

      const transactionDate = String(
        tx.transaction_date ||
        tx.date ||
        new Date().toISOString().split('T')[0]
      );

      const payeePayor = tx.merchant || tx.payee_payor || tx.payee || tx.payor || null;
      const postedDate = tx.posted_date ? String(tx.posted_date) : null;

      return {
        credit_card_id: cardId,
        transaction_date: transactionDate,
        posted_date: postedDate,
        description,
        amount: magnitude,
        transaction_type: transactionType,
        payee_payor: payeePayor ? String(payeePayor) : null,
        reference: tx.reference ? String(tx.reference) : null,
        category: tx.category ? String(tx.category) : null,
        merchant_category_code: null,
        memo: tx.memo ? String(tx.memo) : null,
        is_cleared: false,
        cleared_at: null,
        gl_account_id: creditCardGlAccountId,
        journal_entry_id: null,
        status: 'pending' as const,
        imported_at: new Date().toISOString(),
      };
    });

    importTransactions.mutate(mappedTransactions);
    setExtractionDialogOpen(false);
  };

  // Handler for opening the match dialog
  const handleOpenMatchDialog = (transaction: ExtendedCreditCardTransaction) => {
    setMatchSourceTransaction(transaction);
    setMatchDialogOpen(true);
  };

  // Handler for matching transactions
  const handleMatchTransactions = async (sourceId: string, targetId: string) => {
    // Determine which is the CC transaction and which is the JE
    const sourceTransaction = transactions.find(t => t.id === sourceId);
    const targetTransaction = transactions.find(t => t.id === targetId);
    
    if (!sourceTransaction || !targetTransaction) return;
    
    // The CC transaction is the one from credit_card_transactions table
    const ccTxn = sourceTransaction.source === 'credit_card_transaction' ? sourceTransaction : targetTransaction;
    const jeTxn = sourceTransaction.source === 'journal_entry' ? sourceTransaction : targetTransaction;
    
    // Get the actual journal_entry_id from the JE-sourced transaction
    if (!jeTxn.journal_entry_id) {
      toast.error('Cannot match: Journal entry ID not found');
      return;
    }
    
    await matchPaymentTransactions.mutateAsync({
      ccTransactionId: ccTxn.id,
      jeTransactionId: jeTxn.id,
      journalEntryId: jeTxn.journal_entry_id,
    });
  };

  // Count uncategorized transactions
  const uncategorizedCount = useMemo(() => 
    transactions.filter(t => !t.category && t.status !== 'reconciled').length
  , [transactions]);
  
  // Count pending payments that can be matched
  const pendingPaymentsCount = useMemo(() => 
    transactions.filter(t => 
      t.transaction_type === 'payment' && 
      t.status === 'pending' &&
      !t.is_cleared
    ).length
  , [transactions]);

  // Get imported transaction ids for unimport
  const selectedImportedCount = useMemo(() => 
    Array.from(selectedTransactionIds).filter(id => {
      const txn = filteredTransactions.find(t => t.id === id);
      return txn && txn.imported_at && txn.source !== 'journal_entry';
    }).length
  , [selectedTransactionIds, filteredTransactions]);

  // Handler for bulk unimport
  const handleBulkUnimport = useCallback(async () => {
    const importedIds = Array.from(selectedTransactionIds).filter(id => {
      const txn = filteredTransactions.find(t => t.id === id);
      return txn && txn.imported_at && txn.source !== 'journal_entry';
    });
    
    if (importedIds.length === 0) {
      return;
    }
    
    await unimportTransactions.mutateAsync(importedIds);
    setSelectedTransactionIds(new Set());
  }, [selectedTransactionIds, filteredTransactions, unimportTransactions]);

  // Clear selection
  const clearSelection = () => setSelectedTransactionIds(new Set());

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing your credit cards.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  // Loading state
  if (orgLoading || cardsLoading || txLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Card not found
  if (!currentCard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CreditCard className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Credit Card Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The credit card you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate('/banking/credit-cards')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Credit Cards
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/banking/credit-cards')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{currentCard.name} Transactions</h1>
            <p className="text-muted-foreground">{currentCard.issuer} • {currentCard.card_number ? `•••• ${currentCard.card_number}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshRules}
            disabled={applyCCRules.isPending || activeRules.length === 0 || uncategorizedCount === 0}
            className="gap-2"
          >
            {applyCCRules.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Apply Rules
            {uncategorizedCount > 0 && activeRules.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                {uncategorizedCount}
              </span>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Quick Import (CSV/Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExtractionDialogOpen(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                AI Extraction Engine
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Charges</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalCharges, currentCard.currency || 'CAD')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPayments, currentCard.currency || 'CAD')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Transaction Count</p>
          <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="unmatched">Unmatched</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="reconciled">Reconciled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="charge">Charges</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
            </SelectContent>
          </Select>

          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{activeFiltersCount}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear Filters
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleContent className="pt-4 border-t mt-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        {customStartDate ? format(customStartDate, 'MMM d, yyyy') : 'Start Date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                      />
                    </PopoverContent>
                  </Popover>
                  <span className="text-muted-foreground">to</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        {customEndDate ? format(customEndDate, 'MMM d, yyyy') : 'End Date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min Amount"
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max Amount"
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedTransactionIds.size > 0 && (
        <Card className="p-4 border-primary/50 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary" />
              <span className="font-medium">
                {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected
              </span>
              {selectedImportedCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedImportedCount} can be unimported
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
              <Button 
                variant="outline"
                size="sm" 
                onClick={handleBulkUnimport}
                disabled={selectedImportedCount === 0 || unimportTransactions.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {unimportTransactions.isPending
                  ? 'Removing...' 
                  : `Unimport ${selectedImportedCount}`
                }
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedTransactionIds.size > 0 && selectedTransactionIds.size === filteredTransactions.filter(t => t.source !== 'journal_entry').length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTransactionIds(new Set(filteredTransactions.filter(t => t.source !== 'journal_entry').map(t => t.id)));
                    } else {
                      setSelectedTransactionIds(new Set());
                    }
                  }}
                  aria-label="Select all"
                />
              </TableHead>
              <SortableHeader field="transaction_date">Date</SortableHeader>
              <SortableHeader field="description">Description</SortableHeader>
              <SortableHeader field="payee_payor">Merchant</SortableHeader>
              <SortableHeader field="category">Category</SortableHeader>
              <SortableHeader field="amount" className="text-right">Amount</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-8 h-8" />
                    <p>No transactions found</p>
                    <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import Statement
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => {
                // Trust transaction_type set by classifyCreditCardType at import time.
                // Charges (incl. fee/interest) increase CC balance; payments/credits decrease it.
                const isPaymentOrCredit =
                  transaction.transaction_type === 'payment' ||
                  transaction.transaction_type === 'credit';
                const isCharge = !isPaymentOrCredit;
                // Check if transaction is reconciled (either by status or is_cleared flag)
                const isReconciled = transaction.is_cleared || transaction.status === 'reconciled';
                const effectiveStatus = isReconciled ? 'reconciled' : (transaction.status || 'pending');
                const statusInfo = statusConfig[effectiveStatus] || statusConfig.pending;
                const StatusIcon = statusInfo.icon;
                const isJESourced = transaction.source === 'journal_entry';
                const isSelected = selectedTransactionIds.has(transaction.id);
                
                return (
                  <TableRow key={transaction.id} className={cn(isSelected && "bg-primary/5")}>
                    <TableCell>
                      {!isJESourced ? (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedTransactionIds);
                            if (checked) {
                              newSet.add(transaction.id);
                            } else {
                              newSet.delete(transaction.id);
                            }
                            setSelectedTransactionIds(newSet);
                          }}
                          aria-label="Select transaction"
                        />
                      ) : (
                        <div className="w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatDate(transaction.transaction_date)}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.payee_payor || '—'}
                    </TableCell>
                    <TableCell>
                      {transaction.category ? (
                        <Badge variant="outline">{transaction.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-medium",
                      isCharge ? "text-destructive" : "text-green-600"
                    )}>
                      {/* For credit cards: charges are shown as negative (increasing balance), payments as positive (reducing balance) */}
                      {isCharge ? '-' : '+'}{formatCurrency(Math.abs(Number(transaction.amount)), currentCard.currency || 'CAD')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("gap-1", statusInfo.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </Badge>
                        {/* Source indicator: CC for credit card transaction, JE for journal entry */}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0",
                            transaction.source === 'journal_entry' 
                              ? "border-blue-400 text-blue-600 bg-blue-50" 
                              : "border-muted-foreground/30 text-muted-foreground"
                          )}
                        >
                          {transaction.source === 'journal_entry' ? 'JE' : 'CC'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          {isReconciled ? (
                            <>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </>
                          ) : (
                            <>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </>
                          )}
                        </Button>
                        {!isReconciled && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTransaction(transaction)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit & Post to GL
                              </DropdownMenuItem>
                              {/* Show Match option for pending payments - transaction_type can be 'payment' OR negative amount with payment-like description */}
                              {(transaction.transaction_type === 'payment' || 
                                (transaction.amount < 0) || 
                                (transaction.description?.toLowerCase().includes('payment'))) && 
                                transaction.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleOpenMatchDialog(transaction)}>
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Match Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Import Dialog */}
      <CreditCardImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        creditCard={currentCard}
        onImport={handleImport}
      />

      {/* Edit Transaction Dialog */}
      <EditCreditCardTransactionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        transaction={selectedTransaction}
        onSave={handleSaveTransaction}
      />

      {/* Statement Extraction Dialog */}
      <StatementExtractionDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        statementType="creditcard"
        onImport={handleExtractionImport}
        creditCardId={cardId}
      />

      {/* Match Payment Dialog */}
      <MatchPaymentDialog
        open={matchDialogOpen}
        onOpenChange={setMatchDialogOpen}
        sourceTransaction={matchSourceTransaction}
        allTransactions={transactions}
        onMatch={handleMatchTransactions}
      />
    </div>
  );
}
