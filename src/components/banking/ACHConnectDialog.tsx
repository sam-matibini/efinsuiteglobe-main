import { useState, useMemo } from 'react';
import { 
  Building2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  DollarSign,
  ShieldCheck,
  ArrowRightLeft,
  Info,
  Globe
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getBankingConfig, getClearingHousesForCountry } from '@/data/localizedBankingInstitutions';

interface ACHConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: (account: {
    name: string;
    institution: string;
    accountType: string;
    accountNumber?: string;
    routingNumber?: string;
  }) => void;
}

type Step = 'form' | 'verify' | 'complete' | 'error';
type AccountType = 'checking' | 'savings';

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

export function ACHConnectDialog({ 
  open, 
  onOpenChange, 
  onAccountCreated 
}: ACHConnectDialogProps) {
  const { organization } = useCurrentOrganization();
  const [step, setStep] = useState<Step>('form');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    institutionNumber: '',
    transitNumber: '',
    accountNumber: '',
    accountType: 'checking' as AccountType,
    accountName: '',
    acceptedTerms: false,
  });
  const [microDeposits, setMicroDeposits] = useState({ amount1: '', amount2: '' });

  // Get localized banking config
  const countryCode = getCountryCode(organization?.country || '');
  const bankingConfig = useMemo(() => getBankingConfig(countryCode), [countryCode]);
  const institutions = bankingConfig?.institutions || [];
  const clearingHouses = useMemo(() => getClearingHousesForCountry(countryCode), [countryCode]);
  const primaryClearing = clearingHouses.find(ch => ch.type === 'ach') || clearingHouses[0];

  const selectedInstitution = institutions.find(i => i.code === formData.institutionNumber);

  const handleSubmitForm = async () => {
    if (!formData.institutionNumber || !formData.transitNumber || !formData.accountNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.transitNumber.length !== 5) {
      toast.error('Transit number must be 5 digits');
      return;
    }

    if (!formData.acceptedTerms) {
      toast.error('Please accept the terms to continue');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate sending micro-deposits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Micro-deposits initiated! Two small deposits will appear in your account within 1-2 business days.');
      setStep('verify');
    } catch {
      toast.error('Failed to initiate verification');
      setStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyDeposits = async () => {
    if (!microDeposits.amount1 || !microDeposits.amount2) {
      toast.error('Please enter both micro-deposit amounts');
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create the account
      onAccountCreated({
        name: formData.accountName || `${selectedInstitution?.name || 'Bank'} - ${formData.accountType}`,
        institution: selectedInstitution?.name || 'Unknown Bank',
        accountType: formData.accountType,
        accountNumber: formData.accountNumber.slice(-4),
        routingNumber: `${formData.institutionNumber}${formData.transitNumber}`,
      });

      setStep('complete');
      toast.success('Bank account verified and connected!');
    } catch {
      toast.error('Verification failed. Please check the amounts and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipVerification = () => {
    // Allow demo/testing to skip micro-deposit verification
    onAccountCreated({
      name: formData.accountName || `${selectedInstitution?.name || 'Bank'} - ${formData.accountType}`,
      institution: selectedInstitution?.name || 'Unknown Bank',
      accountType: formData.accountType,
      accountNumber: formData.accountNumber.slice(-4),
      routingNumber: `${formData.institutionNumber}${formData.transitNumber}`,
    });

    setStep('complete');
    toast.success('Bank account connected (verification skipped)');
  };

  const resetDialog = () => {
    setStep('form');
    setFormData({
      institutionNumber: '',
      transitNumber: '',
      accountNumber: '',
      accountType: 'checking',
      accountName: '',
      acceptedTerms: false,
    });
    setMicroDeposits({ amount1: '', amount2: '' });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            {countryCode === 'CA' ? 'EFT/ACH' : countryCode === 'US' ? 'ACH' : primaryClearing?.name || 'Bank'} Connection
            <Badge variant="outline" className="ml-2 text-xs">
              <Globe className="w-3 h-3 mr-1" />
              {bankingConfig?.countryName || 'International'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-blue-700 dark:text-blue-300">
                <p>
                  Connect via <strong>{primaryClearing?.name || 'electronic transfer'}</strong> to receive payments directly.
                </p>
                {primaryClearing && (
                  <p className="text-xs mt-1 opacity-80">{primaryClearing.description}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountName">Account Nickname (Optional)</Label>
              <Input
                id="accountName"
                placeholder="e.g., Business Chequing"
                value={formData.accountName}
                onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="institutionNumber">{bankingConfig?.accountNumberFormat?.label || 'Institution'}</Label>
                <Select
                  value={formData.institutionNumber}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, institutionNumber: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(inst => (
                      <SelectItem key={inst.code} value={inst.code}>
                        {inst.code} - {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transitNumber">
                  {bankingConfig?.transitFormat?.label || bankingConfig?.routingFormat?.label || 'Branch Code'}
                </Label>
                <Input
                  id="transitNumber"
                  placeholder={bankingConfig?.transitFormat?.placeholder || bankingConfig?.routingFormat?.placeholder || '12345'}
                  maxLength={bankingConfig?.transitFormat?.maxLength || bankingConfig?.routingFormat?.maxLength || 9}
                  value={formData.transitNumber}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    transitNumber: e.target.value.replace(/\D/g, '').slice(0, bankingConfig?.transitFormat?.maxLength || 9) 
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="achAccountNumber">{bankingConfig?.accountNumberFormat?.label || 'Account Number'}</Label>
              <Input
                id="achAccountNumber"
                placeholder={bankingConfig?.accountNumberFormat?.placeholder || 'Enter account number'}
                maxLength={bankingConfig?.accountNumberFormat?.maxLength || 17}
                value={formData.accountNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, '') }))}
              />
              <p className="text-xs text-muted-foreground">
                Found on your cheque or in your online banking
              </p>
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`p-4 cursor-pointer transition-colors ${
                    formData.accountType === 'checking' ? 'border-accent bg-accent/5' : ''
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, accountType: 'checking' }))}
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-accent" />
                    <span className="font-medium">Chequing</span>
                  </div>
                </Card>
                <Card
                  className={`p-4 cursor-pointer transition-colors ${
                    formData.accountType === 'savings' ? 'border-accent bg-accent/5' : ''
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, accountType: 'savings' }))}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">Savings</span>
                  </div>
                </Card>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox
                id="terms"
                checked={formData.acceptedTerms}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  acceptedTerms: checked as boolean 
                }))}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I authorize micro-deposits to verify my account and agree to the ACH authorization terms.
              </label>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span>{bankingConfig?.complianceLabels?.encryption || 'Bank-grade encryption'} • {bankingConfig?.complianceLabels?.regulation || 'Secure data handling'}</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleSubmitForm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Initiating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Verify Account
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <DollarSign className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg">Verify Micro-Deposits</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Two small deposits have been sent to your account. Enter the amounts to verify ownership.
              </p>
            </div>

            <Card className="p-4 bg-muted/50">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-accent" />
                <div>
                  <p className="font-medium">{selectedInstitution?.name}</p>
                  <p className="text-sm text-muted-foreground">****{formData.accountNumber.slice(-4)}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deposit1">Deposit 1</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$0.</span>
                  <Input
                    id="deposit1"
                    placeholder="00"
                    className="pl-10"
                    maxLength={2}
                    value={microDeposits.amount1}
                    onChange={(e) => setMicroDeposits(prev => ({ 
                      ...prev, 
                      amount1: e.target.value.replace(/\D/g, '').slice(0, 2) 
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit2">Deposit 2</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$0.</span>
                  <Input
                    id="deposit2"
                    placeholder="00"
                    className="pl-10"
                    maxLength={2}
                    value={microDeposits.amount2}
                    onChange={(e) => setMicroDeposits(prev => ({ 
                      ...prev, 
                      amount2: e.target.value.replace(/\D/g, '').slice(0, 2) 
                    }))}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Deposits usually appear within 1-2 business days. Check your bank statement for two deposits under $1.00.
            </p>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={handleSkipVerification}>
                Skip for Demo
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('form')}>
                  Back
                </Button>
                <Button 
                  className="bg-accent hover:bg-accent/90"
                  onClick={handleVerifyDeposits}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Account'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-lg">ACH Connection Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your bank account is now connected for ACH transfers.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </Badge>
              <Badge variant="secondary">ACH Enabled</Badge>
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
                Unable to initiate micro-deposits. Please verify your banking details and try again.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setStep('form')}>
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
