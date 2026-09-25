import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Check, AlertTriangle, Download, CreditCard, Loader2, Plus, Pencil, ArrowUpDown, Filter, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useCreditCardReconciliation } from '@/hooks/useCreditCardReconciliation';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { downloadReconciliationPdf } from '@/lib/generateReconciliationPdf';
import { ReconciliationShareActions } from '@/components/reports/ReconciliationShareActions';
import { format } from 'date-fns';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

type ClearedFilter = 'all' | 'cleared' | 'uncleared';
type SortField = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';

export default function CreditCardReconciliation() {
  const { cardId } = useParams<{ cardId: string }>();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { creditCards, isLoading: cardsLoading } = useCreditCards();
  
  // Localization
  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);
  
  const [selectedCardId, setSelectedCardId] = useState<string>(cardId || '');
  const [statementDate, setStatementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statementBalance, setStatementBalance] = useState('');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [isEditingStatement, setIsEditingStatement] = useState(false);

  // Date range filter for reconciliation period
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filters & Sorting
  const [clearedFilter, setClearedFilter] = useState<ClearedFilter>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const {
    transactions,
    currentReconciliation,
    openingBalance,
    bookBalanceAsOfStatementDate,
    isLoading: reconciliationLoading,
    clearedCharges,
    clearedPayments,
    unclearedCharges,
    unclearedPayments,
    clearedCount,
    totalCount,
    startReconciliation,
    updateReconciliation,
    toggleCleared,
    completeReconciliation,
    updateCreditCard,
    selectedCard,
  } = useCreditCardReconciliation(selectedCardId, statementDate);

  // Set card from URL param or first card
  useEffect(() => {
    if (cardId) {
      setSelectedCardId(cardId);
    } else if (creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [cardId, creditCards, selectedCardId]);

  // Set statement balance from current reconciliation
  useEffect(() => {
    if (currentReconciliation) {
      setStatementBalance(currentReconciliation.statement_balance.toString());
      setStatementDate(currentReconciliation.statement_date);
    }
  }, [currentReconciliation]);

  // Set opening balance field
  useEffect(() => {
    if (openingBalance !== undefined) {
      setOpeningBalanceInput(openingBalance.toString());
    }
  }, [openingBalance, selectedCardId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateShort = (dateStr: string) => {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(parseLocalDate(dateStr));
  };

  const handleToggleCleared = (transactionId: string, currentCleared: boolean) => {
    toggleCleared.mutate({ transactionId, cleared: !currentCleared });
  };

  const handleClearAll = (useFiltered = false) => {
    const items = useFiltered ? filteredTransactions : transactions;
    items.forEach(t => {
      if (!t.is_cleared) {
        toggleCleared.mutate({ transactionId: t.id, cleared: true });
      }
    });
  };

  const handleUnclearAll = (useFiltered = false) => {
    const items = useFiltered ? filteredTransactions : transactions;
    items.forEach(t => {
      if (t.is_cleared) {
        toggleCleared.mutate({ transactionId: t.id, cleared: false });
      }
    });
  };

  // Date-filtered transactions (before cleared status filter)
  const dateFilteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Date range filter
    if (startDate) {
      filtered = filtered.filter(t => t.transaction_date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(t => t.transaction_date <= endDate);
    }
    
    return filtered;
  }, [transactions, startDate, endDate]);

  // Calculate cleared totals from date-filtered transactions only
  const { localClearedCharges, localClearedPayments, localUnclearedCharges, localUnclearedPayments } = useMemo(() => {
    const cleared = dateFilteredTransactions.filter(t => t.is_cleared);
    const uncleared = dateFilteredTransactions.filter(t => !t.is_cleared);
    
    return {
      localClearedCharges: cleared.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      localClearedPayments: cleared.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      localUnclearedCharges: uncleared.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      localUnclearedPayments: uncleared.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    };
  }, [dateFilteredTransactions]);

  // Filtered and sorted transactions (for display)
  const filteredTransactions = useMemo(() => {
    let filtered = dateFilteredTransactions;
    
    // Cleared status filter
    if (clearedFilter === 'cleared') {
      filtered = filtered.filter(t => t.is_cleared);
    } else if (clearedFilter === 'uncleared') {
      filtered = filtered.filter(t => !t.is_cleared);
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = parseLocalDate(a.transaction_date).getTime() - parseLocalDate(b.transaction_date).getTime();
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount;
      } else if (sortField === 'description') {
        cmp = (a.description || '').localeCompare(b.description || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [dateFilteredTransactions, clearedFilter, sortField, sortDir]);

  const bookBalance = currentReconciliation
    ? (bookBalanceAsOfStatementDate ?? selectedCard?.current_balance ?? 0)
    : (selectedCard?.current_balance ?? 0);
  const statementBalanceNum = statementBalance.trim() ? parseFloat(statementBalance) : null;

  // Opening balance - use absolute value since credit card balances represent amounts owed
  const openingBalanceNum = openingBalanceInput.trim() ? Math.abs(parseFloat(openingBalanceInput)) : 0;
  const canEditOpeningBalance = isEditingStatement || (!currentReconciliation && isEditingStatement);
  const openingBalanceForCalc = currentReconciliation && !isEditingStatement ? Math.abs(openingBalance) : openingBalanceNum;

  // Cleared balance for credit cards: Opening Balance + Cleared Charges - Cleared Payments
  // Use local (date-filtered) totals for accurate reconciliation
  const clearedBalance = openingBalanceForCalc + localClearedCharges - localClearedPayments;
  const difference = statementBalanceNum === null ? null : Math.abs(statementBalanceNum) - clearedBalance;
  const isReconciled = difference !== null && Math.abs(difference) < 0.01;

  const handleStartReconciliation = () => {
    if (!selectedCardId || !statementBalance) return;
    
    startReconciliation.mutate({
      credit_card_id: selectedCardId,
      statement_date: statementDate,
      statement_balance: parseFloat(statementBalance),
    });
  };

  const handleSaveStatementEdit = () => {
    if (!currentReconciliation) return;

    updateReconciliation.mutate({
      reconciliationId: currentReconciliation.id,
      statement_date: statementDate,
      statement_balance: parseFloat(statementBalance),
    });

    // Save opening balance override
    if (selectedCardId && openingBalanceInput.trim()) {
      const next = parseFloat(openingBalanceInput);
      if (Number.isFinite(next) && next !== openingBalance) {
        const updateField = selectedCard?.last_reconciled_balance != null
          ? { last_reconciled_balance: next }
          : { opening_balance: next };
        updateCreditCard.mutate({ id: selectedCardId, ...updateField });
      }
    }

    setIsEditingStatement(false);
  };

  const handleCompleteReconciliation = () => {
    if (!currentReconciliation || !isReconciled) return;
    
    completeReconciliation.mutate({
      reconciliationId: currentReconciliation.id,
      reconciledBalance: clearedBalance,
    });
  };

  if (orgLoading || cardsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CreditCard className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start reconciling credit cards.
        </p>
      </div>
    );
  }

  if (creditCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <CreditCard className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Credit Cards</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Add a credit card first to start reconciling.
        </p>
        <Button onClick={() => window.location.href = '/banking/credit-cards'}>
          Go to Credit Cards
        </Button>
      </div>
    );
  }

  const handleExport = () => {
    if (!selectedCard || statementBalanceNum === null) return;

    const cardLast4 = selectedCard.card_number
      ? selectedCard.card_number.slice(-4)
      : undefined;

    // Calculate outstanding items for audit report
    const pendingCreditsTotal = dateFilteredTransactions
      .filter(t => !t.is_cleared && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const outstandingChargesTotal = dateFilteredTransactions
      .filter(t => !t.is_cleared && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    downloadReconciliationPdf({
      organizationName: organization?.name,
      bankAccountName: selectedCard.name,
      bankAccountNumberLast4: cardLast4,
      bankInstitution: selectedCard.issuer,
      statementDate,
      periodStart: startDate || undefined,
      periodEnd: endDate || statementDate,
      openingBalance: openingBalanceForCalc,
      statementEndingBalance: Math.abs(statementBalanceNum),
      glEndingBalance: Math.abs(bookBalance),
      clearedDeposits: localClearedPayments, // Payments reduce liability
      clearedPayments: localClearedCharges, // Charges increase liability
      clearedBalance,
      difference: difference ?? 0,
      bookBalance: Math.abs(bookBalance),
      depositsInTransit: pendingCreditsTotal,
      outstandingCheques: outstandingChargesTotal,
      reconciliationId: currentReconciliation?.id,
      status: currentReconciliation?.status as 'draft' | 'in_progress' | 'completed' | 'approved' | undefined,
      preparedDate: new Date().toISOString().split('T')[0],
      lines: dateFilteredTransactions.map((t) => ({
        date: t.transaction_date,
        description: t.description,
        reference: t.reference,
        amount: t.transaction_type === 'payment' ? t.amount : -t.amount,
        isCleared: t.is_cleared,
        source: 'credit-card',
        journalEntryId: t.journal_entry_id,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Card Reconciliation</h1>
          <p className="text-muted-foreground">Match your credit card statement to your books</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedCard && statementBalanceNum !== null && (
            <ReconciliationShareActions
              accountName={selectedCard.name}
              statementDate={statementDate}
              statementBalance={Math.abs(statementBalanceNum)}
              reconciledBalance={clearedBalance}
              difference={difference ?? 0}
              onExportPdf={handleExport}
              organizationName={organization?.name}
              reconciliationType="credit-card"
            />
          )}
          {currentReconciliation ? (
            <Button 
              className={cn(
                "text-accent-foreground",
                isReconciled ? "bg-success hover:bg-success/90" : "bg-accent hover:bg-accent/90"
              )}
              disabled={!isReconciled || completeReconciliation.isPending}
              onClick={handleCompleteReconciliation}
            >
              {completeReconciliation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {isReconciled ? "Complete Reconciliation" : "Not Balanced"}
            </Button>
          ) : (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleStartReconciliation}
              disabled={!statementBalance || startReconciliation.isPending}
            >
              {startReconciliation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Start Reconciliation
            </Button>
          )}
        </div>
      </div>

      {/* Setup Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Statement Details</h2>
          <div className="flex gap-2">
            {/* Before reconciliation: Show Edit/Save for opening balance */}
            {!currentReconciliation && !isEditingStatement && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditingStatement(true)}
                className="text-primary border-primary hover:bg-primary/10"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
            {!currentReconciliation && isEditingStatement && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditingStatement(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={() => {
                    // Save opening balance if changed
                    if (selectedCardId && openingBalanceInput.trim()) {
                      const next = parseFloat(openingBalanceInput);
                      if (Number.isFinite(next) && next !== openingBalance) {
                        const updateField = selectedCard?.last_reconciled_balance != null
                          ? { last_reconciled_balance: next }
                          : { opening_balance: next };
                        updateCreditCard.mutate({ id: selectedCardId, ...updateField });
                      }
                    }
                    // If statement balance is provided, start reconciliation to save it
                    if (selectedCardId && statementBalance.trim()) {
                      const balanceNum = parseFloat(statementBalance);
                      if (Number.isFinite(balanceNum)) {
                        startReconciliation.mutate({
                          credit_card_id: selectedCardId,
                          statement_date: statementDate,
                          statement_balance: balanceNum,
                        });
                      }
                    }
                    setIsEditingStatement(false);
                  }} 
                  disabled={updateCreditCard.isPending || startReconciliation.isPending}
                >
                  {(updateCreditCard.isPending || startReconciliation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </>
            )}
            {/* During reconciliation: Show Edit/Save for statement details */}
            {currentReconciliation && !isEditingStatement && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditingStatement(true)}
                className="text-primary border-primary hover:bg-primary/10"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
            {currentReconciliation && isEditingStatement && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditingStatement(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={handleSaveStatementEdit} 
                  disabled={updateReconciliation.isPending}
                >
                  {updateReconciliation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Credit Card</Label>
            <Select value={selectedCardId} onValueChange={setSelectedCardId} disabled={!!currentReconciliation}>
              <SelectTrigger>
                <SelectValue placeholder="Select card" />
              </SelectTrigger>
              <SelectContent>
                {creditCards.map(card => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name} {card.card_number ? `****${card.card_number.slice(-4)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Statement Date</Label>
            <Input 
              type="date" 
              value={statementDate} 
              onChange={(e) => setStatementDate(e.target.value)}
              disabled={currentReconciliation && !isEditingStatement}
            />
          </div>
          <div className="space-y-2">
            <Label>Statement Ending Balance</Label>
            <Input 
              type="number" 
              value={statementBalance} 
              onChange={(e) => setStatementBalance(e.target.value)} 
              placeholder="0.00"
              disabled={currentReconciliation && !isEditingStatement}
            />
          </div>
          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <Input
              type={canEditOpeningBalance ? 'number' : 'text'}
              value={canEditOpeningBalance ? openingBalanceInput : formatCurrency(openingBalanceForCalc)}
              onChange={(e) => setOpeningBalanceInput(e.target.value)}
              onBlur={() => {
                if (!canEditOpeningBalance || !selectedCardId) return;
                const next = openingBalanceInput.trim() ? parseFloat(openingBalanceInput) : 0;
                if (!Number.isFinite(next)) return;

                const updateField = selectedCard?.last_reconciled_balance != null
                  ? { last_reconciled_balance: next }
                  : { opening_balance: next };

                updateCreditCard.mutate({ id: selectedCardId, ...updateField });
              }}
              disabled={!canEditOpeningBalance}
              className={!canEditOpeningBalance ? 'bg-muted' : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label>Book Balance</Label>
            <Input 
              type="text" 
              value={formatCurrency(bookBalance)}
              disabled
              className="bg-muted"
            />
          </div>
        </div>
      </Card>

      {/* Reconciliation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Statement Balance</p>
          {statementBalanceNum === null ? (
            <p className="text-xl font-bold text-muted-foreground">--</p>
          ) : (
            <p className="text-xl font-bold text-foreground">{formatCurrency(Math.abs(statementBalanceNum))}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleared Charges</p>
          <p className="text-xl font-bold text-destructive">+{formatCurrency(localClearedCharges)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleared Payments</p>
          <p className="text-xl font-bold text-success">-{formatCurrency(localClearedPayments)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleared Balance</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(clearedBalance)}</p>
        </Card>
        <Card className={cn(
          "p-4 border-2",
          difference === null ? "border-border" : isReconciled ? "border-success bg-success/5" : "border-destructive bg-destructive/5"
        )}>
          <p className="text-sm text-muted-foreground mb-1">Difference</p>
          {difference === null ? (
            <p className="text-xl font-bold text-muted-foreground">--</p>
          ) : (
            <p className={cn(
              "text-xl font-bold flex items-center gap-2",
              isReconciled ? "text-success" : "text-destructive"
            )}>
              {isReconciled ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {formatCurrency(Math.abs(difference))}
            </p>
          )}
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-foreground">Transactions</h3>
              <span className="text-sm text-muted-foreground">{clearedCount} of {totalCount} cleared</span>
              {(startDate || endDate) && (
                <span className="text-sm text-muted-foreground">
                  (Showing {filteredTransactions.length} in date range)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-1" />
                    {clearedFilter === 'all' ? 'All' : clearedFilter === 'cleared' ? 'Cleared' : 'Uncleared'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={clearedFilter} onValueChange={(v) => setClearedFilter(v as ClearedFilter)}>
                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="cleared">Cleared</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="uncleared">Uncleared</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="w-4 h-4 mr-1" />
                    {sortField === 'date' ? 'Date' : sortField === 'amount' ? 'Amount' : 'Description'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="amount">Amount</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="description">Description</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                <ArrowUpDown className={cn("w-4 h-4", sortDir === 'asc' && 'rotate-180')} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleClearAll(true)}>Clear All</Button>
              <Button variant="outline" size="sm" onClick={() => handleUnclearAll(true)}>Unclear All</Button>
            </div>
          </div>
          {/* Date Range Filter Row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Period Start:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Period End:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-muted-foreground"
              >
                Clear Dates
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-12 px-4 py-3 text-left"></th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Charges</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Payments</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody>
              {reconciliationLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-t border-border hover:bg-muted/30 cursor-pointer transition-colors",
                      t.is_cleared && "bg-success/5"
                    )}
                    onClick={() => handleToggleCleared(t.id, t.is_cleared)}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={t.is_cleared}
                        onCheckedChange={() => handleToggleCleared(t.id, t.is_cleared)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {formatDateShort(t.transaction_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">
                      {t.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {t.reference || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {t.amount > 0 ? (
                        <span className="text-destructive">{formatCurrency(t.amount)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {t.amount < 0 ? (
                        <span className="text-success">{formatCurrency(Math.abs(t.amount))}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        t.source === 'journal_entry'
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {t.source === 'journal_entry' ? 'JE' : 'CC'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Uncleared Totals */}
      {(localUnclearedCharges > 0 || localUnclearedPayments > 0) && (
        <Card className="p-4">
          <h4 className="font-medium text-foreground mb-3">Outstanding Items</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Uncleared Charges</p>
              <p className="text-lg font-semibold text-destructive">{formatCurrency(localUnclearedCharges)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uncleared Payments</p>
              <p className="text-lg font-semibold text-success">{formatCurrency(localUnclearedPayments)}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
