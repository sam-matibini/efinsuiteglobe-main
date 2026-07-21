import { useState, useMemo } from 'react';
import { Plus, RefreshCw, ArrowUpRight, ArrowDownLeft, MoreHorizontal, Building2, Sparkles, BookOpen, AlertTriangle, Globe, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getInstitutionsForCountry,
  getBankInstitutionsOnly,
  getMobileWalletInstitutions,
  mapInstitutionType,
  type BankingInstitution,
} from '@/data/localizedBankingInstitutions';
import { useBankAccounts, CreateBankAccountInput, BankAccount } from '@/hooks/useBankAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { AIBankConnectDialog } from '@/components/banking/AIBankConnectDialog';
import { PlaidLinkDialog } from '@/components/banking/PlaidLinkDialog';
import { ACHConnectDialog } from '@/components/banking/ACHConnectDialog';
import { EditBankAccountDialog } from '@/components/banking/EditBankAccountDialog';
import { FundsTransferDialog } from '@/components/banking/FundsTransferDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLocalizedCurrency, getAllLocalizedCurrencies } from '@/hooks/useLocalizedCurrency';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { usePlaidSync } from '@/hooks/usePlaidSync';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

export default function BankAccounts() {
  const confirmDelete = useConfirmDelete();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { accounts, isLoading, totalBalance, createAccount, updateAccount, deleteAccount } = useBankAccounts();
  const isReadOnly = useIsReadOnly();
  const { data: glAccounts = [] } = useAccounts(organization?.id);
  const { syncOne, syncAll, isSyncing, syncingAccountId } = usePlaidSync();
  const navigate = useNavigate();
  
  // Localization
  const { 
    formatCurrency: formatLocalizedCurrency, 
    formatDate: formatLocalizedDate, 
    financialInstitutions, 
    countryCode,
    currencyCode,
    terminology,
    localization
  } = useLocalizedCurrency();
  
  const availableCurrencies = useMemo(() => getAllLocalizedCurrencies(countryCode), [countryCode]);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAIConnectOpen, setIsAIConnectOpen] = useState(false);
  const [isOnlineBankingOpen, setIsOnlineBankingOpen] = useState(false);
  const [isACHConnectOpen, setIsACHConnectOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  
  // Filter to show only asset-type accounts for bank linking (typically cash/bank accounts)
  // Supports both legacy codes (100, 101, 102) and new hierarchical codes (1-01-101, 1-01-102, etc.)
  const bankGLAccounts = glAccounts.filter(a => {
    if (a.account_type !== 'asset' || a.is_header || !a.is_active) return false;
    
    const code = a.code;
    const nameLower = a.name.toLowerCase();
    
    // Match legacy prefixes (100x, 101x, 102x)
    const legacyMatch = code.startsWith('100') || code.startsWith('101') || code.startsWith('102');
    
    // Match new hierarchical codes (1-01-101-xxxx, 1-01-102-xxxx for bank/cash accounts)
    const hierarchicalMatch = code.startsWith('1-01-101') || code.startsWith('1-01-102') || 
                              code.startsWith('1-01-100') || code.startsWith('1-01-103');
    
    // Match by account name keywords
    const nameMatch = nameLower.includes('cash') || 
                      nameLower.includes('bank') ||
                      nameLower.includes('chequing') || 
                      nameLower.includes('checking') ||
                      nameLower.includes('savings') ||
                      nameLower.includes('operating') ||
                      nameLower.includes('payroll') ||
                      nameLower.includes('petty') ||
                      nameLower.includes('money market') ||
                      nameLower.includes('foreign currency') ||
                      nameLower.includes('wallet') ||
                      nameLower.includes('mobile money') ||
                      nameLower.includes('momo') ||
                      nameLower.includes('pesa') ||
                      nameLower.includes('paypal') ||
                      nameLower.includes('wise') ||
                      nameLower.includes('stripe balance');
    
    return legacyMatch || hierarchicalMatch || nameMatch;
  });
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    institutionType: 'bank' as 'bank' | 'mobile_money' | 'ewallet' | 'microfinance' | 'other',
    institutionCode: '' as string,
    accountNumber: '',
    currency: currencyCode,
    openingBalance: '',
    openingDate: new Date().toISOString().split('T')[0],
    glAccountId: '',
  });

  // Localized institution groups
  const bankList = useMemo(() => getBankInstitutionsOnly(countryCode), [countryCode]);
  const mobileMoneyList = useMemo(
    () => getMobileWalletInstitutions(countryCode).filter(i => i.type === 'mobile_money'),
    [countryCode]
  );
  const eWalletList = useMemo(
    () => getMobileWalletInstitutions(countryCode).filter(i => i.type === 'ewallet'),
    [countryCode]
  );
  const allInstitutions = useMemo(() => getInstitutionsForCountry(countryCode), [countryCode]);

  const handleInstitutionChange = (val: string) => {
    const found = allInstitutions.find(i => i.name === val);
    setFormData(prev => ({
      ...prev,
      institution: val,
      institutionType: found ? mapInstitutionType(found.type) : 'other',
      institutionCode: found?.code || '',
    }));
  };

  // Get GL account name by ID
  const getGLAccountName = (glAccountId: string | null) => {
    if (!glAccountId) return null;
    const account = glAccounts.find(a => a.id === glAccountId);
    return account ? `${account.code} - ${account.name}` : null;
  };

  const formatCurrency = (value: number, currency: string = currencyCode) => {
    return formatLocalizedCurrency(value, { showSymbol: true });
  };

  const formatDate = (date?: string | null) => {
    if (!date) return 'Never';
    return formatLocalizedDate(date, 'medium');
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.institution) return;
    
    if (!formData.glAccountId) {
      toast.error('Please select a GL account to link this bank account');
      return;
    }
    
    const input: CreateBankAccountInput = {
      name: formData.name,
      institution: formData.institution,
      institution_type: formData.institutionType,
      institution_code: formData.institutionCode || undefined,
      account_number: formData.accountNumber || undefined,
      currency: formData.currency,
      opening_balance: parseFloat(formData.openingBalance) || 0,
      opening_date: formData.openingDate || undefined,
      gl_account_id: formData.glAccountId,
    };
    
    await createAccount.mutateAsync(input);
    setIsAddOpen(false);
    setFormData({
      name: '',
      institution: '',
      institutionType: 'bank',
      institutionCode: '',
      accountNumber: '',
      currency: 'CAD',
      openingBalance: '',
      openingDate: new Date().toISOString().split('T')[0],
      glAccountId: '',
    });
  };

  const handleAIAccountCreated = async (account: { name: string; institution: string; accountType: string; accountNumber?: string; balance?: number; plaidAccessToken?: string; plaidAccountId?: string; plaidItemId?: string }): Promise<void> => {
    // Check for duplicate accounts by name + institution (case-insensitive)
    const normalizedName = account.name.toLowerCase().trim();
    const normalizedInstitution = account.institution.toLowerCase().trim();
    
    const existingAccount = accounts.find(a => 
      a.name.toLowerCase().trim() === normalizedName && 
      a.institution.toLowerCase().includes(normalizedInstitution.split(' ')[0])
    );
    
    // If duplicate found AND we have Plaid credentials, update the existing account with new credentials
    if (existingAccount && account.plaidAccessToken) {
      await updateAccount.mutateAsync({
        id: existingAccount.id,
        plaid_access_token: account.plaidAccessToken,
        plaid_account_id: account.plaidAccountId,
        plaid_item_id: account.plaidItemId,
      });
      toast.success(`Re-connected "${account.name}" to online banking — syncing transactions…`);
      // Auto-sync transactions for the re-connected account
      const updatedAccount: BankAccount = { ...existingAccount, plaid_access_token: account.plaidAccessToken };
      syncOne(updatedAccount);
      return;
    }
    
    if (existingAccount) {
      toast.warning(`Account "${account.name}" from ${account.institution} already exists. Skipping duplicate.`);
      return;
    }
    
    // Also check by account number if provided
    if (account.accountNumber) {
      const existingByNumber = accounts.find(a => 
        a.account_number === account.accountNumber && 
        a.institution.toLowerCase().includes(normalizedInstitution.split(' ')[0])
      );
      
      if (existingByNumber && account.plaidAccessToken) {
        await updateAccount.mutateAsync({
          id: existingByNumber.id,
          plaid_access_token: account.plaidAccessToken,
          plaid_account_id: account.plaidAccountId,
          plaid_item_id: account.plaidItemId,
        });
        toast.success(`Re-connected account ending in ${account.accountNumber} to online banking — syncing transactions…`);
        const updatedAccount: BankAccount = { ...existingByNumber, plaid_access_token: account.plaidAccessToken };
        syncOne(updatedAccount);
        return;
      }
      
      if (existingByNumber) {
        toast.warning(`Account ending in ${account.accountNumber} already exists. Skipping duplicate.`);
        return;
      }
    }
    
    // Find a suitable GL account for the new bank account
    const defaultGLAccount = bankGLAccounts[0];
    
    if (!defaultGLAccount) {
      toast.error('No GL account available for bank accounts. Please create one in Chart of Accounts first.');
      return;
    }
    
    const input: CreateBankAccountInput = {
      name: account.name,
      institution: account.institution,
      account_number: account.accountNumber,
      currency: 'CAD',
      opening_balance: account.balance || 0,
      opening_date: new Date().toISOString().split('T')[0],
      gl_account_id: defaultGLAccount.id,
      plaid_access_token: account.plaidAccessToken,
      plaid_account_id: account.plaidAccountId,
      plaid_item_id: account.plaidItemId,
    };
    
    const newAccount = await createAccount.mutateAsync(input);
    
    // Auto-sync transactions immediately after creating the new account
    if (account.plaidAccessToken && newAccount) {
      const syncableAccount: BankAccount = {
        ...(newAccount as BankAccount),
        plaid_access_token: account.plaidAccessToken,
        organization_id: organization?.id || '',
      };
      syncOne(syncableAccount);
    }
  };

  const handleLinkGL = async (accountId: string, glAccountId: string) => {
    await updateAccount.mutateAsync({ id: accountId, gl_account_id: glAccountId });
    toast.success('Bank account linked to GL');
  };

  const handleDelete = async (id: string) => {
    await deleteAccount.mutateAsync(id);
  };

  const handleEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (id: string, updates: Partial<BankAccount>) => {
    await updateAccount.mutateAsync({ id, ...updates });
  };


  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing your bank accounts.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const unreconciled = accounts.filter(a => !a.last_reconciled_at).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Accounts</h1>
          <p className="text-muted-foreground">Manage and reconcile your bank accounts</p>
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsTransferOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer Funds
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncAll(accounts)}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync All'}
              </Button>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input 
                    id="accountName" 
                    placeholder="e.g., Operating Account"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="institution">Financial Institution</Label>
                    <Select
                      value={formData.institution}
                      onValueChange={handleInstitutionChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank, mobile money, or wallet" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {bankList.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Banks</div>
                            {bankList.map((inst) => (
                              <SelectItem key={`b-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                            ))}
                          </>
                        )}
                        {mobileMoneyList.length > 0 && (
                          <>
                            <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Mobile Money</div>
                            {mobileMoneyList.map((inst) => (
                              <SelectItem key={`m-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                            ))}
                          </>
                        )}
                        {eWalletList.length > 0 && (
                          <>
                            <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Digital Wallets</div>
                            {eWalletList.map((inst) => (
                              <SelectItem key={`w-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                            ))}
                          </>
                        )}
                        <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Other</div>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select 
                      value={formData.currency}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {availableCurrencies.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.code} - {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number (Last 4)</Label>
                    <Input 
                      id="accountNumber" 
                      placeholder="1234" 
                      maxLength={4}
                      value={formData.accountNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openingDate">Opening Date</Label>
                    <Input 
                      id="openingDate" 
                      type="date"
                      value={formData.openingDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, openingDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingBalance">Opening Balance</Label>
                  <Input 
                    id="openingBalance" 
                    type="number" 
                    placeholder="0.00"
                    value={formData.openingBalance}
                    onChange={(e) => setFormData(prev => ({ ...prev, openingBalance: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="glAccount" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Link to GL Account <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.glAccountId}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, glAccountId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select GL account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankGLAccounts.length > 0 ? (
                        bankGLAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground">
                          No bank/cash accounts found. Create one in Chart of Accounts.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Links this bank account to your General Ledger for journal entries and financial statements.
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button 
                    className="bg-accent hover:bg-accent/90" 
                    onClick={handleSubmit}
                    disabled={createAccount.isPending}
                  >
                    {createAccount.isPending ? 'Adding...' : 'Add Account'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Balance (CAD)</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Accounts</p>
          <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Unreconciled Accounts</p>
          <p className="text-2xl font-bold text-warning">{unreconciled}</p>
        </Card>
      </div>

      {/* Bank Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <Card key={account.id} className="overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">{account.name}</h3>
                  <p className="text-sm text-muted-foreground">{account.institution}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {account.plaid_access_token && !isReadOnly && (
                        <DropdownMenuItem
                          onClick={() => syncOne(account)}
                          disabled={syncingAccountId === account.id}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${syncingAccountId === account.id ? 'animate-spin' : ''}`} />
                          {syncingAccountId === account.id ? 'Syncing…' : 'Sync Transactions'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => setIsOnlineBankingOpen(true)}
                        className="text-accent"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Connect via Plaid
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsACHConnectOpen(true)}
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        ACH Bank Transfer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate(`/banking/transactions?account=${account.id}`)}>
                      View Transactions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/banking/reconciliation?account=${account.id}`)}>
                      Reconcile
                    </DropdownMenuItem>
                    {!isReadOnly && <DropdownMenuItem>Import Transactions</DropdownMenuItem>}
                    {!isReadOnly && (
                      <DropdownMenuItem onClick={() => handleEditAccount(account)}>
                        Edit Account
                      </DropdownMenuItem>
                    )}
                    {!isReadOnly && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => confirmDelete(() => handleDelete(account.id), { itemName: account.account_name, title: 'Remove bank account?' })}
                        >
                          Remove Account
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {account.account_number && (
                  <Badge variant="outline" className="font-mono">
                    ****{account.account_number}
                  </Badge>
                )}
                <Badge variant="outline">
                  {account.currency}
                </Badge>
                {account.gl_account_id ? (
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="w-3 h-3" />
                    GL Linked
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    No GL
                  </Badge>
                )}
                {account.plaid_access_token && (
                  <Badge variant="outline" className="gap-1 border-success text-success">
                    <Globe className="w-3 h-3" />
                    Plaid Connected
                  </Badge>
                )}
              </div>

              {account.gl_account_id && (
                <p className="text-xs text-muted-foreground mb-2">
                  {getGLAccountName(account.gl_account_id)}
                </p>
              )}

              <p className="text-3xl font-bold text-foreground mb-4">
                {account.currency === 'USD' && 'US'}
                {formatCurrency(Number(account.current_balance), account.currency)}
              </p>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Last Reconciled</span>
                <span>{formatDate(account.last_reconciled_at)}</span>
              </div>
            </div>

            <div className="border-t border-border bg-muted/30 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 text-sm text-success hover:underline">
                  <ArrowDownLeft className="w-4 h-4" />
                  Deposit
                </button>
                <button className="flex items-center gap-1 text-sm text-foreground hover:underline">
                  <ArrowUpRight className="w-4 h-4" />
                  Withdrawal
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate(`/banking/transactions?account=${account.id}`)}
                  className="text-accent hover:text-accent hover:bg-accent/10"
                >
                  View Transactions
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/banking/reconciliation?account=${account.id}`)}
                >
                  Reconcile
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {/* Connect Bank Cards */}
        {!isReadOnly && (
          <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
              <Globe className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Plaid Bank Connection</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Securely connect your bank via Plaid
            </p>
            <Button 
              variant="outline" 
              size="sm"
              className="border-accent text-accent hover:bg-accent/10"
              onClick={() => setIsOnlineBankingOpen(true)}
            >
              <Globe className="w-4 h-4 mr-2" />
              Connect Bank
            </Button>
          </Card>
        )}

        {!isReadOnly && (
          <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <ArrowRightLeft className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">ACH Bank Transfer</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Connect via routing & account numbers
            </p>
            <Button 
              variant="outline" 
              size="sm"
              className="border-green-600 text-green-600 hover:bg-green-500/10"
              onClick={() => setIsACHConnectOpen(true)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Add ACH
            </Button>
          </Card>
        )}

        {!isReadOnly && (
          <Card className="border-dashed flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">AI-Powered Connect</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Auto-discover accounts with AI assistance
            </p>
            <Button 
              variant="outline" 
              size="sm"
              className="border-purple-600 text-purple-600 hover:bg-purple-500/10"
              onClick={() => setIsAIConnectOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Connect
            </Button>
          </Card>
        )}
      </div>

      {/* AI Bank Connect Dialog */}
      <AIBankConnectDialog
        open={isAIConnectOpen}
        onOpenChange={setIsAIConnectOpen}
        onAccountCreated={handleAIAccountCreated}
      />

      {/* Plaid Link Dialog for real bank connections */}
      <PlaidLinkDialog
        open={isOnlineBankingOpen}
        onOpenChange={setIsOnlineBankingOpen}
        onAccountCreated={handleAIAccountCreated}
      />

      {/* ACH Connect Dialog */}
      <ACHConnectDialog
        open={isACHConnectOpen}
        onOpenChange={setIsACHConnectOpen}
        onAccountCreated={handleAIAccountCreated}
      />

      {/* Edit Bank Account Dialog */}
      <EditBankAccountDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        account={editingAccount}
        glAccounts={glAccounts}
        onSave={handleSaveEdit}
        isPending={updateAccount.isPending}
      />

      {/* Funds Transfer Dialog */}
      <FundsTransferDialog
        open={isTransferOpen}
        onOpenChange={setIsTransferOpen}
      />
    </div>
  );
}
