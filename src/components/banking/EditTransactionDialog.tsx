import { useState, useEffect, useMemo } from 'react';
import { Save, X, Send, DollarSign, FileText, User, Percent, Lock, CalendarIcon, Heart, CheckCircle } from 'lucide-react';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchableGLAccountSelect } from './SearchableGLAccountSelect';
import { SearchableCustomerSelect } from './SearchableCustomerSelect';
import { TaxCodeSelect, calculateTax } from './TaxCodeSelect';
import { getCategoryGroups } from '@/data/transactionCategories';
import { getIndustryConfig } from '@/data/industries';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BankTransaction } from '@/hooks/useBankTransactions';
import { usePostTransactionToGL } from '@/hooks/useBankingGL';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useDonationForTransaction, useCreateDonationFromTransaction } from '@/hooks/useDonationFromTransaction';
import { TaxCode } from '@/hooks/useSalesTax';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface EditTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  onSave: (updates: Partial<BankTransaction>) => void;
}

const transactionTypeOptions = [
  { value: 'deposit', label: 'Deposit', color: 'text-success' },
  { value: 'withdrawal', label: 'Withdrawal', color: '' },
  { value: 'transfer', label: 'Transfer', color: 'text-blue-600' },
];

// Searchable Category Select Component with grouped categories
function SearchableCategorySelect({
  value,
  onValueChange,
  disabled,
  categoryGroups,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  categoryGroups: { label: string; categories: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    if (!search) return categoryGroups;
    const lowerSearch = search.toLowerCase();
    return categoryGroups
      .map((group) => ({
        ...group,
        categories: group.categories.filter((cat) =>
          cat.toLowerCase().includes(lowerSearch)
        ),
      }))
      .filter((group) => group.categories.length > 0);
  }, [search, categoryGroups]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between mt-1.5 font-normal"
          disabled={disabled}
        >
          {value || 'Select category...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search categories..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No category found.</CommandEmpty>
            {filteredGroups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.categories.map((cat) => (
                  <CommandItem
                    key={cat}
                    value={cat}
                    onSelect={() => {
                      onValueChange(cat);
                      setOpen(false);
                      setSearch('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === cat ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {cat}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Donation type mapping from bank transaction context
const DONATION_TYPE_MAP: Record<string, string> = {
  'e-transfer': 'e_transfer',
  'etransfer': 'e_transfer',
  'autodeposit': 'e_transfer',
  'cheque': 'cheque',
  'check': 'cheque',
  'wire': 'wire_transfer',
  'credit card': 'credit_card',
  'cash': 'cash',
};

function inferDonationType(description: string): 'cash' | 'cheque' | 'credit_card' | 'e_transfer' | 'wire_transfer' {
  const lower = description.toLowerCase();
  for (const [keyword, type] of Object.entries(DONATION_TYPE_MAP)) {
    if (lower.includes(keyword)) return type as any;
  }
  return 'e_transfer'; // default for bank transactions
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSave,
}: EditTransactionDialogProps) {
  const { organization } = useCurrentOrganization();
  const postToGL = usePostTransactionToGL();
  const createDonation = useCreateDonationFromTransaction();

  // Check if this transaction already has a linked donation
  const { data: linkedDonation } = useDonationForTransaction(transaction?.id);

  // Derive accounting framework from organization industry
  const industryConfig = useMemo(() => {
    return organization?.industry ? getIndustryConfig(organization.industry) : null;
  }, [organization?.industry]);

  const isNpoOrg = industryConfig?.accountingFramework === 'ASNPO';

  const dynamicCategoryGroups = useMemo(() => {
    const framework = industryConfig?.accountingFramework ?? 'ASPE';
    return getCategoryGroups(framework, 'bank');
  }, [industryConfig?.accountingFramework]);

  const [description, setDescription] = useState('');
  const [payeePayor, setPayeePayor] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [memo, setMemo] = useState('');
  const [glAccountId, setGlAccountId] = useState('');
  const [, setGlAccountName] = useState('');
  const [transactionType, setTransactionType] = useState<string>('');
  const [selectedTaxCode, setSelectedTaxCode] = useState<TaxCode | null>(null);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [linkedCustomerId, setLinkedCustomerId] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  
  
  // Date editing states
  const [transactionDate, setTransactionDate] = useState<Date | undefined>(undefined);
  const [transactionDateOpen, setTransactionDateOpen] = useState(false);

  // Calculate tax amounts
  const taxCalculation = useMemo(() => {
    if (!transaction) return null;
    const amount = Math.abs(Number(transaction.amount));
    const txDir = (transaction.transaction_type as 'deposit' | 'withdrawal' | 'transfer') || 'withdrawal';
    return calculateTax(amount, selectedTaxCode, taxInclusive, txDir);
  }, [transaction, selectedTaxCode, taxInclusive]);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setPayeePayor(transaction.payee_payor || '');
      setReference(transaction.reference || '');
      setCategory(transaction.category || '');
      setMemo(transaction.memo || '');
      setGlAccountId(transaction.gl_account_id || '');
      setTransactionType(transaction.transaction_type || 'withdrawal');
      setSelectedTaxCode(null);
      setTaxInclusive(false);
      setLinkedCustomerId(transaction.customer_id || '');
      setDepartmentId((transaction as any).department_id ?? null);
      // Initialize date
      setTransactionDate(transaction.transaction_date ? parseLocalDate(transaction.transaction_date) : undefined);
    }
  }, [transaction]);

  const handleSave = () => {
    onSave({
      id: transaction?.id,
      description,
      payee_payor: payeePayor || null,
      reference: reference || null,
      category: category || null,
      memo: memo || null,
      gl_account_id: glAccountId || null,
      transaction_type: transactionType as 'deposit' | 'withdrawal' | 'transfer',
      transaction_date: transactionDate ? format(transactionDate, 'yyyy-MM-dd') : transaction?.transaction_date,
      customer_id: linkedCustomerId || null,
      department_id: departmentId,
    } as any);
    onOpenChange(false);
    toast.success('Transaction updated');
  };

  const handlePostToGL = async () => {
    if (!transaction || !glAccountId || !organization?.id) {
      toast.error('Please select a GL account first');
      return;
    }

    // Persist customer_id before posting
    if (linkedCustomerId !== (transaction.customer_id || '')) {
      onSave({ id: transaction.id, customer_id: linkedCustomerId || null });
    }

    try {
      await postToGL.mutateAsync({
        transactionId: transaction.id,
        bankAccountId: transaction.bank_account_id,
        glAccountId,
        organizationId: organization.id,
        amount: taxCalculation?.subtotal ?? Math.abs(Number(transaction.amount)),
        transactionType: transaction.transaction_type,
        description: transaction.description,
        transactionDate: transaction.transaction_date,
        category: category || undefined,
        payeePayor: payeePayor || undefined,
        reference: reference || undefined,
        taxCode: selectedTaxCode || undefined,
        taxAmount: taxCalculation?.taxAmount,
        taxBreakdown: taxCalculation?.taxBreakdown,
        dimensions: departmentId ? { department_id: departmentId } : undefined,
      });

      // Auto-record donation for NPO deposit transactions with linked customer
      if (isNpoOrg && isDeposit && linkedCustomerId && !linkedDonation) {
        try {
          await createDonation.mutateAsync({
            bankTransactionId: transaction.id,
            donorId: linkedCustomerId,
            amount: Math.abs(Number(transaction.amount)),
            dateReceived: transaction.transaction_date,
            donationType: inferDonationType(transaction.description),
            description: transaction.description,
            fundId: undefined,
            programId: undefined,
            campaignId: undefined,
          });
        } catch {
          // Donation creation failure shouldn't block GL posting success
          toast.error('GL posted, but donation auto-record failed. You can record it manually.');
        }
      }

      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleRecordDonation = async () => {
    if (!transaction || !linkedCustomerId) {
      toast.error('Please link a customer/donor first');
      return;
    }

    // Persist customer_id if not already saved
    if (linkedCustomerId !== (transaction.customer_id || '')) {
      onSave({ id: transaction.id, customer_id: linkedCustomerId || null });
    }

    try {
      await createDonation.mutateAsync({
        bankTransactionId: transaction.id,
        donorId: linkedCustomerId,
        amount: Math.abs(Number(transaction.amount)),
        dateReceived: transaction.transaction_date,
        donationType: inferDonationType(transaction.description),
        description: transaction.description,
      });
    } catch {
      // handled by mutation
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  if (!transaction) return null;

  const isPosted = !!transaction.journal_entry_id;
  const isReconciled = transaction.is_cleared === true;
  const isDeposit = transactionType === 'deposit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReconciled ? 'View Transaction' : 'Edit Transaction'}
            {isReconciled && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                <Lock className="w-3 h-3 mr-1" />
                Reconciled
              </Badge>
            )}
            {isPosted && !isReconciled && (
              <Badge variant="secondary" className="bg-success/10 text-success">
                Posted to GL
              </Badge>
            )}
            {linkedDonation && (
              <Badge variant="secondary" className="bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400">
                <Heart className="w-3 h-3 mr-1" />
                Donation Linked
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {isReconciled 
              ? 'This transaction has been reconciled and is locked. To edit, unreconcile the transaction first.'
              : 'Update transaction details and optionally post to the General Ledger.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4 py-4">
          {/* Reconciled Lock Warning */}
          {isReconciled && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <Lock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <strong>Transaction Locked:</strong> This transaction has been reconciled and cannot be edited. 
                To make changes, first unreconcile the transaction from the Bank Reconciliation screen.
              </AlertDescription>
            </Alert>
          )}

          {/* Posted-to-GL notice */}
          {isPosted && !isReconciled && (
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm">
                This transaction is posted to the GL. Editing amount, date, description, reference, payee, or category will automatically reverse the linked journal entry and re-post it so the Trial Balance and financial statements stay in sync.
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className={`text-sm font-medium font-mono ${
                  transactionType === 'deposit' ? 'text-success' : transactionType === 'transfer' ? 'text-blue-600' : ''
                }`}>
                  {transactionType === 'deposit' ? '+' : transactionType === 'transfer' ? '↔' : '-'}
                  {formatCurrency(Number(transaction.amount))}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <Select value={transactionType} onValueChange={setTransactionType} disabled={isReconciled}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {transactionTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Editable Date Field */}
          <div>
            <Label className="flex items-center gap-2 mb-1.5">
              <CalendarIcon className="w-4 h-4" />
              Transaction Date
            </Label>
            <Popover open={transactionDateOpen} onOpenChange={setTransactionDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !transactionDate && "text-muted-foreground"
                  )}
                  disabled={isReconciled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {transactionDate ? format(transactionDate, 'MMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={transactionDate}
                  onSelect={(date) => {
                    setTransactionDate(date);
                    setTransactionDateOpen(false);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {isPosted && !isReconciled && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                This transaction has already been posted to the General Ledger. 
                You can still update the details, but posting again will create a new journal entry.
              </AlertDescription>
            </Alert>
          )}

          {/* Editable Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
                disabled={isReconciled}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payee_payor" className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Payee/Payor
                </Label>
                <Input
                  id="payee_payor"
                  value={payeePayor}
                  onChange={(e) => setPayeePayor(e.target.value)}
                  placeholder="e.g., ABC Company"
                  className="mt-1.5"
                  disabled={isReconciled}
                />
              </div>
              <div>
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g., INV-001"
                  className="mt-1.5 font-mono"
                  disabled={isReconciled}
                />
              </div>
            </div>

            {/* Customer/Donor Linking */}
            <div>
              <Label className="flex items-center gap-1">
                <User className="w-3 h-3" />
                Link to Customer / Donor
              </Label>
              <div className="mt-1.5">
                <SearchableCustomerSelect
                  value={linkedCustomerId}
                  onValueChange={(id, customer) => {
                    setLinkedCustomerId(id);
                    // Auto-fill payee if empty
                    if (customer && !payeePayor) {
                      setPayeePayor(customer.name);
                    }
                  }}
                  placeholder="Search and link customer/donor..."
                  disabled={isReconciled}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Link this transaction to a customer for donation tracking and CRA receipt issuance
              </p>
            </div>

            {/* NPO Donation Tracking Section */}
            {isNpoOrg && isDeposit && (
              <div className="border rounded-lg p-4 space-y-3 bg-pink-50/50 dark:bg-pink-950/10 border-pink-200 dark:border-pink-800/30">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  <Label className="text-sm font-medium">Donation Tracking (CRA)</Label>
                </div>

                {linkedDonation ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>
                      Linked to <strong>{linkedDonation.donation_number}</strong> — {formatCurrency(linkedDonation.amount)}
                      {linkedDonation.receipt_issued && (
                        <Badge variant="secondary" className="ml-2 text-xs">Receipt Issued</Badge>
                      )}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Record this deposit as a donation to track it for CRA tax receipt issuance.
                      A customer/donor must be linked above.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRecordDonation}
                      disabled={!linkedCustomerId || createDonation.isPending || isReconciled}
                      className="border-pink-300 text-pink-700 hover:bg-pink-100 dark:border-pink-700 dark:text-pink-300 dark:hover:bg-pink-900/30"
                    >
                      <Heart className="w-3.5 h-3.5 mr-1.5" />
                      {createDonation.isPending ? 'Recording...' : 'Record as Donation'}
                    </Button>
                  </>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="category">Category</Label>
              <SearchableCategorySelect
                value={category}
                onValueChange={setCategory}
                disabled={isReconciled}
                categoryGroups={dynamicCategoryGroups}
              />
            </div>

            <div>
              <Label>GL Account for Posting</Label>
              <div className="mt-1.5">
                <SearchableGLAccountSelect
                  value={glAccountId}
                  onValueChange={(id, acc) => {
                    setGlAccountId(id);
                    if (acc) setGlAccountName(acc.name);
                  }}
                  placeholder="Search and select GL account..."
                  disabled={isReconciled}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select the account to post the contra entry to (e.g., Expense or Revenue account)
              </p>
            </div>

            <div>
              <Label>Division / Department</Label>
              <div className="mt-1.5">
                <DivisionSelect
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Unassigned (no division)"
                  disabled={isReconciled}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tag this transaction to a division so the Journal Entry rolls up to divisional financials.
              </p>
            </div>

            {/* Tax Section */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    Sales Tax
                  </Label>
                  <p className="text-xs text-muted-foreground">Apply tax to this transaction</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tax Code</Label>
                  <div className="mt-1.5">
                    <TaxCodeSelect
                      organizationId={organization?.id}
                      value={selectedTaxCode?.id ?? null}
                      onValueChange={setSelectedTaxCode}
                      placeholder="Select tax..."
                      disabled={isReconciled}
                      direction={transactionType === 'deposit' ? 'collected' : 'paid'}
                    />
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="tax-inclusive"
                      checked={taxInclusive}
                      onCheckedChange={setTaxInclusive}
                      disabled={!selectedTaxCode || isReconciled}
                    />
                    <Label htmlFor="tax-inclusive" className="text-sm font-normal">
                      Tax inclusive
                    </Label>
                  </div>
                </div>
              </div>

              {/* Tax Breakdown */}
              {taxCalculation && selectedTaxCode && selectedTaxCode.rate > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(taxCalculation.subtotal)}</span>
                  </div>
                  {taxCalculation.taxBreakdown.map((tb, idx) => (
                    <div key={idx} className="flex justify-between text-primary">
                      <span>{tb.code} ({tb.rate}%)</span>
                      <span className="font-mono">+{formatCurrency(tb.amount)}</span>
                    </div>
                  ))}
                  {taxCalculation.taxBreakdown.some(tb => !tb.glAccountId) && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 border-t pt-2">
                      ⚠️ Tax GL accounts not configured. Tax will not be posted to GL.
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-2">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(taxCalculation.total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="memo">Memo (Optional)</Label>
              <Textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Additional notes..."
                className="mt-1.5 resize-none"
                rows={2}
                disabled={isReconciled}
              />
            </div>
          </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            {isReconciled ? 'Close' : 'Cancel'}
          </Button>
          {!isReconciled && (
            <>
              <Button variant="secondary" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button 
                onClick={handlePostToGL} 
                disabled={!glAccountId || postToGL.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {postToGL.isPending ? 'Posting...' : 'Save & Post to GL'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
