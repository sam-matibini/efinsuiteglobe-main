import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Upload, Search, Tag, Sparkles, Loader2, X, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { QuickAddVendorDialog } from '@/components/journal/QuickAddVendorDialog';
import { useExpenses, CreateExpenseInput } from '@/hooks/useExpenses';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useVendors } from '@/hooks/useVendors';
import { useCustomers } from '@/hooks/useCustomers';
import { useTaxCodes } from '@/hooks/useSalesTax';
import { useAccounts } from '@/hooks/useAccounts';
import { useAnalyzeReceipt } from '@/hooks/useAnalyzeReceipt';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { PurchaseDocumentsPanel } from '@/components/purchases/PurchaseDocumentsPanel';
import { InvoiceExtractionReview, type ReviewField } from '@/components/purchases/InvoiceExtractionReview';
import type { InvoiceExtraction } from '@/lib/purchases/invoiceExtraction';
import { useStagedPurchaseAttachments } from '@/hooks/useStagedPurchaseAttachments';

interface ExpenseLineItem {
  id: string;
  expense_account_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code_id: string | null;
  tax_amount: number;
}

interface RecordExpenseTabProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function RecordExpenseTab({ onSuccess, onCancel }: RecordExpenseTabProps) {
  const { organization } = useCurrentOrganization();
  const { createExpense } = useExpenses();
  const { vendors } = useVendors();
  const { customers } = useCustomers();
  const { data: taxCodes } = useTaxCodes(organization?.id);
  const { data: accounts } = useAccounts(organization?.id);
  const { analyzeMany, uploadMany, isAnalyzing } = useAnalyzeReceipt();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);
  const currencySymbol = localization.currency;

  // Quick Add Vendor dialog state
  const [showAddVendorDialog, setShowAddVendorDialog] = useState(false);

  // Form state
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseAccountId, setExpenseAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState(localization.currency);
  const [taxTreatment, setTaxTreatment] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [paidThroughAccountId, setPaidThroughAccountId] = useState<string>('');
  const [taxCodeId, setTaxCodeId] = useState<string>('');
  const [vendorId, setVendorId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const staging = useStagedPurchaseAttachments();
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingSummary, setPendingSummary] = useState('');
  const [isBillable, setIsBillable] = useState(false);
  const [isItemized, setIsItemized] = useState(false);
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [receiptFileNames, setReceiptFileNames] = useState<string[]>([]);
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matchAccount = (vendor?: string | null, desc?: string | null, category?: string | null): string | null => {
    if (!accounts) return null;
    const expenseAccounts = accounts.filter((a) => a.account_type === 'expense');
    const tokens = [vendor, desc, category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3);
    if (!tokens.length) return null;
    let best: { id: string; score: number } | null = null;
    for (const a of expenseAccounts) {
      const hay = `${a.name} ${a.account_group ?? ''} ${a.account_sub_group ?? ''} ${a.description ?? ''}`.toLowerCase();
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { id: a.id, score };
    }
    return best?.id ?? null;
  };

  const matchVendor = (name?: string | null): string | null => {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    const exact = vendors.find((v) => v.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = vendors.find((v) => v.name.toLowerCase().includes(n) || n.includes(v.name.toLowerCase()));
    return partial?.id ?? null;
  };

  const MAX_FILES = 10;
  const MAX_BYTES = 10 * 1024 * 1024;

  const handleReceiptFiles = async (incoming: File[]) => {
    if (!incoming.length || !organization?.id) return;
    const slotsLeft = MAX_FILES - receiptFileNames.length;
    if (slotsLeft <= 0) return;
    const accepted = incoming.slice(0, slotsLeft).filter((f) => f.size <= MAX_BYTES);
    if (!accepted.length) return;

    const filled = new Set<string>(aiFilled);
    const [{ merged }, urls] = await Promise.all([
      analyzeMany(accepted),
      uploadMany(accepted, organization.id),
    ]);
    if (urls.length) {
      setReceiptUrls((prev) => [...prev, ...urls]);
      setReceiptFileNames((prev) => [...prev, ...accepted.map((f) => f.name)]);
    }
    if (!merged) {
      setAiFilled(filled);
      return;
    }
    if (merged.expense_date && /^\d{4}-\d{2}-\d{2}$/.test(merged.expense_date)) {
      setExpenseDate(merged.expense_date);
      filled.add('date');
    }
    const sub = typeof merged.subtotal === 'number' ? merged.subtotal : null;
    const tax = typeof merged.tax_amount === 'number' ? merged.tax_amount : null;
    const tot = typeof merged.total === 'number' ? merged.total : null;
    let amt: number | null = null;
    if (sub != null && sub > 0) amt = sub;
    else if (tot != null && tot > 0 && tax != null) amt = tot - tax;
    else if (tot != null && tot > 0) amt = tot;
    if (amt != null && amt > 0) {
      setAmount(Number(Math.max(0, amt).toFixed(2)));
      setTaxTreatment('exclusive');
      filled.add('amount');
    }
    if (merged.currency && ['CAD', 'USD', 'EUR', 'GBP'].includes(merged.currency.toUpperCase())) {
      setCurrency(merged.currency.toUpperCase());
      filled.add('currency');
    }
    const vId = matchVendor(merged.vendor_name);
    if (vId) { setVendorId(vId); filled.add('vendor'); }
    const acctId = matchAccount(merged.vendor_name, merged.description, merged.category_suggestion);
    if (acctId) { setExpenseAccountId(acctId); filled.add('account'); }
    if (merged.description || merged.vendor_name) {
      const note = merged.description || `Receipt — ${merged.vendor_name}`;
      setNotes((prev) => prev || note);
      filled.add('notes');
    }
    setAiFilled(filled);
  };

  const removeReceiptAt = (idx: number) => {
    setReceiptUrls((prev) => prev.filter((_, i) => i !== idx));
    setReceiptFileNames((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearReceipts = () => {
    setReceiptUrls([]);
    setReceiptFileNames([]);
    setAiFilled(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencySymbol,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calculate tax amount based on tax code
  const selectedTaxCode = taxCodes?.find(tc => tc.id === taxCodeId);
  const taxRate = selectedTaxCode?.rate || 0;
  const calculatedTaxAmount = useMemo(() => {
    if (!taxRate) return 0;
    if (taxTreatment === 'inclusive') {
      return amount - (amount / (1 + taxRate / 100));
    }
    return amount * (taxRate / 100);
  }, [amount, taxRate, taxTreatment]);

  const totalAmount = taxTreatment === 'exclusive' ? amount + calculatedTaxAmount : amount;

  // Itemized expense logic
  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        expense_account_id: null,
        description: '',
        quantity: 1,
        unit_price: 0,
        amount: 0,
        tax_code_id: null,
        tax_amount: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof ExpenseLineItem, value: unknown) => {
    setLineItems(lineItems.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Auto-calculate amount from quantity * unit_price
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = updated.quantity * updated.unit_price;
      }
      return updated;
    }));
  };

  const itemizedTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const resetForm = () => {
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setExpenseAccountId('');
    setAmount(0);
    setCurrency(localization.currency);
    setTaxTreatment('exclusive');
    setPaidThroughAccountId('');
    setTaxCodeId('');
    setVendorId('');
    setCustomerId('');
    setReference('');
    setNotes('');
    setIsBillable(false);
    setIsItemized(false);
    setLineItems([]);
    setReceiptUrls([]);
    setReceiptFileNames([]);
    setAiFilled(new Set());
  };

  const handleSave = async () => {
    const input: CreateExpenseInput = {
      expense_date: expenseDate,
      expense_account_id: expenseAccountId || undefined,
      amount: isItemized ? itemizedTotal : totalAmount,
      currency,
      tax_treatment: taxTreatment,
      paid_through_account_id: paidThroughAccountId || undefined,
      tax_code_id: taxCodeId || undefined,
      tax_amount: calculatedTaxAmount,
      vendor_id: vendorId || undefined,
      customer_id: customerId || undefined,
      reference: reference || undefined,
      notes: notes || undefined,
      is_billable: isBillable,
      receipt_url: receiptUrls[0] || undefined,
      receipt_urls: receiptUrls.length > 0 ? receiptUrls : undefined,
      items: isItemized ? lineItems.map(item => ({
        expense_account_id: item.expense_account_id || undefined,
        description: item.description || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        tax_code_id: item.tax_code_id || undefined,
        tax_amount: item.tax_amount,
        line_order: 0,
      })) : undefined,
    };

    const created: any = await createExpense.mutateAsync(input);
    if (created?.id && organization?.id) {
      await staging.flush('expense', created.id, organization.id);
    }
    resetForm();
    setExtraction(null);
    setPendingSummary('');
    onSuccess();
  };

  // ---- Attachments + AI invoice extraction -------------------------------
  const matchedVendorId = matchVendor(extraction?.vendor_name);
  const matchedVendor = matchedVendorId
    ? vendors.find((v) => v.id === matchedVendorId) ?? null
    : null;

  const reviewFields: ReviewField[] = extraction
    ? [
        {
          key: 'vendor_id',
          label: 'Vendor',
          current: vendors.find((v) => v.id === vendorId)?.name ?? '',
          extracted: matchedVendor?.name ?? '',
        },
        { key: 'expense_date', label: 'Expense date', current: expenseDate, extracted: extraction.document_date ?? '' },
        {
          key: 'amount',
          label: 'Amount',
          current: String(amount || ''),
          extracted: extraction.grand_total != null ? String(extraction.grand_total) : '',
        },
        { key: 'reference', label: 'Reference', current: reference, extracted: extraction.document_number ?? '' },
        {
          key: 'notes',
          label: 'Notes (AI document summary)',
          current: notes,
          extracted: pendingSummary ? 'Append AI summary' : '',
        },
      ]
    : [];

  const applyExtraction = (keys: string[]) => {
    if (!extraction) return;
    const has = (k: string) => keys.includes(k);
    if (has('vendor_id') && matchedVendor) setVendorId(matchedVendor.id);
    if (has('expense_date') && extraction.document_date) setExpenseDate(extraction.document_date);
    if (has('amount') && extraction.grand_total != null) setAmount(extraction.grand_total);
    if (has('reference') && extraction.document_number) setReference(extraction.document_number);
    if (has('notes') && pendingSummary) setNotes((prev) => [prev, pendingSummary].filter(Boolean).join('\n\n'));
  };

  const handleSaveAndNew = async () => {
    await handleSave();
    resetForm();
  };

  const isValid = (isItemized ? itemizedTotal > 0 : amount > 0) && paidThroughAccountId;

  return (
    <div className="flex gap-6">
      {/* Left side - Form */}
      <ScrollArea className="flex-1 max-h-[calc(90vh-200px)] pr-4">
        <div className="space-y-5">
          {/* Date */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-primary font-medium">Date*</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Expense Account */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <Label className="text-primary font-medium pt-2">Expense Account*</Label>
            <div className="space-y-1">
              <SearchableGLAccountSelect
                value={expenseAccountId}
                onValueChange={setExpenseAccountId}
                placeholder="Select an account"
                filterPostable={true}
                className="max-w-md"
              />
              <button
                type="button"
                onClick={() => setIsItemized(!isItemized)}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-3 h-3" />
                {isItemized ? 'Simple Entry' : 'Itemize'}
              </button>
            </div>
          </div>

          {/* Itemized Lines */}
          {isItemized && (
            <div className="pl-[156px] space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <SearchableGLAccountSelect
                        value={item.expense_account_id || ''}
                        onValueChange={(v) => updateLineItem(item.id, 'expense_account_id', v)}
                        placeholder="Expense Account"
                        filterPostable={true}
                      />
                    </div>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity || ''}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      />
                      <Input
                        type="number"
                        placeholder="Rate"
                        value={item.unit_price || ''}
                        onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      />
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ''}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
              <div className="text-right font-medium">
                Total: {formatCurrency(itemizedTotal)}
              </div>
            </div>
          )}

          {/* Amount */}
          {!isItemized && (
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-primary font-medium">Amount*</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                <FormattedNumberInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {/* Tax Treatment */}
          {!isItemized && (
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-muted-foreground">Amount Is</Label>
              <RadioGroup
                value={taxTreatment}
                onValueChange={(v) => setTaxTreatment(v as 'inclusive' | 'exclusive')}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="inclusive" id="inclusive" />
                  <Label htmlFor="inclusive" className="font-normal cursor-pointer">Tax Inclusive</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exclusive" id="exclusive" />
                  <Label htmlFor="exclusive" className="font-normal cursor-pointer">Tax Exclusive</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <Separator />

          {/* Paid Through - Linked to Chart of Accounts */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-primary font-medium">Paid Through*</Label>
            <SearchableGLAccountSelect
              value={paidThroughAccountId}
              onValueChange={setPaidThroughAccountId}
              placeholder="Select cash/bank/credit card account"
              filterPostable={true}
              className="max-w-md"
            />
          </div>

          {/* Tax */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Tax</Label>
            <Select value={taxCodeId} onValueChange={setTaxCodeId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a Tax" />
              </SelectTrigger>
              <SelectContent>
                {taxCodes?.map((tc) => (
                  <SelectItem key={tc.id} value={tc.id}>
                    {tc.name} ({tc.rate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Vendor</Label>
            <div className="flex gap-2 max-w-md">
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon" 
                className="shrink-0"
                onClick={() => setShowAddVendorDialog(true)}
                title="Add New Vendor"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Reference */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Reference#</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder=""
              className="max-w-md"
            />
          </div>

          {/* Notes */}
          <div className="grid grid-cols-[140px_1fr] items-start gap-4">
            <Label className="text-muted-foreground pt-2">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Max. 500 characters"
              maxLength={500}
              rows={3}
              className="max-w-md"
            />
          </div>

          <Separator />

          {/* Customer */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Customer Name</Label>
            <div className="flex gap-2 max-w-md">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select or add a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="shrink-0">
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Billable toggle */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Billable</Label>
            <div className="flex items-center gap-2">
              <Switch checked={isBillable} onCheckedChange={setIsBillable} />
              <span className="text-sm text-muted-foreground">{isBillable ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Invoice / receipt documents */}
          <div className="rounded-lg border p-4">
            <PurchaseDocumentsPanel
              entityType="expense"
              organizationId={organization?.id}
              staging={staging}
              draftContext={{
                vendor: vendors.find((v) => v.id === vendorId)?.name ?? null,
                date: expenseDate || null,
                currency: localization.currency,
                total: isItemized ? itemizedTotal : amount,
              }}
              onExtraction={(ex, summary) => {
                setExtraction(ex);
                setPendingSummary(summary);
                setReviewOpen(true);
              }}
            />
          </div>

          {/* Reporting Tags */}
          <div className="grid grid-cols-[140px_1fr] items-center gap-4">
            <Label className="text-muted-foreground">Reporting Tags</Label>
            <button type="button" className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Tag className="w-4 h-4" />
              Associate Tags
            </button>
          </div>
        </div>
      </ScrollArea>

      {/* Right side - Receipt Upload */}
      <div className="w-64 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleReceiptFiles(Array.from(e.target.files ?? []))}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const fs = Array.from(e.dataTransfer.files ?? []);
            if (fs.length) handleReceiptFiles(fs);
          }}
          className={`border-2 border-dashed rounded-lg p-4 flex flex-col min-h-[300px] transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
          }`}
        >
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center flex-1">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="font-medium text-center mb-1">Analyzing receipts...</p>
              <p className="text-xs text-muted-foreground text-center">AI is extracting details</p>
            </div>
          ) : receiptFileNames.length > 0 ? (
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">
                  {receiptFileNames.length} file{receiptFileNames.length > 1 ? 's' : ''}
                </p>
                {aiFilled.size > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="w-3 h-3" /> {aiFilled.size} auto-filled
                  </Badge>
                )}
              </div>
              <div className="flex-1 space-y-1.5 overflow-auto max-h-[180px] pr-1">
                {receiptFileNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-background border text-xs">
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <a
                      href={receiptUrls[idx]}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 truncate hover:underline"
                      title={name}
                    >
                      {name}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => removeReceiptAt(idx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={receiptFileNames.length >= 10}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add more
                </Button>
                <Button variant="ghost" size="sm" onClick={clearReceipts}>
                  Clear
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Max 10 files · 10MB each
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1">
              <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-medium text-center mb-1">Drag or Drop your Receipts</p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                PDF, JPG, PNG, WEBP — up to 10 files, 10MB each
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Scan Receipts / Invoices
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center px-2">
                AI merges & auto-fills date, amount, vendor & account
              </p>
            </div>
          )}
        </div>
      </div>


      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4 flex gap-3">
        <Button 
          onClick={handleSave}
          disabled={!isValid || createExpense.isPending}
          className="bg-primary"
        >
          Save (Alt+S)
        </Button>
        <Button 
          variant="outline"
          onClick={handleSaveAndNew}
          disabled={!isValid || createExpense.isPending}
        >
          Save and New (Alt+N)
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {extraction && (
        <InvoiceExtractionReview
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          extraction={extraction}
          fields={reviewFields}
          onApply={applyExtraction}
        />
      )}

      {/* Quick Add Vendor Dialog */}
      <QuickAddVendorDialog
        open={showAddVendorDialog}
        onOpenChange={setShowAddVendorDialog}
        onVendorCreated={(vendorId) => setVendorId(vendorId)}
      />
    </div>
  );
}
