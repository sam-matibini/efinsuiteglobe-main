import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { 
  Globe, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface PlaidLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (account: {
    name: string;
    institution: string;
    accountType: string;
    accountNumber?: string;
    balance?: number;
    plaidAccessToken?: string;
    plaidAccountId?: string;
    plaidItemId?: string;
  }) => Promise<void>;
}

interface DiscoveredAccount {
  id: string;
  name: string;
  type: string;
  lastFour: string;
  balance: number;
  selected: boolean;
  plaidAccountId?: string;
}

type Step = 'init' | 'linking' | 'loading-accounts' | 'select-accounts' | 'complete' | 'error' | 'product-not-authorized';

export function PlaidLinkDialog({ 
  open, 
  onOpenChange, 
  onAccountCreated 
}: PlaidLinkDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('init');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredAccount[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const { organization } = useCurrentOrganization();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  // Create link token when dialog opens
  useEffect(() => {
    if (open && !linkToken) {
      createLinkToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkToken]);

  const createLinkToken = async () => {
    try {
      setIsProcessing(true);
      setErrorHint('');

      const { data, error } = await supabase.functions.invoke('ai-bank-connect', {
        body: {
          action: 'create-link-token',
          userId: user?.id || 'anonymous-user'
        }
      });

      if (error) {
        // Try to surface backend error payload when function returns non-2xx
        let message = error.message;
        let errorCode = '';
        const ctx = (error as any)?.context as Response | undefined;
        if (ctx?.text) {
          const t = await ctx.text();
          try {
            const parsed = JSON.parse(t);
            message = parsed?.error || parsed?.message || message;
            errorCode = parsed?.error_code || '';
          } catch {
            // ignore
          }
        }
        
        // Check for INVALID_PRODUCT error - special handling
        if (errorCode === 'INVALID_PRODUCT' || message.includes('not authorized to access')) {
          setErrorMessage('Transactions product not enabled for your Plaid account');
          setErrorHint('Your Plaid production credentials are valid, but the Transactions product requires approval. Apply at dashboard.plaid.com → Production Access.');
          setStep('product-not-authorized');
          return;
        }
        
        throw new Error(message);
      }

      if (!data?.success || !data?.linkToken) {
        const errorCode = data?.error_code || '';
        const errorMsg = data?.error || 'Failed to initialize bank connection';
        
        // Check for INVALID_PRODUCT error
        if (errorCode === 'INVALID_PRODUCT' || errorMsg.includes('not authorized to access')) {
          setErrorMessage('Transactions product not enabled for your Plaid account');
          setErrorHint('Your Plaid production credentials are valid, but the Transactions product requires approval. Apply at dashboard.plaid.com → Production Access.');
          setStep('product-not-authorized');
          return;
        }
        
        throw new Error(errorMsg);
      }

      setLinkToken(data.linkToken);
      setStep('init');
    } catch (err) {
      console.error('Link token error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initialize');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      setStep('loading-accounts');
      setIsProcessing(true);
      setInstitutionName(metadata?.institution?.name || 'Your Bank');

      // Exchange public token for access token
      const { data: exchangeData, error: exchangeError } = await supabase.functions.invoke('ai-bank-connect', {
        body: {
          action: 'exchange-public-token',
          publicToken
        }
      });

      if (exchangeError || !exchangeData?.success) {
        throw new Error(exchangeData?.error || 'Failed to connect to bank');
      }

      const newAccessToken = exchangeData.accessToken;
      const newItemId = exchangeData.itemId;
      setAccessToken(newAccessToken);
      setItemId(newItemId);

      // Fetch accounts using the access token
      const { data: accountsData, error: accountsError } = await supabase.functions.invoke('ai-bank-connect', {
        body: {
          action: 'discover_accounts',
          accessToken: newAccessToken
        }
      });

      if (accountsError || !accountsData?.accounts) {
        throw new Error(accountsData?.error || 'Failed to fetch accounts');
      }

      setDiscoveredAccounts(accountsData.accounts);
      setStep('select-accounts');
    } catch (err) {
      console.error('Plaid connection error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Connection failed');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const onPlaidExit = useCallback((error: any) => {
    if (error) {
      console.error('Plaid exit with error:', error);
      setErrorMessage(error.display_message || error.error_message || 'Connection cancelled');
      setStep('error');
    }
  }, []);

  const { open: openPlaidLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  const handleStartLink = () => {
    if (ready) {
      setStep('linking');
      openPlaidLink();
    }
  };

  const toggleAccountSelection = (accountId: string) => {
    setDiscoveredAccounts(prev => 
      prev.map(acc => 
        acc.id === accountId ? { ...acc, selected: !acc.selected } : acc
      )
    );
  };

  const handleImportAccounts = async () => {
    const selectedAccounts = discoveredAccounts.filter(acc => acc.selected);
    
    if (selectedAccounts.length === 0) {
      toast.error('Please select at least one account');
      return;
    }

    setIsProcessing(true);

    try {
      // Capture token values NOW before any state changes
      const capturedAccessToken = accessToken;
      const capturedItemId = itemId;

      for (const account of selectedAccounts) {
        // Await each account creation so tokens are persisted before dialog resets
        await onAccountCreated({
          name: account.name,
          institution: institutionName,
          accountType: account.type,
          accountNumber: account.lastFour,
          balance: account.balance,
          plaidAccessToken: capturedAccessToken ?? undefined,
          plaidAccountId: account.plaidAccountId,
          plaidItemId: capturedItemId ?? undefined,
        });
      }
      
      setStep('complete');
      toast.success(`Successfully connected ${selectedAccounts.length} account(s)`);
    } catch {
      toast.error('Failed to import accounts');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setStep('init');
    setLinkToken(null);
    setAccessToken(null);
    setItemId(null);
    setDiscoveredAccounts([]);
    setErrorMessage('');
    setErrorHint('');
    setInstitutionName('');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    // Prevent focus-trap issues with Plaid Link (phone input) by keeping this dialog non-modal.
    if (!nextOpen) handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange} modal={false}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" />
            Connect to Online Banking
          </DialogTitle>
        </DialogHeader>

        {step === 'init' && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg text-sm border border-accent/30">
              <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div className="text-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">Live Banking Connection</p>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 border-accent text-accent">Production</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect your bank securely using your real online banking credentials. Your login is handled by Plaid — we never see your password.
                </p>
              </div>
            </div>
            
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <Building2 className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Securely Connect Your Bank</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Click below to open the secure bank connection window.
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleStartLink}
                disabled={!ready || isProcessing}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect Your Bank
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'linking' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <div>
              <p className="font-medium">Bank connection window is open</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete the login in the popup window
              </p>
            </div>
          </div>
        )}

        {step === 'loading-accounts' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <div>
              <p className="font-medium">Fetching your accounts...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connecting to {institutionName}
              </p>
            </div>
          </div>
        )}

        {step === 'select-accounts' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Connected to {institutionName}</span>
            </div>

            <div className="space-y-2">
              {discoveredAccounts.map((account) => (
                <Card
                  key={account.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    account.selected ? 'border-accent bg-accent/5' : ''
                  }`}
                  onClick={() => toggleAccountSelection(account.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={account.selected}
                        onChange={() => toggleAccountSelection(account.id)}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ****{account.lastFour} • {account.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(account.balance)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {account.type}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleImportAccounts}
                disabled={isProcessing || discoveredAccounts.filter(a => a.selected).length === 0}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>Import Selected Accounts</>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-lg">Bank Connected Successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your accounts have been imported from {institutionName}
              </p>
            </div>
            <Button onClick={handleClose} className="bg-accent hover:bg-accent/90">
              Done
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-lg">Connection Failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                {errorMessage || 'Unable to connect to your bank'}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={createLinkToken} className="bg-accent hover:bg-accent/90">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {step === 'product-not-authorized' && (
          <div className="py-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-amber-800 dark:text-amber-200">
                <p className="font-semibold text-base mb-2">
                  Transactions Product Not Enabled
                </p>
                <p className="text-sm mb-3">
                  {errorMessage}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {errorHint}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">To fix this:</p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
                <li>Go to <a href="https://dashboard.plaid.com/overview/production" target="_blank" rel="noopener noreferrer" className="text-accent underline hover:no-underline">Plaid Dashboard → Production Access</a></li>
                <li>Apply for <strong>Transactions</strong> product access</li>
                <li>Wait for Plaid approval (typically 1-3 business days)</li>
                <li>Return here and try connecting again</li>
              </ol>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button 
                onClick={() => window.open('https://dashboard.plaid.com/overview/production', '_blank')}
                className="bg-accent hover:bg-accent/90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Plaid Dashboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}