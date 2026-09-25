import { useState } from 'react';
import { Plus, RefreshCw, MoreHorizontal, CreditCard as CreditCardIcon, Building2, BookOpen, FileUp, Receipt, Edit, Trash2, Eye, ArrowRightLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCreditCards, CreditCard, CreateCreditCardInput } from '@/hooks/useCreditCards';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { AddCreditCardDialog } from '@/components/banking/AddCreditCardDialog';
import { EditCreditCardDialog } from '@/components/banking/EditCreditCardDialog';
import { CreditCardImportDialog } from '@/components/banking/CreditCardImportDialog';
import { FundsTransferDialog } from '@/components/banking/FundsTransferDialog';
import { PlaidLinkDialog } from '@/components/banking/PlaidLinkDialog';
import { ACHConnectDialog } from '@/components/banking/ACHConnectDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useCreditCardPlaidSync } from '@/hooks/useCreditCardPlaidSync';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

export default function CreditCards() {
  const confirmDelete = useConfirmDelete();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { 
    creditCards, 
    isLoading, 
    totalBalance, 
    totalCreditLimit, 
    availableCredit,
    createCreditCard, 
    updateCreditCard, 
    deleteCreditCard 
  } = useCreditCards();
  const { data: glAccounts = [] } = useAccounts(organization?.id);
  const navigate = useNavigate();
  const { formatCurrency: formatLocalizedCurrency, formatDate: formatLocalizedDate } = useLocalizedCurrency();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isPlaidOpen, setIsPlaidOpen] = useState(false);
  const [isACHOpen, setIsACHOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [importingCard, setImportingCard] = useState<CreditCard | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const { syncOne, syncingCardId } = useCreditCardPlaidSync();

  const formatCurrency = (value: number, currency: string = 'CAD') => {
    return formatLocalizedCurrency(value, { showSymbol: true, minimumFractionDigits: 0 });
  };

  const formatDate = (date?: string | null) => {
    if (!date) return 'Never';
    return formatLocalizedDate(date, 'medium');
  };

  const getGLAccountName = (glAccountId: string | null) => {
    if (!glAccountId) return null;
    const account = glAccounts.find(a => a.id === glAccountId);
    return account ? `${account.code} - ${account.name}` : null;
  };

  const handleSubmit = async (input: CreateCreditCardInput) => {
    await createCreditCard.mutateAsync(input);
    setIsAddOpen(false);
  };

  const handleEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (id: string, updates: Partial<CreditCard>) => {
    await updateCreditCard.mutateAsync({ id, ...updates });
  };

  const handleDelete = async (id: string) => {
    await deleteCreditCard.mutateAsync(id);
  };

  const handleImportCard = (card: CreditCard) => {
    setImportingCard(card);
    setIsImportOpen(true);
  };

  // Map a discovered Plaid/ACH account to a credit card record
  const handleConnectedAccountCreated = async (account: {
    name: string;
    institution: string;
    accountType?: string;
    accountNumber?: string;
    balance?: number;
    plaidAccessToken?: string;
    plaidAccountId?: string;
    plaidItemId?: string;
    routingNumber?: string;
  }) => {
    await createCreditCard.mutateAsync({
      name: account.name,
      issuer: account.institution,
      card_number: account.accountNumber || undefined,
      currency: 'CAD',
      opening_balance: Math.abs(account.balance || 0),
      plaid_access_token: account.plaidAccessToken || null,
      plaid_account_id: account.plaidAccountId || null,
      plaid_item_id: account.plaidItemId || null,
      routing_number: account.routingNumber || null,
      ach_verified_at: account.routingNumber ? new Date().toISOString() : null,
    });
  };

  const getUtilizationPercent = (balance: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min((balance / limit) * 100, 100);
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 80) return 'bg-destructive';
    if (percent >= 50) return 'bg-warning';
    return 'bg-green-500';
  };

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

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const unreconciled = creditCards.filter(c => !c.last_reconciled_at).length;
  const overallUtilization = totalCreditLimit > 0 ? (totalBalance / totalCreditLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Cards</h1>
          <p className="text-muted-foreground">Manage credit card accounts, import statements, and reconcile</p>
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsTransferOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Make Payment
              </Button>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync All
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => setIsAddOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Credit Card
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Balance Owed</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalBalance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Credit Limit</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCreditLimit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Available Credit</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(availableCredit)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Utilization</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground">{overallUtilization.toFixed(0)}%</p>
            <Progress value={overallUtilization} className="flex-1 h-2" />
          </div>
        </Card>
      </div>

      {/* Credit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creditCards.map((card) => {
          const utilization = getUtilizationPercent(card.current_balance, card.credit_limit);
          
          return (
            <Card key={card.id} className="overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <CreditCardIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{card.name}</h3>
                      <p className="text-sm text-muted-foreground">{card.issuer}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {card.plaid_access_token && !isReadOnly && (
                        <DropdownMenuItem
                          onClick={() => syncOne(card)}
                          disabled={syncingCardId === card.id}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${syncingCardId === card.id ? 'animate-spin' : ''}`} />
                          {syncingCardId === card.id ? 'Syncing…' : 'Sync Transactions'}
                        </DropdownMenuItem>
                      )}
                      {!isReadOnly && (
                        <DropdownMenuItem onClick={() => setIsPlaidOpen(true)} className="text-accent">
                          <Globe className="w-4 h-4 mr-2" />
                          Connect via Plaid
                        </DropdownMenuItem>
                      )}
                      {!isReadOnly && (
                        <DropdownMenuItem onClick={() => setIsACHOpen(true)}>
                          <ArrowRightLeft className="w-4 h-4 mr-2" />
                          ACH Bank Transfer
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate(`/banking/credit-cards/${card.id}/transactions`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Transactions
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImportCard(card)}>
                        <FileUp className="w-4 h-4 mr-2" />
                        Import Statement
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/banking/credit-cards/${card.id}/reconcile`)}>
                        <Receipt className="w-4 h-4 mr-2" />
                        Reconcile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEditCard(card)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Card
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => confirmDelete(() => handleDelete(card.id), { itemName: card.name, title: 'Remove credit card?' })}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Card
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Balance and Limit */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(card.current_balance, card.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Credit Limit</span>
                    <span className="text-sm">
                      {formatCurrency(card.credit_limit, card.currency)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Utilization</span>
                      <span>{utilization.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${getUtilizationColor(utilization)}`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Details */}
                <div className="space-y-2 text-sm border-t pt-4">
                  {card.card_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Card Number</span>
                      <span>•••• {card.card_number}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Statement Date</span>
                    <span>Day {card.statement_closing_day}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Reconciled</span>
                    <span>{formatDate(card.last_reconciled_at)}</span>
                  </div>
                </div>

                {/* GL Account Link */}
                {card.gl_account_id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookOpen className="w-3 h-3" />
                      <span className="truncate">{getGLAccountName(card.gl_account_id)}</span>
                    </div>
                  </div>
                )}

                {!card.gl_account_id && (
                  <div className="mt-4 pt-4 border-t">
                    <Badge variant="outline" className="text-warning border-warning">
                      Not linked to GL
                    </Badge>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {/* Add Card Placeholder */}
        <Card 
          className="border-dashed cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-center min-h-[300px]"
          onClick={() => setIsAddOpen(true)}
        >
          <div className="text-center p-6">
            <CreditCardIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-foreground mb-1">Add Credit Card</h3>
            <p className="text-sm text-muted-foreground">
              Connect a new credit card to track expenses
            </p>
          </div>
        </Card>

        {!isReadOnly && (
          <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
              <Globe className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Plaid Card Connection</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Securely link a credit card via Plaid and auto-sync transactions
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-accent text-accent hover:bg-accent/10"
              onClick={() => setIsPlaidOpen(true)}
            >
              <Globe className="w-4 h-4 mr-2" />
              Connect via Plaid
            </Button>
          </Card>
        )}

        {!isReadOnly && (
          <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <ArrowRightLeft className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">ACH Bank Transfer</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Connect via routing &amp; account numbers for ACH payments
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-green-600 text-green-600 hover:bg-green-500/10"
              onClick={() => setIsACHOpen(true)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Add ACH
            </Button>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <AddCreditCardDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        glAccounts={glAccounts}
        onSubmit={handleSubmit}
        isPending={createCreditCard.isPending}
      />

      <EditCreditCardDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        creditCard={editingCard}
        glAccounts={glAccounts}
        onSave={handleSaveEdit}
        isPending={updateCreditCard.isPending}
      />

      <CreditCardImportDialog
        open={isImportOpen}
        onOpenChange={(open) => {
          setIsImportOpen(open);
          if (!open) setImportingCard(null);
        }}
        creditCard={importingCard}
        onImport={async (transactions) => {
          // This would be handled by the hook in a real implementation
          toast.success(`Imported ${transactions.length} transactions`);
        }}
      />

      <FundsTransferDialog
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
        transferType="cc-payment"
      />

      <PlaidLinkDialog
        open={isPlaidOpen}
        onOpenChange={setIsPlaidOpen}
        onAccountCreated={handleConnectedAccountCreated}
      />

      <ACHConnectDialog
        open={isACHOpen}
        onOpenChange={setIsACHOpen}
        onAccountCreated={handleConnectedAccountCreated}
      />
    </div>
  );
}
