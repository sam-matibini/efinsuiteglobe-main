import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, History, Landmark, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { downloadReconciliationPdf, ReconciliationReportData, ReconciliationReportLine } from '@/lib/generateReconciliationPdf';
import { ReconciliationShareActions } from '@/components/reports/ReconciliationShareActions';
import { exportToFormattedExcel } from '@/lib/excelExport';

type ReconciliationType = 'bank' | 'credit-card';

export default function ReconciliationHistory() {
  const { organization } = useCurrentOrganization();
  const { accounts: bankAccounts } = useBankAccounts();
  const { creditCards } = useCreditCards();
  
  const [activeTab, setActiveTab] = useState<ReconciliationType>('bank');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('all');
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>('all');

  // Fetch completed bank reconciliations
  const { data: bankReconciliations, isLoading: bankLoading } = useQuery({
    queryKey: ['completed-bank-reconciliations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const accountIds = bankAccounts?.map(a => a.id) || [];
      if (accountIds.length === 0) return [];

      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .in('bank_account_id', accountIds)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && (bankAccounts?.length ?? 0) > 0,
  });

  // Fetch completed credit card reconciliations
  const { data: ccReconciliations, isLoading: ccLoading } = useQuery({
    queryKey: ['completed-cc-reconciliations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const cardIds = creditCards?.map(c => c.id) || [];
      if (cardIds.length === 0) return [];

      const { data, error } = await supabase
        .from('credit_card_reconciliations')
        .select('*')
        .in('credit_card_id', cardIds)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && (creditCards?.length ?? 0) > 0,
  });

  // Filter bank reconciliations
  const filteredBankReconciliations = useMemo(() => {
    if (!bankReconciliations) return [];
    if (selectedBankAccountId === 'all') return bankReconciliations;
    return bankReconciliations.filter(r => r.bank_account_id === selectedBankAccountId);
  }, [bankReconciliations, selectedBankAccountId]);

  // Filter credit card reconciliations
  const filteredCCReconciliations = useMemo(() => {
    if (!ccReconciliations) return [];
    if (selectedCreditCardId === 'all') return ccReconciliations;
    return ccReconciliations.filter(r => r.credit_card_id === selectedCreditCardId);
  }, [ccReconciliations, selectedCreditCardId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const getBankAccountName = (id: string) => {
    const account = bankAccounts?.find(a => a.id === id);
    return account?.name || 'Unknown Account';
  };

  const getCreditCardName = (id: string) => {
    const card = creditCards?.find(c => c.id === id);
    return card?.name || 'Unknown Card';
  };

  // Export PDF for bank reconciliation
  const handleExportBankPdf = async (reconciliation: typeof bankReconciliations[0]) => {
    const account = bankAccounts?.find(a => a.id === reconciliation.bank_account_id);
    if (!account) return;

    // Fetch transactions for this reconciliation period
    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', reconciliation.bank_account_id)
      .lte('transaction_date', reconciliation.statement_date)
      .order('transaction_date', { ascending: true });

    const lines: ReconciliationReportLine[] = (transactions || []).map(t => ({
      date: t.transaction_date,
      description: t.description,
      reference: t.reference,
      amount: t.amount,
      isCleared: t.is_cleared,
      source: 'bank',
      journalEntryId: t.journal_entry_id,
    }));

    const clearedTxns = lines.filter(l => l.isCleared);
    const unclearedTxns = lines.filter(l => !l.isCleared);
    const clearedDeposits = clearedTxns.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const clearedPayments = clearedTxns.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
    const depositsInTransit = unclearedTxns.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const outstandingCheques = unclearedTxns.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);

    const reportData: ReconciliationReportData = {
      organizationName: organization?.name,
      bankAccountName: account.name,
      bankAccountNumberLast4: account.account_number?.slice(-4),
      bankInstitution: account.institution,
      statementDate: reconciliation.statement_date,
      openingBalance: account.opening_balance || 0,
      statementEndingBalance: reconciliation.statement_balance,
      clearedDeposits,
      clearedPayments,
      clearedBalance: reconciliation.reconciled_balance || 0,
      difference: reconciliation.difference || 0,
      depositsInTransit,
      outstandingCheques,
      reconciliationId: reconciliation.id,
      status: 'completed',
      preparedDate: reconciliation.completed_at?.split('T')[0],
      lines,
    };

    downloadReconciliationPdf(reportData);
  };

  // Export PDF for credit card reconciliation
  const handleExportCCPdf = async (reconciliation: typeof ccReconciliations[0]) => {
    const card = creditCards?.find(c => c.id === reconciliation.credit_card_id);
    if (!card) return;

    // Fetch transactions for this reconciliation period
    const { data: transactions } = await supabase
      .from('credit_card_transactions')
      .select('*')
      .eq('credit_card_id', reconciliation.credit_card_id)
      .lte('transaction_date', reconciliation.statement_date)
      .order('transaction_date', { ascending: true });

    const lines: ReconciliationReportLine[] = (transactions || []).map(t => ({
      date: t.transaction_date,
      description: t.description,
      reference: t.reference,
      amount: t.transaction_type === 'payment' ? t.amount : -t.amount, // Payments reduce liability
      isCleared: t.is_cleared || false,
      source: 'credit-card',
      journalEntryId: t.journal_entry_id,
    }));

    const clearedTxns = lines.filter(l => l.isCleared);
    const unclearedTxns = lines.filter(l => !l.isCleared);
    const clearedPayments = clearedTxns.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const clearedCharges = clearedTxns.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
    const pendingCredits = unclearedTxns.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
    const outstandingCharges = unclearedTxns.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);

    const reportData: ReconciliationReportData = {
      organizationName: organization?.name,
      bankAccountName: card.name,
      bankAccountNumberLast4: card.card_number?.slice(-4),
      bankInstitution: card.issuer,
      statementDate: reconciliation.statement_date,
      openingBalance: card.opening_balance || 0,
      statementEndingBalance: reconciliation.statement_balance,
      clearedDeposits: clearedPayments, // Payments = deposits for CC
      clearedPayments: clearedCharges, // Charges = payments for CC
      clearedBalance: reconciliation.reconciled_balance || 0,
      difference: reconciliation.difference || 0,
      depositsInTransit: pendingCredits,
      outstandingCheques: outstandingCharges,
      reconciliationId: reconciliation.id,
      status: 'completed',
      preparedDate: reconciliation.completed_at?.split('T')[0],
      lines,
    };

    downloadReconciliationPdf(reportData);
  };

  // Export Excel for bank reconciliation
  const handleExportBankExcel = async (reconciliation: typeof bankReconciliations[0]) => {
    const account = bankAccounts?.find(a => a.id === reconciliation.bank_account_id);
    if (!account) return;

    const { data: transactions } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', reconciliation.bank_account_id)
      .lte('transaction_date', reconciliation.statement_date)
      .order('transaction_date', { ascending: true });

    exportToFormattedExcel({
      title: `Bank Reconciliation - ${account.name}`,
      subtitle: `Statement Date: ${reconciliation.statement_date}`,
      organizationName: organization?.name,
      headers: ['Date', 'Description', 'Reference', 'Amount', 'Status'],
      rows: (transactions || []).map(t => [
        t.transaction_date,
        t.description || '',
        t.reference || '',
        t.amount,
        t.is_cleared ? 'Cleared' : 'Uncleared',
      ]),
      totals: [
        { label: 'Statement Balance', value: reconciliation.statement_balance },
        { label: 'Reconciled Balance', value: reconciliation.reconciled_balance || 0 },
        { label: 'Difference', value: reconciliation.difference || 0 },
      ],
    });
  };

  // Export Excel for credit card reconciliation
  const handleExportCCExcel = async (reconciliation: typeof ccReconciliations[0]) => {
    const card = creditCards?.find(c => c.id === reconciliation.credit_card_id);
    if (!card) return;

    const { data: transactions } = await supabase
      .from('credit_card_transactions')
      .select('*')
      .eq('credit_card_id', reconciliation.credit_card_id)
      .lte('transaction_date', reconciliation.statement_date)
      .order('transaction_date', { ascending: true });

    exportToFormattedExcel({
      title: `Credit Card Reconciliation - ${card.name}`,
      subtitle: `Statement Date: ${reconciliation.statement_date}`,
      organizationName: organization?.name,
      headers: ['Date', 'Description', 'Reference', 'Amount', 'Status'],
      rows: (transactions || []).map(t => [
        t.transaction_date,
        t.description || '',
        t.reference || '',
        t.transaction_type === 'payment' ? t.amount : -t.amount,
        t.is_cleared ? 'Cleared' : 'Uncleared',
      ]),
      totals: [
        { label: 'Statement Balance', value: reconciliation.statement_balance },
        { label: 'Reconciled Balance', value: reconciliation.reconciled_balance || 0 },
        { label: 'Difference', value: reconciliation.difference || 0 },
      ],
    });
  };


  const isLoading = activeTab === 'bank' ? bankLoading : ccLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Reconciliation History
          </h1>
          <p className="text-muted-foreground mt-1">
            View and export completed bank and credit card reconciliations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReconciliationType)}>
        <TabsList>
          <TabsTrigger value="bank" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Bank Reconciliations
          </TabsTrigger>
          <TabsTrigger value="credit-card" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Credit Card Reconciliations
          </TabsTrigger>
        </TabsList>

        {/* Bank Reconciliations Tab */}
        <TabsContent value="bank" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-medium">Completed Bank Reconciliations</CardTitle>
              <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {bankAccounts?.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {bankLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredBankReconciliations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed bank reconciliations found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Statement Date</TableHead>
                      <TableHead className="text-right">Statement Balance</TableHead>
                      <TableHead className="text-right">Reconciled Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBankReconciliations.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">
                          {getBankAccountName(rec.bank_account_id)}
                        </TableCell>
                        <TableCell>{formatDate(rec.statement_date)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(rec.statement_balance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(rec.reconciled_balance || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rec.difference === 0 ? 'default' : 'destructive'}>
                            {formatCurrency(rec.difference || 0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(rec.completed_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ReconciliationShareActions
                            accountName={getBankAccountName(rec.bank_account_id)}
                            statementDate={rec.statement_date}
                            statementBalance={rec.statement_balance}
                            reconciledBalance={rec.reconciled_balance || 0}
                            difference={rec.difference || 0}
              onExportPdf={() => handleExportBankPdf(rec)}
              onExportExcel={() => handleExportBankExcel(rec)}
                            organizationName={organization?.name}
                            reconciliationType="bank"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Card Reconciliations Tab */}
        <TabsContent value="credit-card" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-medium">Completed Credit Card Reconciliations</CardTitle>
              <Select value={selectedCreditCardId} onValueChange={setSelectedCreditCardId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by card" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cards</SelectItem>
                  {creditCards?.map(card => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {ccLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredCCReconciliations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed credit card reconciliations found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card</TableHead>
                      <TableHead>Statement Date</TableHead>
                      <TableHead className="text-right">Statement Balance</TableHead>
                      <TableHead className="text-right">Reconciled Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCCReconciliations.map(rec => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">
                          {getCreditCardName(rec.credit_card_id)}
                        </TableCell>
                        <TableCell>{formatDate(rec.statement_date)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(rec.statement_balance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(rec.reconciled_balance || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={rec.difference === 0 ? 'default' : 'destructive'}>
                            {formatCurrency(rec.difference || 0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(rec.completed_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <ReconciliationShareActions
                            accountName={getCreditCardName(rec.credit_card_id)}
                            statementDate={rec.statement_date}
                            statementBalance={rec.statement_balance}
                            reconciledBalance={rec.reconciled_balance || 0}
                            difference={rec.difference || 0}
              onExportPdf={() => handleExportCCPdf(rec)}
              onExportExcel={() => handleExportCCExcel(rec)}
                            organizationName={organization?.name}
                            reconciliationType="credit-card"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {(bankReconciliations?.length || 0) + (ccReconciliations?.length || 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total Reconciliations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{bankReconciliations?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Bank Reconciliations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{ccReconciliations?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Credit Card Reconciliations</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
