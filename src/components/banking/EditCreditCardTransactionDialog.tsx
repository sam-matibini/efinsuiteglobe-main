import { useState, useEffect, useMemo } from 'react';
import { Save, X, Send, Calendar, DollarSign, FileText, User, Percent, Plus, Building2, Users, Lock, CalendarIcon } from 'lucide-react';
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
import { SearchableGLAccountSelect } from './SearchableGLAccountSelect';
import { TaxCodeSelect, calculateTax } from './TaxCodeSelect';
import { QuickAddVendorCCDialog } from './QuickAddVendorCCDialog';
import { QuickAddCustomerCCDialog } from './QuickAddCustomerCCDialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCardTransaction, ExtendedCreditCardTransaction } from '@/hooks/useCreditCards';
import { usePostCreditCardTransactionToGL } from '@/hooks/useCreditCardGL';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useVendors, Vendor } from '@/hooks/useVendors';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { TaxCode } from '@/hooks/useSalesTax';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditCreditCardTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: ExtendedCreditCardTransaction | CreditCardTransaction | null;
  onSave: (updates: Partial<CreditCardTransaction>) => Promise<void> | void;
}

// Categories for CC transactions are driven by the GL Account selector (SearchableGLAccountSelect)
// which dynamically pulls from the organization's Chart of Accounts

const transactionTypeOptions = [
  { value: 'charge', label: 'Charge', color: 'text-destructive' },
  { value: 'payment', label: 'Payment', color: 'text-success' },
  { value: 'credit', label: 'Credit/Refund', color: 'text-blue-600' },
  { value: 'fee', label: 'Fee', color: 'text-warning' },
  { value: 'interest', label: 'Interest', color: 'text-orange-600' },
];

