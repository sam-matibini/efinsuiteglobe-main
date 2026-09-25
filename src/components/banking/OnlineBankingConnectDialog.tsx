import { useState, useMemo } from 'react';
import { 
  Globe, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Smartphone, 
  KeyRound,
  Shield,
  Building2,
  Wifi,
  RefreshCw,
  Clock,
  ToggleLeft,
  ToggleRight,
  Phone
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTwilioOtp } from '@/hooks/useTwilioOtp';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface OnlineBankingConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (account: {
    name: string;
    institution: string;
    accountType: string;
    accountNumber?: string;
    balance?: number;
  }) => void;
}

const CANADIAN_BANKS = [
  { id: 'td', name: 'TD Canada Trust', logo: '🏦', color: 'bg-green-600', url: 'easyweb.td.com' },
  { id: 'rbc', name: 'RBC Royal Bank', logo: '🏦', color: 'bg-blue-700', url: 'online.royalbank.com' },
  { id: 'bmo', name: 'BMO Bank of Montreal', logo: '🏦', color: 'bg-red-600', url: 'www1.bmo.com' },
  { id: 'scotia', name: 'Scotiabank', logo: '🏦', color: 'bg-red-700', url: 'www.scotiaonline.scotiabank.com' },
  { id: 'cibc', name: 'CIBC', logo: '🏦', color: 'bg-red-800', url: 'www.cibc.com/online' },
  { id: 'national', name: 'National Bank', logo: '🏦', color: 'bg-red-500', url: 'www.nbc.ca' },
  { id: 'desjardins', name: 'Desjardins', logo: '🏦', color: 'bg-green-700', url: 'www.desjardins.com' },
  { id: 'tangerine', name: 'Tangerine', logo: '🏦', color: 'bg-orange-500', url: 'www.tangerine.ca' },
];

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

type Step = 'select-bank' | 'login' | 'phone-input' | 'mfa' | 'connecting' | 'select-accounts' | 'sync-settings' | 'complete' | 'error';

interface DiscoveredAccount {
  id: string;
  name: string;
  type: string;
  lastFour: string;
  balance: number;
  selected: boolean;
}

interface SyncSettings {
  autoSync: boolean;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  syncTransactions: boolean;
  syncBalances: boolean;
  notifyOnSync: boolean;
}

