import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Download, Upload, ArrowUpRight, ArrowDownLeft, Link2, Check, AlertCircle, Sparkles, Settings, MoreHorizontal, Wand2, Building2, Plus, Filter, Calendar, Edit, Send, X, CheckSquare, ArrowUpDown, ArrowUp, ArrowDown, CreditCard, Landmark, RefreshCw, Lock, Eye, FileSpreadsheet, Trash2, History } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TransactionRuleDialog from '@/components/banking/TransactionRuleDialog';
import AICategorizationDialog from '@/components/banking/AICategorizationDialog';
import TransactionExportDialog from '@/components/banking/TransactionExportDialog';
import { EditTransactionDialog } from '@/components/banking/EditTransactionDialog';
import { EditCreditCardTransactionDialog } from '@/components/banking/EditCreditCardTransactionDialog';
import { MatchPaymentDialog } from '@/components/banking/MatchPaymentDialog';
import { UnifiedImportDialog, ParsedBankTransaction, ParsedCreditCardTransaction } from '@/components/banking/UnifiedImportDialog';
import { StatementExtractionDialog } from '@/components/banking/StatementExtractionDialog';
import { BankStatementExtractor } from '@/components/banking/BankStatementExtractor';
import { AICategorizeDialog } from '@/components/banking/AICategorizeDialog';
import { ImportHistoryDialog } from '@/components/banking/ImportHistoryDialog';
import { RuleCondition, TransactionRule } from '@/types/bankingRules';
import { toast } from 'sonner';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useBankTransactions, BankTransaction } from '@/hooks/useBankTransactions';
import { useCreditCards, useCreditCardTransactions, CreditCardTransaction, ExtendedCreditCardTransaction } from '@/hooks/useCreditCards';
import { useBulkPostToGL } from '@/hooks/useBankingGL';
import { useBulkPostCreditCardToGL } from '@/hooks/useCreditCardGL';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { useTransactionRules } from '@/hooks/useTransactionRules';
import { analyzeTransactions, useProcessTransactions } from '@/hooks/useRuleAnalysis';
import { analyzeCCTransactions, useProcessCCTransactions } from '@/hooks/useCreditCardRuleAnalysis';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { classifyCreditCardType } from '@/lib/creditCardImportNormalizer';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { BankTxCardActions } from '@/components/banking/BankTxCardActions';

type SortField = 'transaction_date' | 'description' | 'payee_payor' | 'reference' | 'category' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';
type AccountType = 'bank' | 'credit-card';

// Unified transaction interface for display
interface UnifiedTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: string;
  category: string | null;
  payee_payor: string | null;
  reference: string | null;
  status: string;
  gl_account_id: string | null;
  journal_entry_id: string | null;
  source: AccountType;
  bank_account_id?: string;
  credit_card_id?: string;
}

