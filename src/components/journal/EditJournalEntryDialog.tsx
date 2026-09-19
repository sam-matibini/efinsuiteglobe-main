import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateJournalEntry, JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { useAccounts } from '@/hooks/useAccounts';
import { useTaxCodes } from '@/hooks/useSalesTax';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCurrencies, useExchangeRates } from '@/hooks/useCurrencies';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { QuickAddVendorDialog } from './QuickAddVendorDialog';
import { QuickAddCustomerDialog } from './QuickAddCustomerDialog';
import { SearchableAccountSelect } from './SearchableAccountSelect';
import { SearchableTaxCodeSelect } from './SearchableTaxCodeSelect';
import { JournalAttachmentsSection } from './JournalAttachmentsSection';
import { JournalAIAnalyzer } from './JournalAIAnalyzer';
import { useJournalAttachments } from '@/hooks/useJournalAttachments';

const lineSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  description: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  tax_code_id: z.string().nullable().optional(),
  tax_amount: z.number().min(0).optional(),
});

const entrySchema = z.object({
  entry_date: z.string().min(1, 'Date is required'),
  journal_type: z.string(),
  description: z.string().optional(),
  transaction_currency: z.string().length(3).optional(),
  exchange_rate: z.number().positive().optional(),
  rate_override: z.boolean().optional(),
  lines: z.array(lineSchema).min(2, 'At least 2 lines required'),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface EditJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  entry: JournalEntryWithLines;
}

const typeOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'bank', label: 'Bank' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'depreciation', label: 'Depreciation' },
];