export function EditCreditCardTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSave,
}: EditCreditCardTransactionDialogProps) {
  const { organization } = useCurrentOrganization();
  const postToGL = usePostCreditCardTransactionToGL();
  const { vendors } = useVendors();
  const { customers } = useCustomers();

  const [description, setDescription] = useState('');
  const [payeePayor, setPayeePayor] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [memo, setMemo] = useState('');
  const [glAccountId, setGlAccountId] = useState('');
  const [glAccountName, setGlAccountName] = useState('');
  const [transactionType, setTransactionType] = useState<string>('');
  const [selectedTaxCode, setSelectedTaxCode] = useState<TaxCode | null>(null);
  const [taxInclusive, setTaxInclusive] = useState(false);
  
  // Date editing states
  const [transactionDate, setTransactionDate] = useState<Date | undefined>(undefined);
  const [postedDate, setPostedDate] = useState<Date | undefined>(undefined);
  const [transactionDateOpen, setTransactionDateOpen] = useState(false);
  const [postedDateOpen, setPostedDateOpen] = useState(false);
  
  // Entity selection states
  const [entityType, setEntityType] = useState<'vendor' | 'customer' | 'none'>('none');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Quick add dialogs
  const [quickAddVendorOpen, setQuickAddVendorOpen] = useState(false);
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  // Calculate tax amounts - preserve sign from transaction amount
  const taxCalculation = useMemo(() => {
    if (!transaction) return null;
    const rawAmount = Number(transaction.amount);
    const isNegative = rawAmount < 0;
    const absAmount = Math.abs(rawAmount);
    const calc = calculateTax(absAmount, selectedTaxCode, taxInclusive, 'withdrawal');
    
    // Preserve sign: negative transactions should show negative subtotal/tax/total
    if (isNegative) {
      return {
        ...calc,
        subtotal: -calc.subtotal,
        taxAmount: -calc.taxAmount,
        total: -calc.total,
        taxBreakdown: calc.taxBreakdown.map(tb => ({
          ...tb,
          amount: -tb.amount,
        })),
      };
    }
    return calc;
  }, [transaction, selectedTaxCode, taxInclusive]);

  // Filter vendors based on search
  const filteredVendors = useMemo(() => {
    if (!vendorSearch) return vendors;
    const search = vendorSearch.toLowerCase();
    return vendors.filter(v => 
      v.name.toLowerCase().includes(search) ||
      v.email?.toLowerCase().includes(search)
    );
  }, [vendors, vendorSearch]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    );
  }, [customers, customerSearch]);

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description || '');
      setPayeePayor(transaction.payee_payor || '');
      setReference(transaction.reference || '');
      setCategory(transaction.category || '');
      setMemo(transaction.memo || '');
      setGlAccountId(transaction.gl_account_id || '');
      setTransactionType(transaction.transaction_type || 'charge');
      setSelectedTaxCode(null);
      setTaxInclusive(false);
      setEntityType('none');
      setSelectedVendorId('');
      setSelectedCustomerId('');
      setDepartmentId((transaction as any).department_id ?? null);
      // Initialize dates
      setTransactionDate(transaction.transaction_date ? parseLocalDate(transaction.transaction_date) : undefined);
      setPostedDate(transaction.posted_date ? parseLocalDate(transaction.posted_date) : undefined);
    }
  }, [transaction]);

  const handleSave = async () => {
    const updates = {
      id: transaction?.id,
      description,
      payee_payor: payeePayor || null,
      reference: reference || null,
      category: category || null,
      memo: memo || null,
      gl_account_id: glAccountId || null,
      transaction_type: transactionType,
      transaction_date: transactionDate ? format(transactionDate, 'yyyy-MM-dd') : transaction?.transaction_date,
      posted_date: postedDate ? format(postedDate, 'yyyy-MM-dd') : null,
      department_id: departmentId,
    } as any;
    
    console.log('Saving transaction updates:', updates);
    
    await onSave(updates);
    onOpenChange(false);
  };

  const handlePostToGL = async () => {
    if (!transaction || !glAccountId || !organization?.id) {
      toast.error('Please select a GL account first');
      return;
    }

    try {
      await postToGL.mutateAsync({
        transactionId: transaction.id,
        creditCardId: transaction.credit_card_id,
        glAccountId, // This is the expense/revenue account
        organizationId: organization.id,
        amount: taxCalculation?.subtotal ?? Math.abs(Number(transaction.amount)),
        transactionType: transactionType as 'charge' | 'payment' | 'credit' | 'fee' | 'interest',
        description: description || transaction.description,
        transactionDate: transactionDate ? format(transactionDate, 'yyyy-MM-dd') : transaction.transaction_date,
        category: category || undefined,
        payeePayor: payeePayor || undefined,
        reference: reference || undefined,
        taxCode: selectedTaxCode || undefined,
        taxAmount: taxCalculation?.taxAmount,
        taxBreakdown: taxCalculation?.taxBreakdown,
        dimensions: departmentId ? { department_id: departmentId } : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleVendorCreated = (vendorId: string, vendorName: string) => {
    setSelectedVendorId(vendorId);
    setPayeePayor(vendorName);
    setEntityType('vendor');
  };

  const handleCustomerCreated = (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setPayeePayor(customerName);
    setEntityType('customer');
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendorId(vendor.id);
    setPayeePayor(vendor.name);
    setVendorPopoverOpen(false);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setPayeePayor(customer.name);
    setCustomerPopoverOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      signDisplay: 'auto',
    }).format(value);
  };

  if (!transaction) return null;

  const isPosted = !!transaction.journal_entry_id;
  const isReconciled = transaction.is_cleared === true;
  const isCharge = transaction.transaction_type === 'charge' || transaction.transaction_type === 'fee' || transaction.transaction_type === 'interest';
  // Check if this is a journal entry source transaction (e.g., payment from bank account)
  const isJournalEntrySource = 'source' in transaction && transaction.source === 'journal_entry';
  // If it's a JE source, treat it as locked since the source of truth is the journal entry
  const isLocked = isReconciled || isJournalEntrySource;
  const selectedVendor = vendors.find(v => v.id === selectedVendorId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isLocked ? 'View Credit Card Transaction' : 'Edit Credit Card Transaction'}
              {isReconciled && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lock className="w-3 h-3 mr-1" />
                  Reconciled
                </Badge>
              )}
              {isJournalEntrySource && !isReconciled && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  <Lock className="w-3 h-3 mr-1" />
                  Bank Payment
                </Badge>
              )}
              {isPosted && !isLocked && (
                <Badge variant="secondary" className="bg-success/10 text-success">
                  Posted to GL
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {isReconciled 
                ? 'This transaction has been reconciled and is locked. To edit, unreconcile the transaction first.'
                : isJournalEntrySource
                ? 'This transaction originates from a bank account payment. To modify it, edit the original bank transaction.'
                : 'Update transaction details, categorize, and optionally post to the General Ledger.'}
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
                    To make changes, first unreconcile the transaction from the Credit Card Reconciliation screen.
                  </AlertDescription>
                </Alert>
              )}

              {/* Journal Entry Source Warning */}
              {isJournalEntrySource && !isReconciled && (
                <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                  <Lock className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    <strong>Bank Payment:</strong> This payment was posted from a bank account transaction. 
                    The source of truth is the original journal entry. During reconciliation, this will be matched with the corresponding payment on your credit card statement.
                  </AlertDescription>
                </Alert>
              )}

              {/* Posted-to-GL re-post notice */}
              {isPosted && !isReconciled && !isJournalEntrySource && (
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
                    <p className={`text-sm font-medium font-mono ${isCharge ? 'text-destructive' : 'text-success'}`}>
                      {isCharge ? '-' : '+'}
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <Select value={transactionType} onValueChange={setTransactionType} disabled={isLocked}>
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

              {/* Editable Date Fields */}
              <div className="grid grid-cols-2 gap-4">
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
                        disabled={isLocked}
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
                <div>
                  <Label className="flex items-center gap-2 mb-1.5">
                    <CalendarIcon className="w-4 h-4" />
                    Posted Date
                  </Label>
                  <Popover open={postedDateOpen} onOpenChange={setPostedDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !postedDate && "text-muted-foreground"
                        )}
                        disabled={isLocked}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {postedDate ? format(postedDate, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={postedDate}
                        onSelect={(date) => {
                          setPostedDate(date);
                          setPostedDateOpen(false);
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {isPosted && !isLocked && (
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
                  <Label htmlFor="cc-description">Description</Label>
                  <Input
                    id="cc-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5"
                    disabled={isLocked}
                  />
                </div>

                {/* Entity Type Selection */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4" />
                    Merchant/Payee
                  </Label>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={entityType === 'vendor' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEntityType('vendor')}
                      className="flex items-center gap-1"
                      disabled={isLocked}
                    >
                      <Building2 className="w-3 h-3" />
                      Vendor
                    </Button>
                    <Button
                      type="button"
                      variant={entityType === 'customer' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEntityType('customer')}
                      className="flex items-center gap-1"
                      disabled={isLocked}
                    >
                      <Users className="w-3 h-3" />
                      Customer
                    </Button>
                    <Button
                      type="button"
                      variant={entityType === 'none' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setEntityType('none');
                        setSelectedVendorId('');
                        setSelectedCustomerId('');
                      }}
                      disabled={isLocked}
                    >
                      Manual Entry
                    </Button>
                  </div>
                  
                  {entityType === 'vendor' && (
                    <div className="flex gap-2">
                      <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={vendorPopoverOpen}
                            className="flex-1 justify-between"
                            disabled={isLocked}
                          >
                            {selectedVendor ? selectedVendor.name : 'Select vendor...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search vendors..." 
                              value={vendorSearch}
                              onValueChange={setVendorSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No vendors found.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-[200px]">
                                  {filteredVendors.map((vendor) => (
                                    <CommandItem
                                      key={vendor.id}
                                      value={vendor.name}
                                      onSelect={() => handleSelectVendor(vendor)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedVendorId === vendor.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{vendor.name}</span>
                                        {vendor.email && (
                                          <span className="text-xs text-muted-foreground">{vendor.email}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuickAddVendorOpen(true)}
                        title="Add new vendor"
                        disabled={isLocked}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {entityType === 'customer' && (
                    <div className="flex gap-2">
                      <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerPopoverOpen}
                            className="flex-1 justify-between"
                            disabled={isLocked}
                          >
                            {selectedCustomer ? selectedCustomer.name : 'Select customer...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search customers..." 
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              <CommandEmpty>No customers found.</CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-[200px]">
                                  {filteredCustomers.map((customer) => (
                                    <CommandItem
                                      key={customer.id}
                                      value={customer.name}
                                      onSelect={() => handleSelectCustomer(customer)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{customer.name}</span>
                                        {customer.email && (
                                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuickAddCustomerOpen(true)}
                        title="Add new customer"
                        disabled={isLocked}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {entityType === 'none' && (
                    <Input
                      value={payeePayor}
                      onChange={(e) => setPayeePayor(e.target.value)}
                      placeholder="e.g., Amazon"
                      disabled={isLocked}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="cc-reference">Reference</Label>
                  <Input
                    id="cc-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g., Order #12345"
                    className="mt-1.5 font-mono"
                    disabled={isLocked}
                  />
                </div>

                <div>
                  <Label>Category (GL Account for Posting)</Label>
                  <div className="mt-1.5">
                    <SearchableGLAccountSelect
                      value={glAccountId}
                      onValueChange={(id, acc) => {
                        setGlAccountId(id);
                        if (acc) {
                          setGlAccountName(acc.name);
                          // Set category to the account name
                          setCategory(acc.name);
                        } else {
                          setGlAccountName('');
                          setCategory('');
                        }
                      }}
                      placeholder="Select category..."
                      disabled={isLocked}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for both categorization and GL posting
                  </p>
                </div>

                <div>
                  <Label>Division / Department</Label>
                  <div className="mt-1.5">
                    <DivisionSelect
                      value={departmentId}
                      onChange={setDepartmentId}
                      placeholder="Unassigned (no division)"
                      disabled={isLocked}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tag this CC transaction to a division so the JE rolls up to divisional financials.
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
                          disabled={isLocked}
                          direction="paid"
                        />
                      </div>
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="cc-tax-inclusive"
                          checked={taxInclusive}
                          onCheckedChange={setTaxInclusive}
                          disabled={!selectedTaxCode || isLocked}
                        />
                        <Label htmlFor="cc-tax-inclusive" className="text-sm font-normal">
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
                          <span className="font-mono">{formatCurrency(tb.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-medium border-t pt-2">
                        <span>Total</span>
                        <span className="font-mono">{formatCurrency(taxCalculation.total)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="cc-memo">Memo (Optional)</Label>
                  <Textarea
                    id="cc-memo"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Additional notes..."
                    className="mt-1.5 resize-none"
                    rows={2}
                    disabled={isLocked}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-2" />
              {isLocked ? 'Close' : 'Cancel'}
            </Button>
            {!isLocked && (
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

      {/* Quick Add Dialogs */}
      <QuickAddVendorCCDialog
        open={quickAddVendorOpen}
        onOpenChange={setQuickAddVendorOpen}
        onVendorCreated={handleVendorCreated}
        initialName={payeePayor}
      />
      <QuickAddCustomerCCDialog
        open={quickAddCustomerOpen}
        onOpenChange={setQuickAddCustomerOpen}
        onCustomerCreated={handleCustomerCreated}
        initialName={payeePayor}
      />
    </>
  );
}
