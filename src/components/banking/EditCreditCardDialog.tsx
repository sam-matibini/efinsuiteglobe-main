import { useState, useEffect, useMemo } from 'react';
import { CreditCard as CreditCardIcon, BookOpen, DollarSign, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard } from '@/hooks/useCreditCards';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCreditCardIssuersForCountry, CreditCardIssuer } from '@/data/localizedBankingInstitutions';
import { getAllLocalizedCurrencies } from '@/hooks/useLocalizedCurrency';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_header: boolean;
  is_active: boolean;
}

interface EditCreditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCard: CreditCard | null;
  glAccounts: Account[];
  onSave: (id: string, updates: Partial<CreditCard>) => Promise<void>;
  isPending?: boolean;
}

// Fallback issuers for countries without specific configuration
const DEFAULT_CREDIT_CARD_ISSUERS: CreditCardIssuer[] = [
  { code: 'VISA', name: 'Visa', network: 'visa', type: 'bank' },
  { code: 'MASTERCARD', name: 'Mastercard', network: 'mastercard', type: 'bank' },
  { code: 'AMEX', name: 'American Express', network: 'amex', type: 'independent' },
  { code: 'DISCOVER', name: 'Discover', network: 'discover', type: 'independent' },
];

export function EditCreditCardDialog({
  open,
  onOpenChange,
  creditCard,
  glAccounts,
  onSave,
  isPending,
}: EditCreditCardDialogProps) {
  const { organization } = useCurrentOrganization();
  const countryCode = organization?.country || 'CA';
  
  // Get localized credit card issuers based on organization country
  const creditCardIssuers = useMemo(() => {
    const issuers = getCreditCardIssuersForCountry(countryCode);
    return issuers.length > 0 ? issuers : DEFAULT_CREDIT_CARD_ISSUERS;
  }, [countryCode]);
  
  const [formData, setFormData] = useState({
    name: '',
    issuer: '',
    cardNumber: '',
    creditLimit: '',
    currency: organization?.currency || 'CAD',
    statementClosingDay: '25',
    paymentDueDay: '21',
    glAccountId: '',
    openingBalance: 0,
    openingDate: '',
  });

  // Filter to show liability accounts for credit cards - enhanced code matching
  const liabilityGLAccounts = glAccounts.filter(a => 
    a.account_type === 'liability' && 
    !a.is_header && 
    a.is_active &&
    (a.code.startsWith('2-01-110') || a.code.startsWith('200') || a.code.startsWith('201') || a.code.startsWith('210') ||
     a.name.toLowerCase().includes('credit') || a.name.toLowerCase().includes('payable'))
  );

  // Sync form data when credit card changes
  useEffect(() => {
    if (creditCard) {
      setFormData({
        name: creditCard.name || '',
        issuer: creditCard.issuer || '',
        cardNumber: creditCard.card_number || '',
        creditLimit: creditCard.credit_limit?.toString() || '',
        currency: creditCard.currency || 'CAD',
        statementClosingDay: creditCard.statement_closing_day?.toString() || '25',
        paymentDueDay: creditCard.payment_due_day?.toString() || '21',
        glAccountId: creditCard.gl_account_id || '',
        openingBalance: creditCard.opening_balance || 0,
        openingDate: creditCard.opening_date || '',
      });
    }
  }, [creditCard]);

  const handleSubmit = async () => {
    if (!creditCard || !formData.name || !formData.issuer) return;

    await onSave(creditCard.id, {
      name: formData.name,
      issuer: formData.issuer,
      card_number: formData.cardNumber || null,
      credit_limit: parseFloat(formData.creditLimit) || 0,
      currency: formData.currency,
      statement_closing_day: parseInt(formData.statementClosingDay) || 25,
      payment_due_day: parseInt(formData.paymentDueDay) || 21,
      gl_account_id: formData.glAccountId || null,
      opening_balance: formData.openingBalance,
      opening_date: formData.openingDate || null,
    });
    onOpenChange(false);
  };

  if (!creditCard) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5" />
            Edit Credit Card
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCardName">Card Name</Label>
              <Input 
                id="editCardName" 
                placeholder="e.g., Business Visa"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editIssuer">Card Issuer</Label>
                <Select
                  value={formData.issuer}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, issuer: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select issuer" />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCardIssuers.map(issuer => (
                      <SelectItem key={issuer.code} value={issuer.name}>
                        {issuer.name}
                        {issuer.type === 'fleet' && <span className="ml-1 text-xs text-muted-foreground">(Fleet)</span>}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCurrency">Currency</Label>
                <Select 
                  value={formData.currency}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {getAllLocalizedCurrencies(countryCode).map((curr) => (
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
                <Label htmlFor="editCardNumber">Card Number (Last 4)</Label>
                <Input 
                  id="editCardNumber" 
                  placeholder="1234" 
                  maxLength={4}
                  value={formData.cardNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCreditLimit">Credit Limit</Label>
                <Input 
                  id="editCreditLimit" 
                  type="number" 
                  placeholder="10000.00"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Opening Balance Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editOpeningBalance" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Opening Balance
                </Label>
                <FormattedNumberInput
                  value={formData.openingBalance}
                  onChange={(val) => setFormData(prev => ({ ...prev, openingBalance: val }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editOpeningDate" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Opening Date
                </Label>
                <Input
                  id="editOpeningDate"
                  type="date"
                  value={formData.openingDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, openingDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStatementClosingDay">Statement Closing Day</Label>
                <Select
                  value={formData.statementClosingDay}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, statementClosingDay: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPaymentDueDay">Payment Due (Days After)</Label>
                <Select
                  value={formData.paymentDueDay}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, paymentDueDay: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[14, 21, 25, 30].map(days => (
                      <SelectItem key={days} value={days.toString()}>{days} days</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editGlAccount" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Link to GL Account
              </Label>
              <Select
                value={formData.glAccountId}
                onValueChange={(val) => setFormData(prev => ({ ...prev, glAccountId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GL account (liability)" />
                </SelectTrigger>
                <SelectContent>
                  {liabilityGLAccounts.length > 0 ? (
                    liabilityGLAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No credit card liability accounts found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90" 
                onClick={handleSubmit}
                disabled={isPending || !formData.name || !formData.issuer}
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