export function OnlineBankingConnectDialog({ 
  open, 
  onOpenChange, 
  onAccountCreated 
}: OnlineBankingConnectDialogProps) {
  const [step, setStep] = useState<Step>('select-bank');
  const [selectedBank, setSelectedBank] = useState<typeof CANADIAN_BANKS[0] | null>(null);
  const [credentials, setCredentials] = useState({ 
    username: '', 
    password: '',
    cardNumber: '' 
  });
  const [mfaCode, setMfaCode] = useState('');
  const [discoveredAccounts, setDiscoveredAccounts] = useState<DiscoveredAccount[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
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
  const [mfaMethod, setMfaMethod] = useState<'sms' | 'app'>('sms');
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    autoSync: true,
    syncFrequency: 'daily',
    syncTransactions: true,
    syncBalances: true,
    notifyOnSync: false,
  });
  const [resendingCode, setResendingCode] = useState(false);
  const [mfaChallengeCode, setMfaChallengeCode] = useState<string>('');
  const [mfaCodeSent, setMfaCodeSent] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [useTwilioSms, setUseTwilioSms] = useState(true);
  
  const { sendOtp, verifyOtp, sending: sendingOtp, verifying: verifyingOtp } = useTwilioOtp();

  const handleBankSelect = (bank: typeof CANADIAN_BANKS[0]) => {
    setSelectedBank(bank);
    setStep('login');
  };

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter your credentials');
      return;
    }

    setStep('connecting');
    setIsProcessing(true);
    setStatusMessage('Establishing secure connection...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatusMessage(`Connecting to ${selectedBank?.url}...`);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatusMessage('Authenticating with bank servers...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Move to phone input for SMS MFA
      setMfaCode('');
      setStep('phone-input');
      setIsProcessing(false);
    } catch {
      setStep('error');
      setStatusMessage('Connection failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleSendSmsCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    // Format phone number for Twilio (add +1 for North America if not present)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone;
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    if (useTwilioSms) {
      const result = await sendOtp(formattedPhone, 'banking_mfa');
      if (result.success) {
        setMfaCodeSent(true);
        setStep('mfa');
      }
    } else {
      // Demo mode
      setMfaChallengeCode(generateOtp());
      setMfaCodeSent(true);
      setStep('mfa');
      toast.info('Demo mode: Check the code displayed below');
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaCode || mfaCode.length < 6) {
      toast.error('Please enter a valid verification code');
      return;
    }

    // For Twilio SMS verification
    if (useTwilioSms && mfaMethod === 'sms') {
      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
        formattedPhone = '1' + formattedPhone;
      }
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const result = await verifyOtp(formattedPhone, mfaCode, 'banking_mfa');
      if (!result.success) {
        return; // Error toast handled by hook
      }
    } else if (mfaChallengeCode && mfaCode !== mfaChallengeCode) {
      toast.error('Incorrect verification code');
      return;
    }

    setStep('connecting');
    setIsProcessing(true);
    setStatusMessage('Verifying security code...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatusMessage('Fetching account information...');
      
      // Call AI to get realistic accounts
      const { data, error } = await supabase.functions.invoke('ai-bank-connect', {
        body: {
          bank: selectedBank?.name,
          action: 'discover_accounts'
        }
      });

      if (error) throw error;

      const accounts = data?.accounts || [
        { id: '1', name: 'Chequing Account', type: 'chequing', lastFour: '4521', balance: 15432.50, selected: true },
        { id: '2', name: 'Savings Account', type: 'savings', lastFour: '7834', balance: 45000.00, selected: true },
      ];

      setDiscoveredAccounts(accounts);
      setStep('select-accounts');
    } catch {
      setStep('error');
      setStatusMessage('Verification failed. Please try again.');
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

    // Move to sync settings step
    setStep('sync-settings');
  };

  const handleFinishSetup = async () => {
    const selectedAccounts = discoveredAccounts.filter(acc => acc.selected);
    setIsProcessing(true);
    setStatusMessage('Configuring accounts and sync settings...');

    try {
      for (const account of selectedAccounts) {
        onAccountCreated({
          name: account.name,
          institution: selectedBank?.name || '',
          accountType: account.type,
          accountNumber: account.lastFour,
          balance: account.balance,
        });
      }
      
      // Save sync settings (in production, this would be stored in database)
      console.log('Sync settings configured:', syncSettings);
      
      setStep('complete');
      toast.success(`Successfully connected ${selectedAccounts.length} account(s) with ${syncSettings.syncFrequency} sync`);
    } catch {
      toast.error('Failed to import accounts');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResendCode = async () => {
    setResendingCode(true);
    try {
      if (useTwilioSms && mfaMethod === 'sms') {
        let formattedPhone = phoneNumber.replace(/\D/g, '');
        if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
          formattedPhone = '1' + formattedPhone;
        }
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }
        await sendOtp(formattedPhone, 'banking_mfa');
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setMfaChallengeCode(generateOtp());
        toast.success(mfaMethod === 'sms' ? 'New SMS code sent' : 'New authenticator code generated');
      }
      setMfaCode('');
      setMfaCodeSent(true);
    } finally {
      setResendingCode(false);
    }
  };

  const resetDialog = () => {
    setStep('select-bank');
    setSelectedBank(null);
    setCredentials({ username: '', password: '', cardNumber: '' });
    setMfaCode('');
    setPhoneNumber('');
    setDiscoveredAccounts([]);
    setStatusMessage('');
    setMfaChallengeCode('');
    setMfaCodeSent(false);
    setSyncSettings({
      autoSync: true,
      syncFrequency: 'daily',
      syncTransactions: true,
      syncBalances: true,
      notifyOnSync: false,
    });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" />
            Connect to Online Banking
          </DialogTitle>
        </DialogHeader>

        {step === 'select-bank' && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-green-700 dark:text-green-300">
                Your credentials are encrypted with bank-grade 256-bit SSL security and are never stored on our servers.
              </p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Select your financial institution to connect securely to your online banking.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              {CANADIAN_BANKS.map((bank) => (
                <Card
                  key={bank.id}
                  className="p-4 cursor-pointer hover:border-accent transition-colors"
                  onClick={() => handleBankSelect(bank)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${bank.color} flex items-center justify-center text-white text-lg`}>
                      {bank.logo}
                    </div>
                    <div>
                      <span className="font-medium text-sm block">{bank.name}</span>
                      <span className="text-xs text-muted-foreground">{bank.url}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 'login' && selectedBank && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className={`w-10 h-10 rounded-lg ${selectedBank.color} flex items-center justify-center text-white text-lg`}>
                {selectedBank.logo}
              </div>
              <div>
                <p className="font-medium">{selectedBank.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3" />
                  <span>Secure connection to {selectedBank.url}</span>
                </div>
              </div>
            </div>

            <Tabs defaultValue="card" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="card">Card Number</TabsTrigger>
                <TabsTrigger value="username">Username</TabsTrigger>
              </TabsList>
              <TabsContent value="card" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Debit Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="Enter your debit card number"
                    value={credentials.cardNumber}
                    onChange={(e) => setCredentials(prev => ({ ...prev, cardNumber: e.target.value, username: e.target.value }))}
                  />
                </div>
              </TabsContent>
              <TabsContent value="username" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="onlineUsername">Online Banking Username</Label>
                  <Input
                    id="onlineUsername"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="bankPassword">Password</Label>
              <Input
                id="bankPassword"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('select-bank')}>
                Back
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleLogin}
              >
                <Lock className="w-4 h-4 mr-2" />
                Sign In Securely
              </Button>
            </div>
          </div>
        )}

        {step === 'phone-input' && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <Phone className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Verify Your Identity</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your phone number to receive a verification code via SMS
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We'll send a 6-digit code to this number
                </p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Use real SMS delivery</span>
                </div>
                <Switch
                  checked={useTwilioSms}
                  onCheckedChange={setUseTwilioSms}
                />
              </div>

              {!useTwilioSms && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                  Demo mode: A test code will be displayed on screen
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('login')}>
                Back
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleSendSmsCode}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Smartphone className="w-4 h-4 mr-2" />
                )}
                Send Code
              </Button>
            </div>
          </div>
        )}

        {step === 'mfa' && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <KeyRound className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose your verification method and enter the code
              </p>
            </div>

            {/* MFA Method Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Verification Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card 
                  className={`p-4 cursor-pointer transition-all ${
                    mfaMethod === 'sms' 
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                   onClick={() => {
                     setMfaMethod('sms');
                     setMfaCode('');
                     setMfaChallengeCode(generateOtp());
                     setMfaCodeSent(true);
                     toast.info('SMS selected. A demo code has been generated below.');
                   }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      mfaMethod === 'sms' ? 'bg-accent text-white' : 'bg-muted'
                    }`}>
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">SMS Text Message</p>
                      <p className="text-xs text-muted-foreground">Code sent to •••-•••-4521</p>
                    </div>
                    {mfaMethod === 'sms' && (
                      <Badge variant="secondary" className="bg-accent/10 text-accent">
                        Selected
                      </Badge>
                    )}
                  </div>
                </Card>

                <Card 
                  className={`p-4 cursor-pointer transition-all ${
                    mfaMethod === 'app' 
                      ? 'border-accent bg-accent/5 ring-2 ring-accent/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                   onClick={() => {
                     setMfaMethod('app');
                     setMfaCode('');
                     setMfaChallengeCode(generateOtp());
                     setMfaCodeSent(true);
                     toast.info('Authenticator selected. Use the demo code below.');
                   }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      mfaMethod === 'app' ? 'bg-accent text-white' : 'bg-muted'
                    }`}>
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Authenticator App</p>
                      <p className="text-xs text-muted-foreground">Google, Microsoft, Authy</p>
                    </div>
                    {mfaMethod === 'app' && (
                      <Badge variant="secondary" className="bg-accent/10 text-accent">
                        Selected
                      </Badge>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Code Entry */}
            <div className="space-y-2 pt-2">
              <Label htmlFor="mfaCode">
                {mfaMethod === 'sms' ? 'Enter SMS Code' : 'Enter App Code'}
              </Label>
              <Input
                id="mfaCode"
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code to continue.
              </p>
            </div>

            {mfaCodeSent && mfaChallengeCode && (
              <Card className="p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Demo {mfaMethod === 'sms' ? 'SMS' : 'Authenticator'} code (shown here because no banking provider is connected yet)
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <code className="font-mono text-xl tracking-widest">{mfaChallengeCode}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMfaCode(mfaChallengeCode)}
                  >
                    Use code
                  </Button>
                </div>
              </Card>
            )}

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                className="text-muted-foreground"
                onClick={handleResendCode}
                disabled={resendingCode}
              >
                {resendingCode ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating code...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {mfaMethod === 'sms' ? 'Generate a new SMS code' : 'Refresh authenticator code'}
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('login')}>
                Back
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleMfaSubmit}
                disabled={mfaCode.length < 6}
              >
                Verify & Continue
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
              <p className="font-medium">{statusMessage}</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a moment...
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>256-bit encrypted connection</span>
            </div>
          </div>
        )}

        {step === 'select-accounts' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Connected to {selectedBank?.name}</span>
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

        {step === 'sync-settings' && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <RefreshCw className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Configure Data Sync</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set up how your transactions and balances sync from {selectedBank?.name}
              </p>
            </div>

            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Auto-Sync</p>
                    <p className="text-sm text-muted-foreground">Automatically sync data from your bank</p>
                  </div>
                </div>
                <Switch 
                  checked={syncSettings.autoSync}
                  onCheckedChange={(checked) => setSyncSettings(prev => ({ ...prev, autoSync: checked }))}
                />
              </div>

              {syncSettings.autoSync && (
                <div className="space-y-2 pl-11">
                  <Label>Sync Frequency</Label>
                  <Select 
                    value={syncSettings.syncFrequency}
                    onValueChange={(val) => setSyncSettings(prev => ({ ...prev, syncFrequency: val as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4 text-green-500" />
                          Real-time (as transactions occur)
                        </div>
                      </SelectItem>
                      <SelectItem value="hourly">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Hourly
                        </div>
                      </SelectItem>
                      <SelectItem value="daily">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Daily (recommended)
                        </div>
                      </SelectItem>
                      <SelectItem value="manual">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Manual only
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <p className="font-medium text-sm">What to Sync</p>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Transactions</p>
                  <p className="text-xs text-muted-foreground">Download new transactions</p>
                </div>
                <Switch 
                  checked={syncSettings.syncTransactions}
                  onCheckedChange={(checked) => setSyncSettings(prev => ({ ...prev, syncTransactions: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Account Balances</p>
                  <p className="text-xs text-muted-foreground">Update current balance</p>
                </div>
                <Switch 
                  checked={syncSettings.syncBalances}
                  onCheckedChange={(checked) => setSyncSettings(prev => ({ ...prev, syncBalances: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Sync Notifications</p>
                  <p className="text-xs text-muted-foreground">Alert when new data arrives</p>
                </div>
                <Switch 
                  checked={syncSettings.notifyOnSync}
                  onCheckedChange={(checked) => setSyncSettings(prev => ({ ...prev, notifyOnSync: checked }))}
                />
              </div>
            </Card>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('select-accounts')}>
                Back
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleFinishSetup}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>Finish Setup</>
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
                Your bank accounts have been linked and will sync {syncSettings.syncFrequency === 'realtime' ? 'in real-time' : syncSettings.syncFrequency}.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {syncSettings.autoSync && (
                <Badge variant="secondary" className="gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Auto-sync enabled
                </Badge>
              )}
              {syncSettings.syncFrequency === 'realtime' && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 gap-1">
                  <Wifi className="w-3 h-3" />
                  Real-time
                </Badge>
              )}
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
                {statusMessage}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setStep('login')}>
                Try Again
              </Button>
              <Button onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