export default function BankTransactions() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialAccountId = searchParams.get('account') || '';
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { accounts: bankAccounts, isLoading: bankAccountsLoading } = useBankAccounts();
  const { creditCards, isLoading: creditCardsLoading } = useCreditCards();
  const isReadOnly = useIsReadOnly();
  // Account type toggle (bank vs credit card)
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [selectedBankAccount, setSelectedBankAccount] = useState(initialAccountId);
  const [selectedCreditCard, setSelectedCreditCard] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [glPostedFilter, setGlPostedFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [aiExtractorOpen, setAiExtractorOpen] = useState(false);
  const [aiCategorizeOpen, setAiCategorizeOpen] = useState(false);
  const queryClient = useQueryClient();
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCCDialogOpen, setEditCCDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedCCTransaction, setSelectedCCTransaction] = useState<CreditCardTransaction | null>(null);
  const [ruleInitialConditions, setRuleInitialConditions] = useState<RuleCondition[]>([]);
  const [ruleInitialName, setRuleInitialName] = useState('');
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('transaction_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchSourceTransaction, setMatchSourceTransaction] = useState<ExtendedCreditCardTransaction | null>(null);

  // Hooks for bulk operations
  const bulkPostToGL = useBulkPostToGL();
  const bulkPostCcToGL = useBulkPostCreditCardToGL();
  const glAccountsQuery = useAccounts(organization?.id);
  const glAccounts = glAccountsQuery.data || [];
  
  // Transaction rules hooks
  const { rules, activeRules } = useTransactionRules();
  const processBankRules = useProcessTransactions();
  const processCcRules = useProcessCCTransactions();

  // Set default account when accounts load
  const effectiveBankAccountId = selectedBankAccount || bankAccounts[0]?.id || '';
  const effectiveCreditCardId = selectedCreditCard || creditCards[0]?.id || '';
  
  // Bank transactions hook
  const { 
    transactions: bankTransactions, 
    isLoading: bankTxLoading, 
    unmatchedTransactions: bankUnmatched,
    totalDeposits: bankDeposits,
    totalWithdrawals: bankWithdrawals,
    categorizeTransaction: categorizeBankTx,
    importTransactions: importBankTx,
    updateTransaction: updateBankTx,
    unimportTransactions: unimportBankTx,
  } = useBankTransactions(accountType === 'bank' ? effectiveBankAccountId : '');

  // Get the current credit card for display
  const currentCreditCard = creditCards.find(c => c.id === effectiveCreditCardId);

  // Credit card transactions hook - pass glAccountId to fetch unlinked JE payments
  const {
    transactions: ccTransactions,
    isLoading: ccTxLoading,
    unmatchedTransactions: ccUnmatched,
    totalCharges,
    totalPayments,
    importTransactions: importCcTx,
    updateTransaction: updateCcTx,
    categorizeTransaction: categorizeCcTx,
    unimportTransactions: unimportCcTx,
    matchPaymentTransactions,
  } = useCreditCardTransactions(
    accountType === 'credit-card' ? effectiveCreditCardId : undefined,
    currentCreditCard?.gl_account_id
  );

  // Unified transactions based on account type
  const transactions = accountType === 'bank' ? bankTransactions : ccTransactions;
  const isLoading = accountType === 'bank' ? bankTxLoading : ccTxLoading;
  const unmatchedTransactions = accountType === 'bank' ? bankUnmatched : ccUnmatched;

  // Get unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Localized currency and date formatting
  const { formatCurrency: formatLocalizedCurrency, formatDate: formatLocalizedDate, locale, terminology } = useLocalizedCurrency();
  
  const formatCurrency = (value: number) => {
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

  // Date range helper
  const getDateRangeFilter = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last-3-months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'this-year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return { start: customStartDate, end: customEndDate };
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
      
      // Status filter (expanded) - now checks is_cleared for reconciled
      let matchesStatus = true;
      const isReconciled = t.is_cleared || t.status === 'reconciled';
      switch (statusFilter) {
        case 'pending':
          matchesStatus = t.status === 'pending' && !isReconciled;
          break;
        case 'unmatched':
          matchesStatus = !isReconciled && !t.category && !t.journal_entry_id
            && !(t as any).matched_invoice_id && !(t as any).matched_bill_id;
          break;
        case 'matched':
          matchesStatus = !isReconciled && (!!t.category || !!t.journal_entry_id
            || !!(t as any).matched_invoice_id || !!(t as any).matched_bill_id);
          break;
        case 'reconciled':
          matchesStatus = isReconciled;
          break;
        case 'categorized':
          matchesStatus = !!t.category;
          break;
        case 'uncategorized':
          matchesStatus = !t.category;
          break;
        case 'gl-posted':
          matchesStatus = !!t.journal_entry_id;
          break;
        case 'gl-not-posted':
          matchesStatus = !t.journal_entry_id;
          break;
        case 'all':
        default:
          matchesStatus = true;
      }
      
      // Type filter
      const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      
      // GL Posted filter
      const matchesGLPosted = 
        glPostedFilter === 'all' ||
        (glPostedFilter === 'posted' && t.journal_entry_id) ||
        (glPostedFilter === 'not-posted' && !t.journal_entry_id);
      
      // Date range filter
      let matchesDate = true;
      if (dateFilter && dateFilter.start && dateFilter.end) {
        const txDate = parseISO(t.transaction_date);
        matchesDate = isWithinInterval(txDate, { start: dateFilter.start, end: dateFilter.end });
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
      
      return matchesSearch && matchesStatus && matchesType && matchesCategory && matchesGLPosted && matchesDate && matchesAmount;
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
          return dir * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [transactions, searchQuery, statusFilter, typeFilter, categoryFilter, glPostedFilter, getDateRangeFilter, amountMin, amountMax, sortField, sortDirection]);

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
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
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
    </th>
  );

  const unmatchedCount = unmatchedTransactions.length;
  const activeFiltersCount = [
    statusFilter !== 'all',
    typeFilter !== 'all',
    categoryFilter !== 'all',
    glPostedFilter !== 'all',
    dateRange !== 'all',
    amountMin !== '',
    amountMax !== '',
  ].filter(Boolean).length;

  // Selection helpers
  const selectableForGL = useMemo(() => 
    filteredTransactions.filter(t => t.category && t.gl_account_id && !t.journal_entry_id),
    [filteredTransactions]
  );

  const matchedNotPosted = useMemo(() => 
    filteredTransactions.filter(t => t.status === 'matched' && !t.journal_entry_id),
    [filteredTransactions]
  );

  const categorizedNotPosted = useMemo(() => 
    filteredTransactions.filter(t => t.category && !t.journal_entry_id),
    [filteredTransactions]
  );

  const selectedTransactions = useMemo(() => 
    filteredTransactions.filter(t => selectedTransactionIds.has(t.id)),
    [filteredTransactions, selectedTransactionIds]
  );

  const selectedPostableTransactions = useMemo(() => 
    selectedTransactions.filter(t => t.gl_account_id && !t.journal_entry_id),
    [selectedTransactions]
  );

  const allSelected = filteredTransactions.length > 0 && 
    filteredTransactions.every(t => selectedTransactionIds.has(t.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedTransactionIds(new Set());
    } else {
      setSelectedTransactionIds(new Set(filteredTransactions.map(t => t.id)));
    }
  }, [allSelected, filteredTransactions]);

  const toggleSelectTransaction = useCallback((id: string) => {
    setSelectedTransactionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectMatched = useCallback(() => {
    setSelectedTransactionIds(new Set(matchedNotPosted.map(t => t.id)));
  }, [matchedNotPosted]);

  const selectCategorized = useCallback(() => {
    setSelectedTransactionIds(new Set(categorizedNotPosted.map(t => t.id)));
  }, [categorizedNotPosted]);

  const selectReadyToPost = useCallback(() => {
    setSelectedTransactionIds(new Set(selectableForGL.map(t => t.id)));
  }, [selectableForGL]);

  const clearSelection = useCallback(() => {
    setSelectedTransactionIds(new Set());
  }, []);

  const handleBulkPostToGL = useCallback(async () => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }

    if (accountType === 'bank') {
      const transactionsToPost = selectedPostableTransactions
        .filter((t): t is BankTransaction => 'bank_account_id' in t)
        .map(t => ({
          transactionId: t.id,
          bankAccountId: t.bank_account_id,
          glAccountId: t.gl_account_id!,
          organizationId: organization.id,
          amount: Math.abs(Number(t.amount)),
          transactionType: t.transaction_type as 'deposit' | 'withdrawal',
          description: t.description,
          transactionDate: t.transaction_date,
          category: t.category || undefined,
          payeePayor: t.payee_payor || undefined,
          reference: t.reference || undefined,
        }));

      if (transactionsToPost.length === 0) {
        toast.error('No selected transactions are ready to post (need GL account assigned)');
        return;
      }

      await bulkPostToGL.mutateAsync(transactionsToPost);
    } else {
      // Credit card transactions
      const transactionsToPost = selectedPostableTransactions
        .filter((t): t is ExtendedCreditCardTransaction => 'credit_card_id' in t && 'source' in t)
        .map(t => ({
          transactionId: t.id,
          creditCardId: t.credit_card_id,
          glAccountId: t.gl_account_id!,
          organizationId: organization.id,
          amount: Math.abs(Number(t.amount)),
          transactionType: t.transaction_type as 'charge' | 'payment' | 'credit' | 'fee' | 'interest',
          description: t.description,
          transactionDate: t.transaction_date,
          category: t.category || undefined,
          payeePayor: t.payee_payor || undefined,
          reference: t.reference || undefined,
        }));

      if (transactionsToPost.length === 0) {
        toast.error('No selected transactions are ready to post (need GL account assigned)');
        return;
      }

      await bulkPostCcToGL.mutateAsync(transactionsToPost);
    }

    setSelectedTransactionIds(new Set());
  }, [organization?.id, accountType, selectedPostableTransactions, bulkPostToGL, bulkPostCcToGL]);

  // Handler to unimport selected transactions
  const handleBulkUnimport = useCallback(async () => {
    const selectedIds = Array.from(selectedTransactionIds);
    
    // Filter to only imported transactions (those with imported_at and not from JE source)
    const importedTransactionIds = filteredTransactions
      .filter(t => selectedTransactionIds.has(t.id) && t.imported_at)
      .map(t => t.id);
    
    if (importedTransactionIds.length === 0) {
      toast.error('No imported transactions selected. Only imported transactions can be removed.');
      return;
    }
    
    if (accountType === 'bank') {
      await unimportBankTx.mutateAsync(importedTransactionIds);
    } else {
      await unimportCcTx.mutateAsync(importedTransactionIds);
    }
    
    setSelectedTransactionIds(new Set());
  }, [accountType, selectedTransactionIds, filteredTransactions, unimportBankTx, unimportCcTx]);

  const clearAllFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setGlPostedFilter('all');
    setDateRange('all');
    setAmountMin('');
    setAmountMax('');
    setSearchQuery('');
  };

  // Generate rule conditions from a transaction's patterns
  const generateRuleFromTransaction = (transaction: BankTransaction) => {
    const conditions: RuleCondition[] = [];
    
    const descParts = transaction.description.split(/[\s\-]+/).filter(p => p.length > 2);
    const significantWords = descParts.filter(w => 
      !['PAYMENT', 'TRANSFER', 'WIRE', 'E-TRANSFER', 'PAD', 'INTERAC', 'THE', 'FOR', 'INC', 'LTD', 'LLC'].includes(w.toUpperCase())
    );
    
    if (significantWords.length > 0) {
      conditions.push({
        id: `cond-${Date.now()}-1`,
        field: 'description',
        operator: 'contains',
        value: significantWords[0].toUpperCase(),
      });
    } else if (descParts.length > 0) {
      conditions.push({
        id: `cond-${Date.now()}-1`,
        field: 'description',
        operator: 'contains',
        value: descParts[0].toUpperCase(),
      });
    }

    // Add payee/payor condition if available
    if (transaction.payee_payor) {
      conditions.push({
        id: `cond-${Date.now()}-payee`,
        field: 'payee_payor',
        operator: 'contains',
        value: transaction.payee_payor,
      });
    }

    conditions.push({
      id: `cond-${Date.now()}-2`,
      field: 'type',
      operator: transaction.transaction_type === 'deposit' ? 'is_deposit' : 'is_withdrawal',
      value: '',
    });

    const amount = Math.abs(Number(transaction.amount));
    const lowerBound = Math.floor(amount * 0.8);
    const upperBound = Math.ceil(amount * 1.2);
    conditions.push({
      id: `cond-${Date.now()}-3`,
      field: 'amount',
      operator: 'between',
      value: lowerBound.toString(),
      value2: upperBound.toString(),
    });

    const mainKeyword = transaction.payee_payor || significantWords[0] || descParts[0] || 'Transaction';
    const ruleName = `${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1).toLowerCase()} ${transaction.transaction_type === 'deposit' ? 'Deposits' : 'Payments'}`;

    setRuleInitialConditions(conditions);
    setRuleInitialName(ruleName);
    setCreateRuleDialogOpen(true);
  };

  const handleEditTransaction = (transaction: BankTransaction | CreditCardTransaction) => {
    if (accountType === 'bank' && 'bank_account_id' in transaction) {
      setSelectedTransaction(transaction as BankTransaction);
      setEditDialogOpen(true);
    } else if (accountType === 'credit-card' && 'credit_card_id' in transaction) {
      setSelectedCCTransaction(transaction as CreditCardTransaction);
      setEditCCDialogOpen(true);
    }
  };

  const handleSaveTransaction = (updates: Partial<BankTransaction>) => {
    if (updates.id && accountType === 'bank') {
      updateBankTx.mutate(updates as { id: string } & Partial<BankTransaction>);
    }
  };

  const handleSaveCCTransaction = (updates: Partial<CreditCardTransaction>) => {
    if (updates.id) {
      updateCcTx.mutate(updates as { id: string } & Partial<CreditCardTransaction>);
    }
  };

  // Handler for opening the match payment dialog
  const handleOpenMatchDialog = (transaction: ExtendedCreditCardTransaction) => {
    setMatchSourceTransaction(transaction);
    setMatchDialogOpen(true);
  };

  // Handler for matching CC transactions
  const handleMatchTransactions = async (sourceId: string, targetId: string) => {
    const sourceTransaction = ccTransactions.find(t => t.id === sourceId);
    const targetTransaction = ccTransactions.find(t => t.id === targetId);
    
    if (!sourceTransaction || !targetTransaction) return;
    
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

  // Apply transaction rules handler - uses the rules engine
  const handleApplyRules = useCallback(async () => {
    if (!organization?.id) return;
    
    if (accountType === 'bank') {
      // Apply rules to bank transactions
      const analysisResults = analyzeTransactions(bankTransactions, rules);
      const matched = analysisResults.filter(r => r.matchedRule !== null);
      
      if (matched.length === 0) {
        toast.info('No transactions matched any rules');
        return;
      }
      
      await processBankRules.mutateAsync({
        analysisResults: matched,
        organizationId: organization.id,
      });
    } else {
      // Apply rules to credit card transactions
      const analysisResults = analyzeCCTransactions(ccTransactions, rules);
      const matched = analysisResults.filter(r => r.matchedRule !== null);
      
      if (matched.length === 0) {
        toast.info('No transactions matched any rules');
        return;
      }
      
      await processCcRules.mutateAsync({
        analysisResults: matched,
        organizationId: organization.id,
        creditCardId: effectiveCreditCardId,
      });
    }
  }, [organization?.id, accountType, bankTransactions, ccTransactions, rules, processBankRules, processCcRules, effectiveCreditCardId]);

  const isApplyingRules = processBankRules.isPending || processCcRules.isPending;

  const handleAIApply = (results: Array<{ transactionId: string; suggestedCategory: string; suggestedGLAccount: { id: string; code: string; name: string } }>) => {
    const categorize = accountType === 'bank' ? categorizeBankTx : categorizeCcTx;
    results.forEach(result => {
      categorize.mutate({ 
        id: result.transactionId, 
        category: result.suggestedCategory,
        gl_account_id: result.suggestedGLAccount.id,
        ...(accountType === 'bank' && { postToGL: true, organizationId: organization?.id }),
      } as any);
    });
    toast.success(`AI categorized ${results.length} transaction${results.length !== 1 ? 's' : ''}`);
  };

  const handleBankImport = async (imported: ParsedBankTransaction[]) => {
    if (!effectiveBankAccountId) {
      toast.error('Please select a bank account first');
      throw new Error('No bank account selected');
    }
    
    // Get the GL account from the selected bank account
    const selectedBankAcc = bankAccounts.find(a => a.id === effectiveBankAccountId);
    const bankGlAccountId = selectedBankAcc?.gl_account_id || null;
    
    await importBankTx.mutateAsync(
      imported.map(tx => ({
        bank_account_id: effectiveBankAccountId,
        gl_account_id: bankGlAccountId,
        transaction_date: tx.date,
        description: tx.description,
        amount: tx.amount,
        transaction_type: tx.type,
        payee_payor: tx.payee_payor,
        reference: tx.reference,
      }))
    );
    setImportDialogOpen(false);
  };

  const handleCcImport = async (imported: ParsedCreditCardTransaction[]) => {
    if (!effectiveCreditCardId) {
      toast.error('Please select a credit card first');
      throw new Error('No credit card selected');
    }

    // Get the GL account from the selected credit card
    const selectedCard = creditCards.find(c => c.id === effectiveCreditCardId);
    const creditCardGlAccountId = selectedCard?.gl_account_id || null;

    await importCcTx.mutateAsync(
      imported.map(tx => ({
        credit_card_id: effectiveCreditCardId,
        transaction_date: tx.date,
        description: tx.description,
        amount: tx.amount,
        transaction_type: tx.type,
        payee_payor: tx.payee_payor || null,
        reference: tx.reference || null,
        posted_date: null,
        category: null,
        merchant_category_code: null,
        memo: null,
        is_cleared: false,
        cleared_at: null,
        gl_account_id: creditCardGlAccountId,
        journal_entry_id: null,
        status: 'pending' as const,
        imported_at: new Date().toISOString(),
      }))
    );
    setImportDialogOpen(false);
  };

  const handleSaveRule = (rule: Partial<TransactionRule>) => {
    toast.success(`Rule "${rule.name}" created successfully`);
    setCreateRuleDialogOpen(false);
  };

  // Track which statement type is being imported (for extraction dialog)
  const [extractionStatementType, setExtractionStatementType] = useState<'bank' | 'creditcard'>('bank');

  const handleExtractionImport = (data: Record<string, unknown>[]) => {
    // Use the extraction statement type, not the current UI tab
    const importType = extractionStatementType;
    
    if (importType === 'bank' && effectiveBankAccountId) {
      // Get the GL account from the selected bank account
      const selectedBankAcc = bankAccounts.find(a => a.id === effectiveBankAccountId);
      const bankGlAccountId = selectedBankAcc?.gl_account_id || null;
      
      const mappedTransactions = data.map(tx => {
        const rawAmount = Number(tx.amount ?? 0);
        const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;

        const transactionDate = String(
          tx.transaction_date ||
          tx.date ||
          new Date().toISOString().split('T')[0]
        );

        // Normalize payee/payor from multiple possible field names
        const payeePayor =
          tx.payee_payor ??
          tx.merchant_name ??
          tx.merchant ??
          tx.payee ??
          tx.payor ??
          null;

        const isDeposit =
          typeof tx.type === 'string'
            ? String(tx.type).toLowerCase() === 'deposit'
            : rawAmount >= 0;

        return {
          bank_account_id: effectiveBankAccountId,
          gl_account_id: bankGlAccountId,
          transaction_date: transactionDate,
          description: String(tx.description || ''),
          amount,
          transaction_type: (isDeposit ? 'deposit' : 'withdrawal') as 'deposit' | 'withdrawal',
          payee_payor: payeePayor ? String(payeePayor) : null,
          reference: tx.reference ? String(tx.reference) : null,
          category: tx.category ? String(tx.category) : null,
          memo: tx.memo ? String(tx.memo) : null,
        };
      });
      importBankTx.mutate(mappedTransactions);
      toast.success(`Imported ${data.length} bank transactions`);
    } else if (importType === 'creditcard' && effectiveCreditCardId) {
      // Get the GL account from the selected credit card
      const selectedCard = creditCards.find(c => c.id === effectiveCreditCardId);
      const creditCardGlAccountId = selectedCard?.gl_account_id || null;
      
      const mappedTransactions = data.map(tx => {
        const rawAmount = Number(tx.amount ?? 0);
        const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;

        // Credit cards: POSITIVE = charge, NEGATIVE = payment. Explicit type wins.
        const transactionType = classifyCreditCardType(
          rawAmount,
          typeof tx.type === 'string' ? (tx.type as string) : '',
          typeof tx.description === 'string' ? (tx.description as string) : '',
        );


        const transactionDate = String(
          tx.transaction_date ||
          tx.date ||
          new Date().toISOString().split('T')[0]
        );

        // Normalize payee/payor from multiple possible field names
        const payeePayor =
          tx.payee_payor ??
          tx.merchant_name ??
          tx.merchant ??
          tx.payee ??
          tx.payor ??
          null;

        const postedDate = String(tx.posted_date ?? tx.posting_date ?? '') || null;

        return {
          credit_card_id: effectiveCreditCardId,
          transaction_date: transactionDate,
          posted_date: postedDate,
          description: String(tx.description || ''),
          amount,
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
      importCcTx.mutate(mappedTransactions);
      toast.success(`Imported ${data.length} credit card transactions`);
    } else {
      // Handle case where no account is selected for the import type
      if (importType === 'creditcard' && !effectiveCreditCardId) {
        toast.error('No credit card selected. Please select a credit card first.');
      } else if (importType === 'bank' && !effectiveBankAccountId) {
        toast.error('No bank account selected. Please select a bank account first.');
      }
    }
    setExtractionDialogOpen(false);
  };

  // Handler to open extraction dialog with correct type tracking
  const openExtractionDialog = (type: 'bank' | 'creditcard') => {
    setExtractionStatementType(type);
    setExtractionDialogOpen(true);
  };

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing bank transactions.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (orgLoading || bankAccountsLoading || creditCardsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (bankAccounts.length === 0 && creditCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Accounts Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Add a bank account or credit card to manage transactions.
        </p>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button onClick={() => navigate('/banking/accounts')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Bank Account
            </Button>
            <Button variant="outline" onClick={() => navigate('/banking/credit-cards')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Credit Card
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {accountType === 'bank' ? 'Bank Transactions' : 'Credit Card Transactions'}
          </h1>
          <p className="text-muted-foreground">
            Review and categorize {accountType === 'bank' ? 'bank' : 'credit card'} transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && unmatchedCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setAiDialogOpen(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Categorize ({unmatchedCount})
            </Button>
          )}
          {!isReadOnly && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleApplyRules}
              disabled={isApplyingRules || activeRules.length === 0}
              className="gap-2"
            >
              {isApplyingRules ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Apply Rules
              {activeRules.length > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {activeRules.length}
                </span>
              )}
            </Button>
          )}
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => navigate('/banking/rules')}>
              <Settings className="w-4 h-4 mr-2" />
              AI Rules
            </Button>
          )}
          {!isReadOnly && (
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
                <DropdownMenuItem onClick={() => openExtractionDialog(accountType === 'bank' ? 'bank' : 'creditcard')}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Extraction Engine
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAiExtractorOpen(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract from PDF (Gemini)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setImportHistoryOpen(true)}>
              <History className="w-4 h-4 mr-2" />
              Import History
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Account Type Tabs */}
      <Tabs value={accountType} onValueChange={(v) => setAccountType(v as AccountType)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50">
          <TabsTrigger 
            value="bank" 
            className="gap-2 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 data-[state=active]:border-amber-300 data-[state=active]:border"
          >
            <Landmark className="w-4 h-4" />
            Bank Accounts
          </TabsTrigger>
          <TabsTrigger 
            value="credit-card" 
            className="gap-2 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-300 data-[state=active]:border"
          >
            <CreditCard className="w-4 h-4" />
            Credit Cards
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      {(() => {
        type Tx = (typeof transactions)[number];
        const sumAbs = (arr: Tx[]) =>
          arr.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
        const txs = transactions as Tx[];
        const isReconciled = (t: Tx) => t.is_cleared || t.status === 'reconciled';
        const hasMatch = (t: Tx) =>
          !!t.category || !!t.journal_entry_id || !!(t as any).matched_invoice_id || !!(t as any).matched_bill_id;
        const reconciledTx = txs.filter(isReconciled);
        const matchedTx = txs.filter(t => !isReconciled(t) && hasMatch(t));
        const unmatchedTx = txs.filter(t => !isReconciled(t) && !hasMatch(t));
        const matchedNotPostedTx = matchedTx.filter(t => !t.journal_entry_id);
        const postedTx = txs.filter(t => hasMatch(t) && !!t.journal_entry_id);
        const inflowTx = txs.filter(t => Number(t.amount) > 0);
        const outflowTx = txs.filter(t => Number(t.amount) < 0);
        const inflow = accountType === 'bank' ? bankDeposits : totalPayments;
        const outflow = accountType === 'bank' ? bankWithdrawals : totalCharges;
        const net = inflow - outflow;
        const postedPct = transactions.length ? Math.round((postedTx.length / transactions.length) * 100) : 0;
        const inflowLabel = accountType === 'bank' ? 'Deposits' : 'Payments';
        const outflowLabel = accountType === 'bank' ? 'Withdrawals' : 'Charges';

        const clickable = "cursor-pointer transition hover:ring-2 hover:ring-primary/30";

        // Map transactions to the export row shape
        const toRows = (arr: Tx[]) =>
          arr.map(t => ({
            date: String(t.transaction_date ?? ''),
            description: String(t.description ?? ''),
            payee: String((t as any).payee_payor ?? ''),
            category: String(t.category ?? ''),
            reference: String((t as any).reference ?? ''),
            amount: Number(t.amount) || 0,
            status: String(t.status ?? (isReconciled(t) ? 'reconciled' : hasMatch(t) ? 'matched' : 'unmatched')),
          }));

        const orgName = organization?.name;

        return (
          <div className="space-y-4">
            {/* Row 1 — Volume & status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 relative">
                <BankTxCardActions
                  title="Total Transactions"
                  snapshot={`Count: ${transactions.length}\nVolume (abs): ${formatCurrency(sumAbs(transactions))}`}
                  rows={toRows(txs)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-foreground">{transactions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sumAbs(transactions))} volume</p>
              </Card>
              <Card
                className={cn("p-4 relative", clickable)}
                onClick={() => { setStatusFilter('unmatched'); setGlPostedFilter('all'); }}
                role="button"
                tabIndex={0}
              >
                <BankTxCardActions
                  title="Unmatched Transactions"
                  snapshot={`Count: ${unmatchedTx.length}\nValue (abs): ${formatCurrency(sumAbs(unmatchedTx))}`}
                  rows={toRows(unmatchedTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Unmatched</p>
                <p className="text-2xl font-bold text-warning">{unmatchedTx.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sumAbs(unmatchedTx))}</p>
              </Card>
              <Card
                className={cn("p-4 relative", clickable)}
                onClick={() => { setStatusFilter('matched'); setGlPostedFilter('not-posted'); }}
                role="button"
                tabIndex={0}
              >
                <BankTxCardActions
                  title="Matched Transactions"
                  snapshot={`Total matched: ${matchedTx.length} · ${formatCurrency(sumAbs(matchedTx))}\nNot posted: ${matchedNotPostedTx.length} · ${formatCurrency(sumAbs(matchedNotPostedTx))}`}
                  rows={toRows(matchedTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Matched</p>
                <p className="text-2xl font-bold text-blue-600">{matchedTx.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(sumAbs(matchedTx))}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {matchedNotPostedTx.length} not posted · {formatCurrency(sumAbs(matchedNotPostedTx))}
                </p>
              </Card>
              <Card
                className={cn("p-4 relative", clickable)}
                onClick={() => { setStatusFilter('reconciled'); setGlPostedFilter('all'); }}
                role="button"
                tabIndex={0}
              >
                <BankTxCardActions
                  title="Reconciled Transactions"
                  snapshot={`Count: ${reconciledTx.length}\nValue (abs): ${formatCurrency(sumAbs(reconciledTx))}`}
                  rows={toRows(reconciledTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Reconciled</p>
                <p className="text-2xl font-bold text-success">{reconciledTx.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sumAbs(reconciledTx))}</p>
              </Card>
            </div>

            {/* Row 2 — Money flow & GL health */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 relative">
                <BankTxCardActions
                  title={inflowLabel}
                  snapshot={`Count: ${inflowTx.length}\nTotal: ${formatCurrency(inflow)}`}
                  rows={toRows(inflowTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">{inflowLabel}</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(inflow)}</p>
                <p className="text-xs text-muted-foreground mt-1">{inflowTx.length} transactions</p>
              </Card>
              <Card className="p-4 relative">
                <BankTxCardActions
                  title={outflowLabel}
                  snapshot={`Count: ${outflowTx.length}\nTotal: ${formatCurrency(outflow)}`}
                  rows={toRows(outflowTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">{outflowLabel}</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(outflow)}</p>
                <p className="text-xs text-muted-foreground mt-1">{outflowTx.length} transactions</p>
              </Card>
              <Card className="p-4 relative">
                <BankTxCardActions
                  title="Net Activity"
                  snapshot={`${inflowLabel}: ${formatCurrency(inflow)}\n${outflowLabel}: ${formatCurrency(outflow)}\nNet: ${net >= 0 ? '+' : '-'}${formatCurrency(Math.abs(net))}`}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Net Activity</p>
                <p className={cn("text-2xl font-bold", net >= 0 ? "text-success" : "text-destructive")}>
                  {net >= 0 ? '+' : '−'}{formatCurrency(net)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{inflowLabel} − {outflowLabel}</p>
              </Card>
              <Card
                className={cn("p-4 relative", clickable)}
                onClick={() => { setGlPostedFilter('posted'); }}
                role="button"
                tabIndex={0}
              >
                <BankTxCardActions
                  title="Posted to GL"
                  snapshot={`Posted: ${postedTx.length} of ${transactions.length} (${postedPct}%)\nValue: ${formatCurrency(sumAbs(postedTx))}`}
                  rows={toRows(postedTx)}
                  organizationName={orgName}
                  formatCurrency={formatCurrency}
                />
                <p className="text-sm text-muted-foreground mb-1">Posted to GL</p>
                <p className="text-2xl font-bold text-foreground">
                  {postedTx.length}<span className="text-sm font-normal text-muted-foreground">/{transactions.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sumAbs(postedTx))} posted</p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success transition-all" style={{ width: `${postedPct}%` }} />
                </div>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          {/* Primary Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            {accountType === 'bank' ? (
              <Select value={effectiveBankAccountId} onValueChange={setSelectedBankAccount}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} {account.account_number ? `****${account.account_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={effectiveCreditCardId} onValueChange={setSelectedCreditCard}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Select credit card" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map(card => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} {card.card_number ? `****${card.card_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions, payee, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="categorized">Categorized</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                <SelectItem value="gl-posted">Posted to GL</SelectItem>
                <SelectItem value="gl-not-posted">Not Posted to GL</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant={showAdvancedFilters ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          <Collapsible open={showAdvancedFilters}>
            <CollapsibleContent className="pt-4 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {/* Type Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposit">Deposits</SelectItem>
                      <SelectItem value="withdrawal">Withdrawals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* GL Posted Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">GL Status</label>
                  <Select value={glPostedFilter} onValueChange={setGlPostedFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="posted">Posted to GL</SelectItem>
                      <SelectItem value="not-posted">Not Posted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filter */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date Range</label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Time" />
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
                </div>

                {/* Amount Min */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Amount</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                  />
                </div>

                {/* Amount Max */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Amount</label>
                  <Input
                    type="number"
                    placeholder="999999.99"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                  />
                </div>
              </div>

              {/* Custom Date Range */}
              {dateRange === 'custom' && (
                <div className="flex items-center gap-4 mt-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-40 justify-start text-left font-normal">
                          <Calendar className="w-4 h-4 mr-2" />
                          {customStartDate ? format(customStartDate, 'PP') : 'Pick date'}
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
                  </div>
                  <span className="text-muted-foreground">to</span>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-40 justify-start text-left font-normal">
                          <Calendar className="w-4 h-4 mr-2" />
                          {customEndDate ? format(customEndDate, 'PP') : 'Pick date'}
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
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Results count and bulk selection */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Quick select:</span>
            <Button variant="outline" size="sm" onClick={selectMatched} disabled={matchedNotPosted.length === 0}>
              Matched ({matchedNotPosted.length})
            </Button>
            <Button variant="outline" size="sm" onClick={selectCategorized} disabled={categorizedNotPosted.length === 0}>
              Categorized ({categorizedNotPosted.length})
            </Button>
            <Button variant="outline" size="sm" onClick={selectReadyToPost} disabled={selectableForGL.length === 0}>
              Ready to Post ({selectableForGL.length})
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedTransactionIds.size > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CheckSquare className="w-5 h-5 text-primary" />
              <span className="font-medium">
                {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected
              </span>
              {selectedPostableTransactions.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedPostableTransactions.length} ready to post
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
                disabled={unimportBankTx.isPending || unimportCcTx.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {unimportBankTx.isPending || unimportCcTx.isPending
                  ? 'Removing...' 
                  : 'Unimport Selected'
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAiCategorizeOpen(true)}
                disabled={filteredTransactions.length === 0}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Categorize
              </Button>
              <Button 
                size="sm" 
                onClick={handleBulkPostToGL}
                disabled={selectedPostableTransactions.length === 0 || bulkPostToGL.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {bulkPostToGL.isPending 
                  ? 'Posting...' 
                  : `Post ${selectedPostableTransactions.length} to GL`
                }
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Transactions List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {transactions.length === 0 ? 'No transactions yet. Import some to get started.' : 'No transactions match your filters.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="w-12"></th>
                <SortableHeader field="transaction_date">Date</SortableHeader>
                <SortableHeader field="description">Description</SortableHeader>
                <SortableHeader field="payee_payor">Payee/Payor</SortableHeader>
                <SortableHeader field="reference">Reference</SortableHeader>
                <SortableHeader field="category">Category</SortableHeader>
                <th>GL Account</th>
                <th>GL Posted</th>
                <SortableHeader field="amount">
                  <span className="flex justify-end w-full">Amount</span>
                </SortableHeader>
                <SortableHeader field="status">Status</SortableHeader>
                <th className="w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
            {filteredTransactions.map((transaction) => {
                // Check if transaction is reconciled (either by status or is_cleared flag)
                const isReconciled = transaction.is_cleared || transaction.status === 'reconciled';
                const effectiveStatus = isReconciled ? 'reconciled' : transaction.status;
                const status = statusConfig[effectiveStatus] || statusConfig['unmatched'];
                const StatusIcon = status.icon;
                const isSelected = selectedTransactionIds.has(transaction.id);
                
                return (
                  <tr 
                    key={transaction.id} 
                    className={cn(
                      "hover:bg-muted/20",
                      isSelected && "bg-primary/5"
                    )}
                  >
                    <td className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectTransaction(transaction.id)}
                        aria-label={`Select transaction ${transaction.description}`}
                      />
                    </td>
                    <td>
                      {(() => {
                        // For credit cards: payments reduce balance (positive), charges increase (negative)
                        // For banks: deposits are positive, withdrawals are negative
                        const isPositiveFlow = accountType === 'credit-card' 
                          ? (transaction.transaction_type === 'payment' || 
                             transaction.transaction_type === 'credit' ||
                             transaction.description?.toLowerCase().includes('payment') ||
                             transaction.description?.toLowerCase().includes('paiement') ||
                             Number(transaction.amount) < 0)
                          : transaction.transaction_type === 'deposit';
                        return (
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isPositiveFlow ? "bg-success/10" : "bg-muted"
                          )}>
                            {isPositiveFlow ? (
                              <ArrowDownLeft className="w-4 h-4 text-success" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-muted-foreground">{formatDate(transaction.transaction_date)}</td>
                    <td>
                      <p className="font-medium text-foreground">{transaction.description}</p>
                    </td>
                    <td className="text-muted-foreground">
                      {transaction.payee_payor || '-'}
                    </td>
                    <td className="text-muted-foreground text-xs font-mono">
                      {transaction.reference || '-'}
                    </td>
                    <td className="text-muted-foreground">
                      {transaction.category || '-'}
                    </td>
                    <td>
                      {(() => {
                        const glAcc = transaction.gl_account_id 
                          ? glAccounts.find(a => a.id === transaction.gl_account_id) 
                          : null;
                        return glAcc ? (
                          <span className="text-xs">
                            <span className="font-mono text-primary/70">{glAcc.code}</span>
                            <span className="text-muted-foreground ml-1 hidden lg:inline">{glAcc.name}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        );
                      })()}
                    </td>
                    <td>
                      {transaction.journal_entry_id ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Check className="w-3 h-3" />
                          Posted
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className={cn(
                      "text-right font-mono font-medium",
                      (() => {
                        // For credit cards: payments reduce balance (positive/green), charges increase (negative)
                        // For banks: deposits are positive/green, withdrawals are foreground
                        const isPositiveFlow = accountType === 'credit-card' 
                          ? (transaction.transaction_type === 'payment' || 
                             transaction.transaction_type === 'credit' ||
                             transaction.description?.toLowerCase().includes('payment') ||
                             transaction.description?.toLowerCase().includes('paiement') ||
                             Number(transaction.amount) < 0)
                          : transaction.transaction_type === 'deposit';
                        return isPositiveFlow ? "text-success" : "text-foreground";
                      })()
                    )}>
                      {(() => {
                        // For credit cards: payments show as + (reducing balance), charges as - (increasing balance)
                        // For banks: deposits as +, withdrawals as -
                        const isPositiveFlow = accountType === 'credit-card' 
                          ? (transaction.transaction_type === 'payment' || 
                             transaction.transaction_type === 'credit' ||
                             transaction.description?.toLowerCase().includes('payment') ||
                             transaction.description?.toLowerCase().includes('paiement') ||
                             Number(transaction.amount) < 0)
                          : transaction.transaction_type === 'deposit';
                        return `${isPositiveFlow ? '+' : '-'}${formatCurrency(Math.abs(Number(transaction.amount)))}`;
                      })()}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("gap-1", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                        {/* Source indicator for credit card transactions */}
                        {accountType === 'credit-card' && 'source' in transaction && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] font-semibold px-1.5 py-0",
                              (transaction as ExtendedCreditCardTransaction).source === 'journal_entry' 
                                ? "border-blue-400 text-blue-600 bg-blue-50" 
                                : "border-muted-foreground/30 text-muted-foreground"
                            )}
                          >
                            {(transaction as ExtendedCreditCardTransaction).source === 'journal_entry' ? 'JE' : 'CC'}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          {isReconciled ? (
                            <>
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </>
                          ) : (
                            <>
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </>
                          )}
                        </Button>
                        {!isReconciled && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditTransaction(transaction)}>
                                <Send className="w-4 h-4 mr-2" />
                                Edit & Post to GL
                              </DropdownMenuItem>
                              {/* Show Match Payment option for credit card pending payments */}
                              {accountType === 'credit-card' && 
                                (transaction.transaction_type === 'payment' || 
                                 transaction.amount < 0 || 
                                 transaction.description?.toLowerCase().includes('payment')) && 
                                transaction.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleOpenMatchDialog(transaction as ExtendedCreditCardTransaction)}>
                                  <Link2 className="w-4 h-4 mr-2" />
                                  Match Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                                if (accountType === 'bank' && 'bank_account_id' in transaction) {
                                  generateRuleFromTransaction(transaction as BankTransaction);
                                } else {
                                  toast.info('Rule creation for credit cards coming soon');
                                }
                              }}>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Create Rule from This
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* AI Categorization Dialog */}
      <AICategorizationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        transactions={unmatchedTransactions.map(t => ({
          id: t.id,
          date: parseLocalDate(t.transaction_date),
          description: t.description,
          amount: Number(t.amount),
          type: t.transaction_type,
          status: t.status,
          category: t.category || undefined,
        }))}
        onApply={handleAIApply}
      />

      {/* Unified Import Dialog */}
      <UnifiedImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        accountType={accountType}
        accountName={accountType === 'bank' 
          ? (bankAccounts.find(a => a.id === effectiveBankAccountId)?.name || 'Bank Account')
          : (currentCreditCard?.name || 'Credit Card')
        }
        onImportBank={handleBankImport}
        onImportCreditCard={handleCcImport}
        isImporting={importBankTx.isPending || importCcTx.isPending}
      />

      {/* Export Dialog */}
      <TransactionExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        transactions={transactions.map(t => ({
          id: t.id,
          date: parseLocalDate(t.transaction_date),
          description: t.description,
          amount: Number(t.amount),
          type: t.transaction_type,
          status: t.status,
          is_cleared: t.is_cleared,
          journal_entry_id: t.journal_entry_id,
          category: t.category || undefined,
          matchedTo: t.reference || undefined,
        }))}

        accountName={
          accountType === 'bank' 
            ? bankAccounts.find(a => a.id === effectiveBankAccountId)?.name || 'Bank Account'
            : creditCards.find(c => c.id === effectiveCreditCardId)?.name || 'Credit Card'
        }
      />

      {/* Create Rule Dialog */}
      <TransactionRuleDialog
        open={createRuleDialogOpen}
        onOpenChange={setCreateRuleDialogOpen}
        onSave={handleSaveRule}
        initialConditions={ruleInitialConditions}
        initialName={ruleInitialName}
      />

      {/* Edit Transaction Dialog */}
      <EditTransactionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        transaction={selectedTransaction}
        onSave={handleSaveTransaction}
      />

      {/* Edit Credit Card Transaction Dialog */}
      <EditCreditCardTransactionDialog
        open={editCCDialogOpen}
        onOpenChange={setEditCCDialogOpen}
        transaction={selectedCCTransaction}
        onSave={handleSaveCCTransaction}
      />

      {/* Statement Extraction Dialog */}
      <StatementExtractionDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        statementType={extractionStatementType}
        onImport={handleExtractionImport}
        bankAccountId={effectiveBankAccountId}
        creditCardId={effectiveCreditCardId}
      />

      {/* Phase 2 — Gemini-powered statement extractor */}
      <BankStatementExtractor
        open={aiExtractorOpen}
        onOpenChange={setAiExtractorOpen}
        defaultBankAccountId={effectiveBankAccountId}
      />

      {/* Phase 3 — AI categorization */}
      <AICategorizeDialog
        open={aiCategorizeOpen}
        onOpenChange={setAiCategorizeOpen}
        transactions={
          (selectedTransactions.length > 0
            ? selectedTransactions
            : filteredTransactions.filter((t) => !t.gl_account_id)
          ).map((t) => ({
            id: t.id,
            description: t.description ?? null,
            amount: t.amount as number,
            transaction_type: t.transaction_type ?? null,
            payee_payor: (t as { payee_payor?: string | null }).payee_payor ?? null,
          }))
        }
        onApplied={() => {
          void refetchBankTx?.();
          void refetchCcTx?.();
        }}
      />

      {/* Match Payment Dialog for Credit Cards */}
      <MatchPaymentDialog
        open={matchDialogOpen}
        onOpenChange={setMatchDialogOpen}
        sourceTransaction={matchSourceTransaction}
        allTransactions={ccTransactions}
        onMatch={handleMatchTransactions}
      />

      {/* Import History Dialog */}
      <ImportHistoryDialog
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        accountType={accountType}
        bankAccountId={effectiveBankAccountId}
        creditCardId={effectiveCreditCardId}
        isUndoing={unimportBankTx.isPending || unimportCcTx.isPending}
        onUndoBatch={async (ids) => {
          if (accountType === 'bank') {
            await unimportBankTx.mutateAsync(ids);
          } else {
            await unimportCcTx.mutateAsync(ids);
          }
        }}
      />
    </div>
  );
}