export function EditJournalEntryDialog({
  open,
  onOpenChange,
  organizationId,
  entry,
}: EditJournalEntryDialogProps) {
  const updateEntry = useUpdateJournalEntry();
  const { data: accounts = [] } = useAccounts(organizationId);
  const { data: taxCodes = [] } = useTaxCodes(organizationId);
  const { organization } = useCurrentOrganization();
  const { settings: mcSettings } = useMultiCurrencySettings();
  const { activeCurrencies, baseCurrency } = useCurrencies();
  const { getExchangeRate } = useExchangeRates();
  const { accounts: bankAccounts = [] } = useBankAccounts();

  const baseCcy = mcSettings?.base_currency || baseCurrency?.code || 'CAD';
  const isMultiCcyEnabled = !!mcSettings?.multi_currency_enabled;

  // gl_account_id -> bank account currency (FC bank-account validation)
  const accountCurrencyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ba of bankAccounts) {
      if (ba.gl_account_id && ba.currency) m.set(ba.gl_account_id, ba.currency);
    }
    return m;
  }, [bankAccounts]);

  const [quickAddVendorOpen, setQuickAddVendorOpen] = useState(false);
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const postableAccounts = accounts.filter((a) => !a.is_header && a.is_active);

  // Use all tax codes - filter active if there are any, otherwise show all
  const activeTaxCodes = useMemo(() => {
    if (!taxCodes?.length) return [];
    const active = taxCodes.filter((tc) => tc.is_active);
    return active.length > 0 ? active : taxCodes;
  }, [taxCodes]);

  const isPosted = entry.status === 'posted';
  const isReversed = entry.status === 'reversed';

  // Derive the entry's existing transaction currency / rate from line metadata
  // or by inspecting whether any line's account is an FC bank account.
  const initialFx = useMemo(() => {
    const firstFcLine = (entry.lines as any[]).find((l) => l.currency && l.currency !== baseCcy);
    if (firstFcLine) {
      return {
        currency: firstFcLine.currency as string,
        rate: Number(firstFcLine.exchange_rate) || 1,
      };
    }
    // Fall back: if any line account is a foreign-currency bank account, infer.
    for (const l of entry.lines) {
      const acctCcy = accountCurrencyMap.get(l.account_id);
      if (acctCcy && acctCcy !== baseCcy) {
        return { currency: acctCcy, rate: 1 };
      }
    }
    return { currency: baseCcy, rate: 1 };
  }, [entry.lines, baseCcy, accountCurrencyMap]);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      entry_date: entry.entry_date,
      journal_type: entry.journal_type || 'manual',
      description: entry.description || '',
      transaction_currency: initialFx.currency,
      exchange_rate: initialFx.rate,
      rate_override: false,
      lines: entry.lines.map((line: any) => ({
        account_id: line.account_id,
        description: line.description || '',
        // Show foreign-currency amounts in the editor when the line is FC,
        // otherwise show the raw amount.
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        tax_code_id: line.tax_code_id ?? null,
        tax_amount: 0,
      })),
    },
  });

  // Local override for notes updated inline via AI analyzer
  const [notesOverride, setNotesOverride] = useState<string | null>(null);
  const attachmentsQuery = useJournalAttachments(entry?.id);
  const hasAttachments = (attachmentsQuery.data?.length ?? 0) > 0;
  const effectiveNotes = notesOverride ?? entry?.notes ?? '';

  // Reset form when entry changes
  useEffect(() => {
    if (open && entry) {
      setNotesOverride(null);
      form.reset({
        entry_date: entry.entry_date,
        journal_type: entry.journal_type || 'manual',
        description: entry.description || '',
        transaction_currency: initialFx.currency,
        exchange_rate: initialFx.rate,
        rate_override: false,
        lines: entry.lines.map((line: any) => ({
          account_id: line.account_id,
          description: line.description || '',
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          tax_code_id: line.tax_code_id ?? null,
          tax_amount: 0,
        })),
      });
    }
  }, [open, entry, initialFx]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');
  const txnCcy = form.watch('transaction_currency') || baseCcy;
  const entryDate = form.watch('entry_date');
  const rateOverride = form.watch('rate_override');
  const exchangeRate = form.watch('exchange_rate') || 1;
  const isFc = txnCcy !== baseCcy;
  const [autoFetchedRate, setAutoFetchedRate] = useState<number | null>(null);
  const [missingRate, setMissingRate] = useState(false);

  // Auto-fetch FX rate when currency or date changes (unless overridden)
  useEffect(() => {
    if (!isFc) {
      setAutoFetchedRate(null);
      setMissingRate(false);
      if (exchangeRate !== 1) form.setValue('exchange_rate', 1);
      return;
    }
    const r = getExchangeRate(txnCcy, baseCcy, entryDate);
    if (r && r !== 1) {
      setAutoFetchedRate(r);
      setMissingRate(false);
      if (!rateOverride) form.setValue('exchange_rate', r);
    } else {
      setAutoFetchedRate(null);
      setMissingRate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnCcy, entryDate, baseCcy, isFc, rateOverride]);

  // Per-line currency + rate resolution (cross-currency JE aware).
  const resolveLineFx = (accountId: string): { ccy: string; rate: number; missing: boolean } => {
    const acctCcy = accountCurrencyMap.get(accountId);
    const ccy = acctCcy || txnCcy || baseCcy;
    if (ccy === baseCcy) return { ccy, rate: 1, missing: false };
    if (ccy === txnCcy) return { ccy, rate: exchangeRate, missing: !exchangeRate || exchangeRate <= 0 };
    const r = getExchangeRate(ccy, baseCcy, entryDate);
    return { ccy, rate: r || 1, missing: !r || r === 1 };
  };

  const lineCurrencyInfo = useMemo(() => {
    const perCcy = new Map<string, { rate: number; missing: boolean }>();
    let cross = false;
    for (const line of watchedLines) {
      if (!line?.account_id) continue;
      const info = resolveLineFx(line.account_id);
      if (info.ccy !== baseCcy) cross = true;
      if (!perCcy.has(info.ccy)) perCcy.set(info.ccy, { rate: info.rate, missing: info.missing });
    }
    if (txnCcy && txnCcy !== baseCcy && !perCcy.has(txnCcy)) {
      perCcy.set(txnCcy, { rate: exchangeRate, missing: !exchangeRate || exchangeRate <= 0 });
      cross = true;
    }
    const missing = [...perCcy.entries()].filter(([, v]) => v.missing).map(([c]) => c);
    return { perCcy, isCrossCurrency: cross, missingCurrencies: missing };
  }, [watchedLines, accountCurrencyMap, txnCcy, baseCcy, exchangeRate, entryDate]);

  const isCrossCurrency = lineCurrencyInfo.isCrossCurrency;
  const missingLineRates = lineCurrencyInfo.missingCurrencies;

  // Calculate sub-totals (before tax) — in transaction currency
  const subTotalDebits = watchedLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const subTotalCredits = watchedLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  // Group tax amounts by tax code for summary display
  const taxSummary = watchedLines.reduce((acc, line) => {
    if (line.tax_code_id && line.tax_amount && line.tax_amount > 0) {
      const taxCode = activeTaxCodes.find((tc) => tc.id === line.tax_code_id);
      if (taxCode) {
        const key = taxCode.id;
        if (!acc[key]) {
          acc[key] = {
            code: taxCode.code,
            name: taxCode.name,
            rate: taxCode.rate,
            debit: 0,
            credit: 0,
          };
        }
        if (line.debit > 0) {
          acc[key].debit += line.tax_amount;
        } else if (line.credit > 0) {
          acc[key].credit += line.tax_amount;
        }
      }
    }
    return acc;
  }, {} as Record<string, { code: string; name: string; rate: number; debit: number; credit: number }>);
  
  const taxEntries = Object.values(taxSummary);
  const totalTaxDebits = taxEntries.reduce((sum, t) => sum + t.debit, 0);
  const totalTaxCredits = taxEntries.reduce((sum, t) => sum + t.credit, 0);
  
  // Grand totals (sub-total + tax)
  const totalDebits = subTotalDebits + totalTaxDebits;
  const totalCredits = subTotalCredits + totalTaxCredits;
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // Base-currency totals + oversized FX plug detection (data-entry guard).
  const baseTotals = useMemo(() => {
    let baseDr = 0;
    let baseCr = 0;
    for (const l of watchedLines) {
      if (!l?.account_id) continue;
      const info = resolveLineFx(l.account_id);
      const rate = info.rate || 1;
      baseDr += (l.debit || 0) * rate;
      baseCr += (l.credit || 0) * rate;
    }
    return { baseDr, baseCr, diff: baseDr - baseCr };
  }, [watchedLines, accountCurrencyMap, txnCcy, baseCcy, exchangeRate, entryDate]);
  const largerSide = Math.max(baseTotals.baseDr, baseTotals.baseCr);
  const plugThreshold = Math.max(largerSide * 0.05, 1);
  const oversizedPlug =
    isCrossCurrency &&
    largerSide > 0 &&
    Math.abs(baseTotals.diff) > plugThreshold;

  // Calculate tax when amount or tax code changes
  const calculateTax = (lineIndex: number, amount: number, taxCodeId: string | null) => {
    if (!taxCodeId || taxCodeId === 'exempt') {
      form.setValue(`lines.${lineIndex}.tax_amount`, 0);
      return;
    }
    
    const taxCode = activeTaxCodes.find((tc) => tc.id === taxCodeId);
    if (taxCode && taxCode.rate > 0) {
      const taxAmount = amount * (taxCode.rate / 100);
      form.setValue(`lines.${lineIndex}.tax_amount`, Math.round(taxAmount * 100) / 100);
    } else {
      form.setValue(`lines.${lineIndex}.tax_amount`, 0);
    }
  };


  const onSubmit = async (values: EntryFormValues) => {
    const txn = values.transaction_currency || baseCcy;
    const rate = values.exchange_rate || 1;
    const isFcEntry = txn !== baseCcy;

    if (isFcEntry && (!rate || rate <= 0)) {
      toast.error(`Exchange rate required for ${txn}. Add one in Banking → Exchange Rates.`);
      return;
    }
    if (missingLineRates.length > 0) {
      toast.error(
        `Missing exchange rate for ${missingLineRates.join(', ')}. Add one in Banking → Exchange Rates or enable Override.`,
      );
      return;
    }

    type Built = {
      account_id: string;
      description: string;
      debit: number;
      credit: number;
      line_order: number;
      tax_code_id?: string | null;
      currency?: string | null;
      exchange_rate?: number | null;
      base_currency_debit?: number;
      base_currency_credit?: number;
    };

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const fxAcctId = mcSettings?.realized_fx_account_id || null;
    const journalLines: Built[] = [];
    let lineOrder = 0;

    const pushBuilt = (partial: Omit<Built, 'currency' | 'exchange_rate' | 'base_currency_debit' | 'base_currency_credit'>) => {
      // Realized FX Gain/Loss is always base-currency — do not translate.
      const isFxAcct = fxAcctId && partial.account_id === fxAcctId;
      const fx = isFxAcct
        ? { ccy: baseCcy, rate: 1, missing: false }
        : resolveLineFx(partial.account_id);
      if (!isFcEntry && fx.ccy === baseCcy) {
        journalLines.push({ ...partial });
        return;
      }
      journalLines.push({
        ...partial,
        currency: fx.ccy,
        exchange_rate: fx.rate,
        base_currency_debit: round2(partial.debit * fx.rate),
        base_currency_credit: round2(partial.credit * fx.rate),
      });
    };

    const taxGlIds = new Set(
      activeTaxCodes.flatMap((tc) => [tc.gl_collected_account_id, tc.gl_paid_account_id]).filter(Boolean) as string[],
    );

    // Add user-entered lines, skipping any existing Realized FX Gain/Loss plug
    // lines — they will be re-generated by the FX plug block below so we don't
    // end up with duplicate FX rows on re-save.
    values.lines.forEach((line) => {
      if (fxAcctId && line.account_id === fxAcctId) return;
      pushBuilt({
        account_id: line.account_id,
        description: line.description || '',
        debit: line.debit,
        credit: line.credit,
        line_order: lineOrder++,
        tax_code_id: line.tax_code_id || null,
      });
    });

    // Aggregated tax lines from tax_code_id selections
    const currentTaxSummary = values.lines.reduce((acc, line) => {
      if (taxGlIds.has(line.account_id)) return acc;
      if (line.tax_code_id && line.tax_amount && line.tax_amount > 0) {
        const taxCode = activeTaxCodes.find((tc) => tc.id === line.tax_code_id);
        if (taxCode) {
          const key = taxCode.id;
          if (!acc[key]) {
            acc[key] = { taxCode, debit: 0, credit: 0 };
          }
          if (line.debit > 0) acc[key].debit += line.tax_amount;
          else if (line.credit > 0) acc[key].credit += line.tax_amount;
        }
      }
      return acc;
    }, {} as Record<string, { taxCode: typeof activeTaxCodes[0]; debit: number; credit: number }>);

    Object.values(currentTaxSummary).forEach((taxEntry) => {
      const { taxCode, debit, credit } = taxEntry;
      let taxAccountId: string | null = null;
      if (debit > 0) taxAccountId = taxCode.gl_paid_account_id || taxCode.gl_collected_account_id || null;
      else if (credit > 0) taxAccountId = taxCode.gl_collected_account_id || taxCode.gl_paid_account_id || null;

      if (taxAccountId && (debit > 0 || credit > 0) && !journalLines.some((l) => l.account_id === taxAccountId && l.tax_code_id === taxCode.id)) {
        pushBuilt({
          account_id: taxAccountId,
          description: `${taxCode.code} - Auto-calculated tax`,
          debit: round2(debit),
          credit: round2(credit),
          line_order: lineOrder++,
          tax_code_id: taxCode.id,
        });
      }
    });

    // Base-currency balance check + Realized FX Gain/Loss plug for any
    // FC or cross-currency entry.
    if (isFcEntry || isCrossCurrency) {
      const baseDr = journalLines.reduce((s, l) => s + (l.base_currency_debit ?? l.debit), 0);
      const baseCr = journalLines.reduce((s, l) => s + (l.base_currency_credit ?? l.credit), 0);
      const driftCents = Math.round((baseDr - baseCr) * 100);
      if (driftCents !== 0) {
        const fxAcct = mcSettings?.realized_fx_account_id;
        if (!fxAcct) {
          toast.error('Realized FX gain/loss account not configured. Set it in Settings → Multi-Currency.');
          return;
        }
        const plug = Math.abs(driftCents) / 100;
        journalLines.push({
          account_id: fxAcct,
          description: 'Realized FX gain/loss',
          debit: driftCents < 0 ? plug : 0,
          credit: driftCents > 0 ? plug : 0,
          line_order: lineOrder++,
          currency: baseCcy,
          exchange_rate: 1,
          base_currency_debit: driftCents < 0 ? plug : 0,
          base_currency_credit: driftCents > 0 ? plug : 0,
        });
      }
    }

    // Audit note appended to existing notes (use AI-updated notes if present)
    let notes = effectiveNotes || '';
    if (isFcEntry) {
      const src = autoFetchedRate === rate ? 'auto' : (rateOverride ? 'manual_override' : 'manual');
      const auditLine = `FX edit ${new Date().toISOString().slice(0, 10)}: 1 ${txn} = ${rate} ${baseCcy} (source: ${src})`;
      notes = notes ? `${notes}\n${auditLine}` : auditLine;
    }

    await updateEntry.mutateAsync({
      id: entry.id,
      organizationId,
      entry: {
        reference: entry.reference,
        entry_date: values.entry_date,
        description: values.description,
        notes,
        journal_type: values.journal_type as any,
        lines: journalLines,
      },
    });

    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: txnCcy || localization.currency,
    }).format(value);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[1400px] h-[90vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b bg-background shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">Edit Journal Entry</DialogTitle>
              <span className="text-sm text-muted-foreground font-mono">{entry.reference}</span>
            </div>
          </DialogHeader>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Warning for Posted Entries */}
            {isReversed && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Reversed Entry — Read Only</AlertTitle>
                <AlertDescription>
                  This entry has been reversed and is immutable. View only.
                </AlertDescription>
              </Alert>
            )}
            {isPosted && (
              <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-950 mb-6">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">Warning: Editing Posted Entry</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-300">
                  This entry has already been posted to the General Ledger. Editing will affect financial reports and audit trail. Consider using{' '}
                  <span className="font-semibold text-amber-700 dark:text-amber-200">Reverse</span> instead to maintain accounting integrity.
                </AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form id="edit-journal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Entry Date and Source - Two columns on larger screens */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="entry_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-10" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="journal_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {typeOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description on the right side for larger screens */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description..."
                            {...field}
                            className="h-10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isMultiCcyEnabled && (
                  <div className="grid grid-cols-3 gap-4 items-end p-3 rounded-md border bg-muted/30">
                    <FormField
                      control={form.control}
                      name="transaction_currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transaction Currency</FormLabel>
                          <Select
                            value={field.value || baseCcy}
                            onValueChange={(v) => {
                              field.onChange(v);
                              form.setValue('rate_override', false);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(activeCurrencies.length > 0
                                ? activeCurrencies
                                : ([{ code: baseCcy, name: baseCcy, symbol: '' }] as any)
                              ).map((c: any) => (
                                <SelectItem key={c.code} value={c.code}>
                                  {c.code} — {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="exchange_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Exchange Rate {isFc ? `(1 ${txnCcy} = ? ${baseCcy})` : '(base)'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.0000000001"
                              disabled={!isFc || (!rateOverride && !!autoFetchedRate)}
                              value={field.value ?? 1}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <div className="flex items-center gap-2 mt-1">
                            {isFc && autoFetchedRate && !rateOverride && (
                              <Badge variant="secondary" className="text-xs">
                                Auto: {autoFetchedRate}
                              </Badge>
                            )}
                            {isFc && rateOverride && (
                              <Badge variant="destructive" className="text-xs">
                                Manual override
                              </Badge>
                            )}
                            {isFc && missingRate && !rateOverride && (
                              <Badge variant="destructive" className="text-xs">
                                No rate on file — enter manually
                              </Badge>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rate_override"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2 pb-2">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              disabled={!isFc}
                              onCheckedChange={(c) => field.onChange(!!c)}
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Override rate</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {isCrossCurrency && (
                  <div className="text-sm rounded-md border bg-muted/30 p-3 space-y-1">
                    <div className="font-medium">Cross-currency entry — FX auto-lookup</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      {[...lineCurrencyInfo.perCcy.entries()].map(([ccy, info]) => (
                        <Badge
                          key={ccy}
                          variant={info.missing ? 'destructive' : 'secondary'}
                          className="text-xs font-mono"
                        >
                          1 {ccy} = {info.missing ? '—' : info.rate} {baseCcy}
                          {info.missing ? ' (no rate)' : ''}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Any base-currency drift is auto-posted to the Realized FX Gain/Loss account.
                    </div>
                  </div>
                )}


                {/* Journal Lines - Full Width Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base font-semibold">Journal Lines</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        append({
                          account_id: '',
                          description: '',
                          debit: 0,
                          credit: 0,
                          tax_code_id: null,
                          tax_amount: 0,
                        })
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Line
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden bg-muted/20">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[900px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium min-w-[280px]">Account</th>
                            <th className="text-left p-3 font-medium min-w-[180px]">Description</th>
                            <th className="text-left p-3 font-medium w-32">Tax Code</th>
                            <th className="text-right p-3 font-medium w-32">Debit</th>
                            <th className="text-right p-3 font-medium w-32">Credit</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((field, index) => {
                            const line = watchedLines[index];
                            return (
                              <tr key={field.id} className="border-t bg-background">
                                <td className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.account_id`}
                                    render={({ field }) => (
                                      <SearchableAccountSelect
                                        accounts={postableAccounts}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Select account"
                                      />
                                    )}
                                  />
                                </td>
                                <td className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.description`}
                                    render={({ field }) => (
                                      <Input
                                        className="h-9 bg-muted/30"
                                        placeholder="Description"
                                        {...field}
                                        value={field.value || ''}
                                      />
                                    )}
                                  />
                                </td>
                                <td className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.tax_code_id`}
                                    render={({ field }) => (
                                      <SearchableTaxCodeSelect
                                        taxCodes={activeTaxCodes}
                                        value={field.value || null}
                                        onValueChange={(value) => {
                                          field.onChange(value);
                                          const amount = Math.max(line?.debit || 0, line?.credit || 0);
                                          calculateTax(index, amount, value);
                                        }}
                                        placeholder="Select Tax"
                                      />
                                    )}
                                  />
                                </td>
                                <td className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.debit`}
                                    render={({ field }) => (
                                      <FormattedNumberInput
                                        className="h-9 bg-muted/30"
                                        value={field.value || 0}
                                        onChange={(value) => {
                                          field.onChange(value);
                                          if (value > 0) {
                                            form.setValue(`lines.${index}.credit`, 0);
                                          }
                                          if (line?.tax_code_id) {
                                            calculateTax(index, value, line.tax_code_id);
                                          }
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    )}
                                  />
                                  {(() => {
                                    if (!line?.account_id) return null;
                                    const info = resolveLineFx(line.account_id);
                                    if (info.ccy === baseCcy) return null;
                                    const v = (line.debit || 0) * (info.rate || 0);
                                    if (!v) return null;
                                    return (
                                      <div className="text-[10px] text-muted-foreground text-right mt-0.5 font-mono">
                                        ≈ {baseCcy} {v.toFixed(2)}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-2">
                                  <FormField
                                    control={form.control}
                                    name={`lines.${index}.credit`}
                                    render={({ field }) => (
                                      <FormattedNumberInput
                                        className="h-9 bg-muted/30"
                                        value={field.value || 0}
                                        onChange={(value) => {
                                          field.onChange(value);
                                          if (value > 0) {
                                            form.setValue(`lines.${index}.debit`, 0);
                                          }
                                          if (line?.tax_code_id) {
                                            calculateTax(index, value, line.tax_code_id);
                                          }
                                        }}
                                        onBlur={field.onBlur}
                                      />
                                    )}
                                  />
                                  {(() => {
                                    if (!line?.account_id) return null;
                                    const info = resolveLineFx(line.account_id);
                                    if (info.ccy === baseCcy) return null;
                                    const v = (line.credit || 0) * (info.rate || 0);
                                    if (!v) return null;
                                    return (
                                      <div className="text-[10px] text-muted-foreground text-right mt-0.5 font-mono">
                                        ≈ {baseCcy} {v.toFixed(2)}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => remove(index)}
                                    disabled={fields.length <= 2}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t-2 bg-muted/30 font-semibold">
                          {/* Sub Total Row */}
                          <tr className="border-b">
                            <td className="p-3" colSpan={3}>Sub Total</td>
                            <td className="p-3 text-right font-mono text-emerald-600">
                              {formatCurrency(subTotalDebits)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-600">
                              {formatCurrency(subTotalCredits)}
                            </td>
                            <td></td>
                          </tr>
                          {/* Tax Summary Rows */}
                          {taxEntries.map((tax) => (
                            <tr key={tax.code} className="border-b text-sm text-muted-foreground font-normal">
                              <td className="p-3 pl-4" colSpan={3}>
                                {tax.code} [{tax.rate}%]
                              </td>
                              <td className="p-3 text-right font-mono">
                                {tax.debit > 0 ? formatCurrency(tax.debit) : '-'}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {tax.credit > 0 ? formatCurrency(tax.credit) : '-'}
                              </td>
                              <td></td>
                            </tr>
                          ))}
                          {/* Grand Total Row */}
                          <tr>
                            <td className="p-3" colSpan={3}>Total</td>
                            <td className="p-3 text-right font-mono text-emerald-600">
                              {formatCurrency(totalDebits)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-600">
                              {formatCurrency(totalCredits)}
                            </td>
                            <td></td>
                          </tr>
                          {isFc && (
                            <tr className="text-xs text-muted-foreground">
                              <td className="p-3" colSpan={3}>
                                Equivalent in {baseCcy} @ {exchangeRate}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: baseCcy }).format(totalDebits * exchangeRate)}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {new Intl.NumberFormat(locale, { style: 'currency', currency: baseCcy }).format(totalCredits * exchangeRate)}
                              </td>
                              <td></td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {!isCrossCurrency && !isBalanced && totalDebits + totalCredits > 0 && (
                    <p className="text-sm text-destructive">
                      Entry is out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    </p>
                  )}

                  {isCrossCurrency && (baseTotals.baseDr > 0 || baseTotals.baseCr > 0) && (
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 pt-1">
                      <span>
                        Base ({baseCcy}): Dr {baseTotals.baseDr.toFixed(2)} / Cr {baseTotals.baseCr.toFixed(2)}
                      </span>
                      <span>
                        FX plug: {baseCcy} {Math.abs(baseTotals.diff).toFixed(2)}{' '}
                        {baseTotals.diff > 0
                          ? '(credit Realized FX Gain)'
                          : baseTotals.diff < 0
                          ? '(debit Realized FX Loss)'
                          : ''}
                      </span>
                    </div>
                  )}

                  {oversizedPlug && (
                    <div className="text-sm rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">
                      <div className="font-medium">Large FX adjustment detected</div>
                      <div className="text-xs mt-1">
                        This entry needs an FX plug of {baseCcy} {Math.abs(baseTotals.diff).toFixed(2)} (
                        {((Math.abs(baseTotals.diff) / largerSide) * 100).toFixed(1)}% of the larger side).
                        Verify each line's foreign-currency amount — a common mistake is entering the
                        base-currency equivalent into a foreign-currency account.
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-3">
                    <JournalAttachmentsSection
                      journalEntryId={entry?.id}
                      organizationId={organizationId}
                      readOnly={isReversed}
                    />
                    <JournalAIAnalyzer
                      journalEntryId={entry?.id}
                      currentNotes={effectiveNotes}
                      hasAttachments={hasAttachments}
                      readOnly={isReversed}
                      onNotesUpdated={(n) => setNotesOverride(n)}
                    />
                    {effectiveNotes && (
                      <div className="rounded-md border bg-muted/30 p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
                        <pre className="whitespace-pre-wrap text-xs font-sans">{effectiveNotes}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>


          {/* Fixed Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {isCrossCurrency ? (
                  missingLineRates.length > 0 ? (
                    <span className="text-destructive">✗ Missing rate: {missingLineRates.join(', ')}</span>
                  ) : (
                    <span className="text-emerald-600">✓ Cross-currency — balanced in {baseCcy} via FX plug</span>
                  )
                ) : isBalanced ? (
                  <span className="text-emerald-600">✓ Entry is balanced</span>
                ) : (
                  <span className="text-destructive">
                    ✗ Out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="edit-journal-form"
                  disabled={
                    updateEntry.isPending ||
                    isReversed ||
                    missingLineRates.length > 0 ||
                    (!isCrossCurrency && !isBalanced)
                  }
                >
                  {updateEntry.isPending ? 'Updating...' : 'Update Entry'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAddVendorDialog
        open={quickAddVendorOpen}
        onOpenChange={setQuickAddVendorOpen}
        onVendorCreated={() => {}}
      />

      <QuickAddCustomerDialog
        open={quickAddCustomerOpen}
        onOpenChange={setQuickAddCustomerOpen}
        onCustomerCreated={() => {}}
      />
    </>
  );
}
