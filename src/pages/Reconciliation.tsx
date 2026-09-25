import { useState, useEffect, useMemo } from 'react';
import { Calendar, Check, AlertTriangle, Download, Building2, Loader2, Plus, Pencil, ArrowUpDown, Filter, Share2, Printer, Mail, MessageCircle } from 'lucide-react';
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
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useReconciliation } from '@/hooks/useReconciliation';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { downloadReconciliationPdf } from '@/lib/generateReconciliationPdf';
import { ReconciliationShareActions } from '@/components/reports/ReconciliationShareActions';
import { exportToFormattedExcel } from '@/lib/excelExport';
import { format } from 'date-fns';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

type ClearedFilter = 'all' | 'cleared' | 'uncleared';
type SortField = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';

export default function Reconciliation() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { accounts: bankAccounts, isLoading: accountsLoading, updateAccount } = useBankAccounts();
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementDate, setStatementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statementBalance, setStatementBalance] = useState('');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [showOrgDialog, setShowOrgDialog] = useState(false);
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
    clearedDeposits,
    clearedPayments,
    unclearedDeposits,
    unclearedPayments,
    clearedCount,
    totalCount,
    startReconciliation,
    updateReconciliation,
    toggleCleared,
    completeReconciliation,
  } = useReconciliation(selectedAccountId, statementDate);

  // Set first bank account as default
  useEffect(() => {
    if (bankAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedAccountId]);

  // Set statement balance from current reconciliation
  useEffect(() => {
    if (currentReconciliation) {
      setStatementBalance(currentReconciliation.statement_balance.toString());
      setStatementDate(currentReconciliation.statement_date);
    }
  }, [currentReconciliation]);

  // Set opening balance field (last reconciled balance preferred, otherwise bank account opening balance)
  useEffect(() => {
    if (openingBalance !== undefined) {
      setOpeningBalanceInput(openingBalance.toString());
    }
  }, [openingBalance, selectedAccountId]);

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

  // Filtered and sorted transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    
    // Date range filter
    if (startDate) {
      filtered = filtered.filter(t => t.transaction_date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(t => t.transaction_date <= endDate);
    }
    
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
  }, [transactions, clearedFilter, sortField, sortDir, startDate, endDate]);

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const bookBalance = currentReconciliation
    ? (bookBalanceAsOfStatementDate ?? selectedAccount?.current_balance ?? 0)
    : (selectedAccount?.current_balance ?? 0);
  const statementBalanceNum = statementBalance.trim() ? parseFloat(statementBalance) : null;

  // Opening balance
  const openingBalanceNum = openingBalanceInput.trim() ? parseFloat(openingBalanceInput) : 0;
  const canEditOpeningBalance = isEditingStatement;
  const openingBalanceForCalc = currentReconciliation && !isEditingStatement ? openingBalance : openingBalanceNum;

  // Cleared balance: Opening Balance + Cleared Deposits - Cleared Payments = Closing Balance
  const clearedBalance = openingBalanceForCalc + clearedDeposits - clearedPayments;
  const difference = statementBalanceNum === null ? null : statementBalanceNum - clearedBalance;
  const isReconciled = difference !== null && Math.abs(difference) < 0.01;

  const handleStartReconciliation = () => {
    if (!selectedAccountId || !statementBalance) return;
    
    startReconciliation.mutate({
      bank_account_id: selectedAccountId,
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

    // Save opening balance override (updates last_reconciled_balance when present; otherwise opening_balance)
    if (selectedAccountId && openingBalanceInput.trim()) {
      const next = parseFloat(openingBalanceInput);
      if (Number.isFinite(next) && next !== openingBalance) {
        const updateField = selectedAccount?.last_reconciled_balance != null
          ? { last_reconciled_balance: next }
          : { opening_balance: next };
        updateAccount.mutate({ id: selectedAccountId, ...updateField });
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

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start reconciling bank accounts.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (orgLoading || accountsLoading) {
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

  if (bankAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Calendar className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Bank Accounts</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Add a bank account first to start reconciling.
        </p>
        <Button onClick={() => window.location.href = '/banking/accounts'}>
          Go to Bank Accounts
        </Button>
      </div>
    );
  }

  const handleExport = () => {
    if (!selectedAccount || statementBalanceNum === null) return;

    const accountLast4 = selectedAccount.account_number
      ? selectedAccount.account_number.slice(-4)
      : undefined;

    // Calculate outstanding items for audit report
    const depositsInTransitTotal = transactions
      .filter(t => !t.is_cleared && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const outstandingChequesTotal = transactions
      .filter(t => !t.is_cleared && t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    downloadReconciliationPdf({
      organizationName: organization?.name,
      bankAccountName: selectedAccount.name,
      bankAccountNumberLast4: accountLast4,
      bankInstitution: selectedAccount.institution,
      statementDate,
      periodStart: startDate || undefined,
      periodEnd: endDate || statementDate,
      openingBalance: openingBalanceForCalc,
      statementEndingBalance: statementBalanceNum,
      glEndingBalance: bookBalance,
      clearedDeposits,
      clearedPayments,
      clearedBalance,
      difference: difference ?? 0,
      bookBalance,
      depositsInTransit: depositsInTransitTotal,
      outstandingCheques: outstandingChequesTotal,
      reconciliationId: currentReconciliation?.id,
      status: currentReconciliation?.status as 'draft' | 'in_progress' | 'completed' | 'approved' | undefined,
      preparedDate: new Date().toISOString().split('T')[0],
      lines: transactions.map((t) => ({
        date: t.transaction_date,
        description: t.description,
        reference: t.reference,
        amount: t.amount,
        isCleared: t.is_cleared,
        source: t.source,
        journalEntryId: t.journal_entry_id,
      })),
    });
  };

  const handleExportExcel = () => {
    if (!selectedAccount || statementBalanceNum === null) return;

    const typeLabel = 'Bank';
    exportToFormattedExcel({
      title: `${typeLabel} Reconciliation - ${selectedAccount.name}`,
      subtitle: `Statement Date: ${statementDate}`,
      organizationName: organization?.name,
      headers: ['Date', 'Description', 'Reference', 'Amount', 'Status'],
      rows: transactions.map(t => [
        t.transaction_date,
        t.description || '',
        t.reference || '',
        t.amount,
        t.is_cleared ? 'Cleared' : 'Uncleared',
      ]),
      totals: [
        { label: 'Opening Balance', value: openingBalanceForCalc },
        { label: 'Cleared Deposits', value: clearedDeposits },
        { label: 'Cleared Payments', value: clearedPayments },
        { label: 'Cleared Balance', value: clearedBalance },
        { label: 'Statement Balance', value: statementBalanceNum },
        { label: 'Difference', value: difference ?? 0 },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Match your bank statement to your books</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedAccount && statementBalanceNum !== null && (
            <ReconciliationShareActions
              accountName={selectedAccount.name}
              statementDate={statementDate}
              statementBalance={statementBalanceNum}
              reconciledBalance={clearedBalance}
              difference={difference ?? 0}
              onExportPdf={handleExport}
              onExportExcel={handleExportExcel}
              organizationName={organization?.name}
              reconciliationType="bank"
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
                    if (selectedAccountId && openingBalanceInput.trim()) {
                      const next = parseFloat(openingBalanceInput);
                      if (Number.isFinite(next) && next !== openingBalance) {
                        const updateField = selectedAccount?.last_reconciled_balance != null
                          ? { last_reconciled_balance: next }
                          : { opening_balance: next };
                        updateAccount.mutate({ id: selectedAccountId, ...updateField });
                      }
                    }
                    // If statement balance is provided, start reconciliation to save it
                    if (selectedAccountId && statementBalance.trim()) {
                      const balanceNum = parseFloat(statementBalance);
                      if (Number.isFinite(balanceNum)) {
                        startReconciliation.mutate({
                          bank_account_id: selectedAccountId,
                          statement_date: statementDate,
                          statement_balance: balanceNum,
                        });
                      }
                    }
                    setIsEditingStatement(false);
                  }} 
                  disabled={updateAccount.isPending || startReconciliation.isPending}
                >
                  {(updateAccount.isPending || startReconciliation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
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
            <Label>Bank Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={!!currentReconciliation}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} {account.account_number ? `****${account.account_number.slice(-4)}` : ''}
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
                if (!canEditOpeningBalance || !selectedAccountId) return;
                const next = openingBalanceInput.trim() ? parseFloat(openingBalanceInput) : 0;
                if (!Number.isFinite(next)) return;

                const updateField = selectedAccount?.last_reconciled_balance != null
                  ? { last_reconciled_balance: next }
                  : { opening_balance: next };

                updateAccount.mutate({ id: selectedAccountId, ...updateField });
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
            <p className="text-xl font-bold text-foreground">{formatCurrency(statementBalanceNum)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleared Deposits</p>
          <p className="text-xl font-bold text-success">+{formatCurrency(clearedDeposits)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleared Payments</p>
          <p className="text-xl font-bold text-foreground">-{formatCurrency(clearedPayments)}</p>
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

      {/* Transactions to Reconcile */}
      <Card className="overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b border-border space-y-3">
          {/* Header Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-foreground">Transactions to Clear</h3>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {/* Filter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-1" />
                    {clearedFilter === 'all' ? 'All' : clearedFilter === 'cleared' ? 'Cleared' : 'Uncleared'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup value={clearedFilter} onValueChange={(v) => setClearedFilter(v as ClearedFilter)}>
                    <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="cleared">Cleared</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="uncleared">Uncleared</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Sort dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="w-4 h-4 mr-1" />
                    Sort: {sortField.charAt(0).toUpperCase() + sortField.slice(1)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="amount">Amount</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="description">Description</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
              </Button>
              <span className="text-muted-foreground">
                {clearedCount} of {totalCount} cleared
                {(startDate || endDate) && ` (${filteredTransactions.length} in range)`}
              </span>
              <Button variant="ghost" size="sm" onClick={() => handleClearAll(true)}>
                Clear All
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleUnclearAll(true)}>
                Unclear All
              </Button>
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
        
        {reconciliationLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Calendar className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">No transactions to reconcile</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">Clear</th>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th className="text-right">Deposits</th>
                <th className="text-right">Payments</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((item) => (
                <tr 
                  key={item.id} 
                  className={cn(
                    "cursor-pointer transition-colors",
                    item.is_cleared ? "bg-success/5" : "hover:bg-muted/20"
                  )}
                  onClick={() => handleToggleCleared(item.id, item.is_cleared)}
                >
                  <td>
                    <Checkbox 
                      checked={item.is_cleared} 
                      onCheckedChange={() => handleToggleCleared(item.id, item.is_cleared)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="text-muted-foreground">{formatDate(item.transaction_date)}</td>
                  <td className="font-medium">{item.description}</td>
                  <td className="text-muted-foreground font-mono text-sm">{item.reference || '-'}</td>
                  <td className="text-right font-mono text-success">
                    {item.amount > 0 ? formatCurrency(item.amount) : '-'}
                  </td>
                  <td className="text-right font-mono">
                    {item.amount < 0 ? formatCurrency(Math.abs(item.amount)) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/50 font-semibold">
              <tr>
                <td colSpan={4}>Cleared Totals</td>
                <td className="text-right font-mono text-success">{formatCurrency(clearedDeposits)}</td>
                <td className="text-right font-mono">{formatCurrency(clearedPayments)}</td>
              </tr>
              <tr className="text-muted-foreground">
                <td colSpan={4}>Uncleared Totals</td>
                <td className="text-right font-mono">{formatCurrency(unclearedDeposits)}</td>
                <td className="text-right font-mono">{formatCurrency(unclearedPayments)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </Card>
    </div>
  );
}
