import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Receipt, Upload, Loader2, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpenseClaims, CreateExpenseClaimInput } from '@/hooks/useExpenseClaims';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { useAnalyzeReceipt, ReceiptData } from '@/hooks/useAnalyzeReceipt';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

interface CreateExpenseClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExpenseLine {
  id: string;
  expense_date: string;
  description: string;
  category: string;
  expense_account_id: string | null;
  amount: number;
  tax_amount: number;
  receipt_urls: string[];
  receipt_filenames: string[];
  is_billable: boolean;
  customer_id: string | null;
}

const expenseCategories = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & Entertainment' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'professional_development', label: 'Professional Development' },
  { value: 'communication', label: 'Phone & Internet' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'other', label: 'Other' },
];

export function CreateExpenseClaimDialog({ open, onOpenChange }: CreateExpenseClaimDialogProps) {
  const { organization } = useCurrentOrganization();
  const { employees, isLoading: employeesLoading } = useEmployees();
  const { createExpenseClaim } = useExpenseClaims();
  const { data: accounts } = useAccounts(organization?.id);
  const { analyzeMany, uploadMany, isAnalyzing } = useAnalyzeReceipt();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [scanningLineId, setScanningLineId] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Record<string, Set<string>>>({});

  const [employeeId, setEmployeeId] = useState<string>('');
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lines, setLines] = useState<ExpenseLine[]>([
    {
      id: crypto.randomUUID(),
      expense_date: new Date().toISOString().split('T')[0],
      description: '',
      category: 'other',
      expense_account_id: null,
      amount: 0,
      tax_amount: 0,
      receipt_urls: [],
      receipt_filenames: [],
      is_billable: false,
      customer_id: null,
    },
  ]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: crypto.randomUUID(),
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'other',
        expense_account_id: null,
        amount: 0,
        tax_amount: 0,
        receipt_urls: [],
        receipt_filenames: [],
        is_billable: false,
        customer_id: null,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  const updateLine = (id: string, field: keyof ExpenseLine, value: unknown) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (line.amount || 0), 0), [lines]);
  const taxTotal = useMemo(() => lines.reduce((sum, line) => sum + (line.tax_amount || 0), 0), [lines]);
  const total = subtotal + taxTotal;

  const resetForm = () => {
    setEmployeeId('');
    setClaimDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setNotes('');
    setLines([
      {
        id: crypto.randomUUID(),
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'other',
        expense_account_id: null,
        amount: 0,
        tax_amount: 0,
        receipt_urls: [],
        receipt_filenames: [],
        is_billable: false,
        customer_id: null,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!employeeId) return;

    const input: CreateExpenseClaimInput = {
      employee_id: employeeId,
      claim_date: claimDate,
      description: description || undefined,
      notes: notes || undefined,
      lines: lines.map((line, index) => ({
        expense_account_id: line.expense_account_id,
        expense_date: line.expense_date,
        description: line.description,
        category: line.category,
        amount: line.amount,
        tax_amount: line.tax_amount || 0,
        receipt_url: line.receipt_urls[0] ?? null,
        receipt_urls: line.receipt_urls,
        is_billable: line.is_billable,
        customer_id: line.customer_id,
        line_order: index,
      })),
    };

    await createExpenseClaim.mutateAsync(input);
    resetForm();
    onOpenChange(false);
  };

  const isValid = employeeId && lines.some((l) => l.description && l.amount > 0);

  // Fuzzy-match an expense account by name/category keywords
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

  const markAiField = (lineId: string, fields: string[]) => {
    setAiFilledFields((prev) => {
      const next = { ...prev };
      next[lineId] = new Set([...(prev[lineId] ?? []), ...fields]);
      return next;
    });
  };

  const handleReceiptUpload = async (lineId: string, files: File[]) => {
    if (!files.length || !organization?.id) return;
    const MAX_FILES = 10;
    const MAX_BYTES = 10 * 1024 * 1024;
    const currentLine = lines.find((l) => l.id === lineId);
    const slotsLeft = MAX_FILES - (currentLine?.receipt_urls.length ?? 0);
    if (slotsLeft <= 0) return;
    const accepted = files.slice(0, slotsLeft).filter((f) => f.size <= MAX_BYTES);
    if (!accepted.length) return;

    setScanningLineId(lineId);
    try {
      const [{ merged: data }, signedUrls] = await Promise.all([
        analyzeMany(accepted),
        uploadMany(accepted, organization.id),
      ]);
      setLines((prev) =>
        prev.map((l) => {
          if (l.id !== lineId) return l;
          const next: ExpenseLine = {
            ...l,
            receipt_urls: [...l.receipt_urls, ...signedUrls],
            receipt_filenames: [...l.receipt_filenames, ...accepted.map((f) => f.name)],
          };
          if (!data) return next;
          const filled: string[] = [];
          if (data.expense_date) { next.expense_date = data.expense_date; filled.push('expense_date'); }
          if (data.description || data.vendor_name) {
            next.description = data.description || (data.vendor_name ? `Receipt — ${data.vendor_name}` : l.description);
            filled.push('description');
          }

          const sub = typeof data.subtotal === 'number' ? data.subtotal : null;
          const tax = typeof data.tax_amount === 'number' ? data.tax_amount : null;
          const tot = typeof data.total === 'number' ? data.total : null;

          let amount: number | null = null;
          if (sub != null && sub > 0) amount = sub;
          else if (tot != null && tot > 0) amount = tot - (tax ?? 0);
          else if (tot != null && tot > 0) amount = tot;

          if (amount != null && amount > 0) {
            next.amount = Number(Math.max(0, amount).toFixed(2));
            filled.push('amount');
          }
          let taxFinal = tax;
          if (taxFinal == null && tot != null && sub != null) taxFinal = Math.max(0, tot - sub);
          if (taxFinal != null && taxFinal >= 0) {
            next.tax_amount = Number(taxFinal.toFixed(2));
            filled.push('tax_amount');
          }

          if (data.category_suggestion) { next.category = data.category_suggestion; filled.push('category'); }
          const acctId = matchAccount(data.vendor_name, data.description, data.category_suggestion);
          if (acctId) { next.expense_account_id = acctId; filled.push('expense_account_id'); }
          markAiField(lineId, filled);
          return next;
        }),
      );
    } finally {
      setScanningLineId(null);
      const input = fileInputs.current[lineId];
      if (input) input.value = '';
    }
  };

  const removeReceiptAt = (lineId: string, idx: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              receipt_urls: l.receipt_urls.filter((_, i) => i !== idx),
              receipt_filenames: l.receipt_filenames.filter((_, i) => i !== idx),
            }
          : l,
      ),
    );
  };

  const aiBadge = (lineId: string, field: string) =>
    aiFilledFields[lineId]?.has(field) ? (
      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px] gap-1">
        <Sparkles className="w-3 h-3" /> AI
      </Badge>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Create Expense Claim
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees found</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimDate">Claim Date *</Label>
                <Input
                  id="claimDate"
                  type="date"
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Q1 Business Travel Expenses"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Separator />

            {/* Expense lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Expense Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-4">
                {lines.map((line, index) => (
                  <div key={line.id} className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Expense Date</Label>
                        <Input
                          type="date"
                          value={line.expense_date}
                          onChange={(e) => updateLine(line.id, 'expense_date', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={line.category}
                          onValueChange={(v) => updateLine(line.id, 'category', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description *</Label>
                      <Input
                        placeholder="Enter expense description"
                        value={line.description}
                        onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Expense Account</Label>
                      <SearchableGLAccountSelect
                        value={line.expense_account_id || ''}
                        onValueChange={(v) => updateLine(line.id, 'expense_account_id', v)}
                        placeholder="Select GL account"
                        filterPostable={true}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Amount *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={line.amount || ''}
                          onChange={(e) => updateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax Amount</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={line.tax_amount || ''}
                          onChange={(e) => updateLine(line.id, 'tax_amount', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Billable</Label>
                        <div className="flex items-center gap-2 h-10">
                          <Switch
                            checked={line.is_billable}
                            onCheckedChange={(v) => updateLine(line.id, 'is_billable', v)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {line.is_billable ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={(el) => { fileInputs.current[line.id] = el; }}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => handleReceiptUpload(line.id, Array.from(e.target.files ?? []))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputs.current[line.id]?.click()}
                          disabled={scanningLineId === line.id || isAnalyzing || line.receipt_urls.length >= 10}
                        >
                          {scanningLineId === line.id ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning…</>
                          ) : line.receipt_urls.length > 0 ? (
                            <><Sparkles className="w-4 h-4 mr-2" /> Add more receipts</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" /> Scan Receipts / Invoices</>
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          PDF, JPG, PNG, WEBP — up to 10 files. AI merges totals & fills date, tax, GL account
                        </span>
                      </div>
                      {line.receipt_urls.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {line.receipt_urls.map((url, idx) => (
                            <Badge key={idx} variant="outline" className="gap-1 pr-1">
                              <Receipt className="w-3 h-3" />
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline max-w-[160px] truncate"
                                title={line.receipt_filenames[idx] ?? `Receipt ${idx + 1}`}
                              >
                                {line.receipt_filenames[idx] ?? `Receipt ${idx + 1}`}
                              </a>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => removeReceiptAt(line.id, idx)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {aiFilledFields[line.id]?.size ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI auto-filled {aiFilledFields[line.id].size} field(s). Please verify before submitting.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatCurrency(taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes or comments..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createExpenseClaim.isPending}
          >
            {createExpenseClaim.isPending ? 'Creating...' : 'Create Expense Claim'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
