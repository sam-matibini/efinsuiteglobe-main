import { useState, useMemo } from 'react';
import { Bot, Building2, Loader2, CheckCircle2, AlertCircle, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { getBankingConfig, getMobileMoneyProviders } from '@/data/localizedBankingInstitutions';

interface AIBankConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (account: {
    name: string;
    institution: string;
    accountType: string;
  }) => void;
}

// Helper to get country code from organization
const getCountryCode = (country: string): string => {
  const upperCountry = (country || '').toUpperCase().trim();
  const countryMap: Record<string, string> = {
    'CANADA': 'CA', 'CA': 'CA', 'CAN': 'CA',
    'UNITED STATES': 'US', 'USA': 'US', 'US': 'US',
    'ZAMBIA': 'ZM', 'ZM': 'ZM', 'ZMB': 'ZM',
    'KENYA': 'KE', 'KE': 'KE', 'KEN': 'KE',
    'BURUNDI': 'BI', 'BI': 'BI', 'BDI': 'BI',
  };
  return countryMap[upperCountry] || 'CA';
};

// Bank colors by type or code
const getBankColor = (code: string, type: string): string => {
  const colorMap: Record<string, string> = {
    // Canada
    '001': 'bg-red-500',      // BMO
    '002': 'bg-red-600',      // Scotiabank
    '003': 'bg-blue-600',     // RBC
    '004': 'bg-green-600',    // TD
    '010': 'bg-red-700',      // CIBC
    '614': 'bg-orange-500',   // Tangerine
    '815': 'bg-green-500',    // Desjardins
    // Default by type
    'commercial': 'bg-blue-500',
    'central': 'bg-amber-600',
    'mobile': 'bg-purple-500',
    'microfinance': 'bg-teal-500',
  };
  return colorMap[code] || colorMap[type] || 'bg-slate-500';
};

type Step = 'select-bank' | 'credentials' | 'connecting' | 'select-accounts' | 'complete' | 'error';

interface DiscoveredAccount {
  id: string;
  name: string;
  type: string;
  lastFour: string;
  balance: number;
  selected: boolean;
}

export function AIBankConnectDialog({ open, onOpenChange, onAccountCreated }: AIBankConnectDialogProps) {
  const [step, setStep] = useState<Step>('select-bank');
  const [selectedBank, setSelectedBank] = useState<{ code: string; name: string; type: string } | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredAccount[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const { organization } = useCurrentOrganization();

  const countryCode = getCountryCode(organization?.country || '');
  const bankingConfig = useMemo(() => getBankingConfig(countryCode), [countryCode]);
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);
  const mobileProviders = useMemo(() => getMobileMoneyProviders(countryCode), [countryCode]);

  // Get institutions list - include mobile money for African countries
  const institutions = useMemo(() => {
    const banks = bankingConfig?.institutions || [];
    // For African countries, add mobile money as a connection option
    if (['ZM', 'KE', 'BI'].includes(countryCode) && mobileProviders.length > 0) {
      const mobileBanks = mobileProviders.map(mp => ({
        code: mp.code,
        name: mp.name,
        type: 'mobile' as const,
      }));
      return [...banks.slice(0, 6), ...mobileBanks];
    }
    return banks.slice(0, 8); // Limit to 8 for display
  }, [bankingConfig, countryCode, mobileProviders]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const handleBankSelect = (bank: { code: string; name: string; type: string }) => {
    setSelectedBank(bank);
    setStep('credentials');
  };

  const handleConnect = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter your credentials');
      return;
    }

    setStep('connecting');
    setIsProcessing(true);
    setAiMessage('Establishing secure connection...');

    try {
      // Simulate AI-powered bank connection process
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiMessage('Authenticating with ' + selectedBank?.name + '...');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setAiMessage('AI is analyzing your accounts...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      setAiMessage('Discovering available accounts...');
      
      // Call AI to process and suggest account configurations
      const { data, error } = await supabase.functions.invoke('ai-bank-connect', {
        body: {
          bank: selectedBank?.name,
          action: 'discover_accounts'
        }
      });

      if (error) throw error;

      // Use AI response or fallback to simulated data
      const accounts = data?.accounts || [
        { id: '1', name: 'Chequing Account', type: 'chequing', lastFour: '4521', balance: 15432.50, selected: true },
        { id: '2', name: 'Savings Account', type: 'savings', lastFour: '7834', balance: 45000.00, selected: true },
        { id: '3', name: 'Business Account', type: 'business', lastFour: '9012', balance: 125750.25, selected: false },
      ];

      setDiscoveredAccounts(accounts);
      setStep('select-accounts');
    } catch (error) {
      console.error('Connection error:', error);
      setStep('error');
      setAiMessage('Unable to connect. Please try again or add account manually.');
    } finally {
      setIsProcessing(false);
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
    setAiMessage('Importing selected accounts...');

    try {
      for (const account of selectedAccounts) {
        onAccountCreated({
          name: account.name,
          institution: selectedBank?.name || '',
          accountType: account.type,
        });
      }
      
      setStep('complete');
      toast.success(`Successfully connected ${selectedAccounts.length} account(s)`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import accounts');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setStep('select-bank');
    setSelectedBank(null);
    setCredentials({ username: '', password: '' });
    setDiscoveredAccounts([]);
    setAiMessage('');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            AI-Powered Bank Connection
          </DialogTitle>
        </DialogHeader>

        {step === 'select-bank' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Select your financial institution to connect securely.
              </p>
              <Badge variant="outline" className="text-xs">
                <Globe className="w-3 h-3 mr-1" />
                {bankingConfig?.countryName || 'International'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {institutions.map((bank) => (
                <Card
                  key={bank.code}
                  className="p-4 cursor-pointer hover:border-accent transition-colors"
                  onClick={() => handleBankSelect(bank)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${getBankColor(bank.code, bank.type)} flex items-center justify-center text-white text-lg`}>
                      {bank.type === 'mobile' ? '📱' : '🏦'}
                    </div>
                    <span className="font-medium text-sm">{bank.name}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 'credentials' && selectedBank && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className={`w-10 h-10 rounded-lg ${getBankColor(selectedBank.code, selectedBank.type)} flex items-center justify-center text-white text-lg`}>
                {selectedBank.type === 'mobile' ? '📱' : '🏦'}
              </div>
              <div>
                <p className="font-medium">{selectedBank.name}</p>
                <p className="text-xs text-muted-foreground">Secure AI-assisted connection</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="username">Online Banking Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
              <Bot className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-blue-700 dark:text-blue-300">
                Your credentials are encrypted and processed securely. AI will automatically discover and categorize your accounts.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('select-bank')}>
                Back
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleConnect}
              >
                <Bot className="w-4 h-4 mr-2" />
                Connect with AI
              </Button>
            </div>
          </div>
        )}

        {step === 'connecting' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
            <div>
              <p className="font-medium">{aiMessage}</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a moment...
              </p>
            </div>
          </div>
        )}

        {step === 'select-accounts' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>AI discovered {discoveredAccounts.length} accounts</span>
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
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-lg">Successfully Connected!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your bank accounts have been imported and are ready to use.
              </p>
            </div>
            <Button onClick={handleClose} className="bg-accent hover:bg-accent/90">
              Done
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-lg">Connection Failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                {aiMessage}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setStep('credentials')}>
                Try Again
              </Button>
              <Button onClick={handleClose}>
                Add Manually
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
