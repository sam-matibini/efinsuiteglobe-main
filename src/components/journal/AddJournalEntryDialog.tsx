import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Textarea } from '@/components/ui/textarea';
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
import { Badge } from '@/components/ui/badge';
import { useCreateJournalEntry, useNextJournalReference, usePostJournalEntry } from '@/hooks/useJournalEntries';
import { useAccounts } from '@/hooks/useAccounts';
import { useAuth } from '@/hooks/useAuth';
import { useVendors } from '@/hooks/useVendors';
import { useCustomers } from '@/hooks/useCustomers';
import { useTaxCodes, type TaxCode } from '@/hooks/useSalesTax';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCurrencies, useExchangeRates } from '@/hooks/useCurrencies';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateSplitTaxes, PROVINCE_TAX_CONFIG } from '@/lib/splitTaxCalculator';
import { EntityLookupPopover } from './EntityLookupPopover';
import { QuickAddVendorDialog } from './QuickAddVendorDialog';
import { QuickAddCustomerDialog } from './QuickAddCustomerDialog';
import { QuickAddAccountDialog } from './QuickAddAccountDialog';
import { SearchableAccountSelect } from './SearchableAccountSelect';
import { SearchableTaxCodeSelect } from './SearchableTaxCodeSelect';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';

const lineSchema = z.object({
  account_id: z.string().min(1, 'Account is required'),
  description: z.string().optional(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  vendor_id: z.string().nullable().optional(),
  vendor_name: z.string().nullable().optional(),
  customer_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  tax_code_id: z.string().nullable().optional(),
  tax_amount: z.number().min(0).optional(),
});

const journalTypeOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'bank', label: 'Bank' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'depreciation', label: 'Depreciation' },
] as const;

const entrySchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
  entry_date: z.string().min(1, 'Date is required'),
  journal_type: z.enum(['manual', 'sales', 'purchase', 'payroll', 'bank', 'adjustment', 'depreciation']),
  description: z.string().optional(),
  department_id: z.string().nullable().optional(),
  notes: z.string().optional(),
  transaction_currency: z.string().length(3).optional(),
  exchange_rate: z.number().positive().optional(),
  rate_override: z.boolean().optional(),
  lines: z.array(lineSchema).min(2, 'At least 2 lines required'),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface AddJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function AddJournalEntryDialog({
  open,
  onOpenChange,
  organizationId,
}: AddJournalEntryDialogProps) {
  const { user } = useAuth();
  const createEntry = useCreateJournalEntry();
  const postEntry = usePostJournalEntry();
  const [submitMode, setSubmitMode] = useState<'post' | 'draft'>('post');
  const { data: accounts = [] } = useAccounts(organizationId);
  const { vendors = [] } = useVendors();
  const { customers = [] } = useCustomers();
  const { data: taxCodes = [], isLoading: taxCodesLoading } = useTaxCodes(organizationId);
  const { data: nextReference } = useNextJournalReference(organizationId);
  const { settings: mcSettings } = useMultiCurrencySettings();
  const { activeCurrencies, baseCurrency } = useCurrencies();
  const { getExchangeRate } = useExchangeRates();
  const { accounts: bankAccounts = [] } = useBankAccounts();

  const baseCcy = mcSettings?.base_currency || baseCurrency?.code || 'CAD';
  const isMultiCcyEnabled = !!mcSettings?.multi_currency_enabled;
  // Map gl_account_id -> bank account currency (for FC bank account validation)
  const accountCurrencyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ba of bankAccounts) {
      if (ba.gl_account_id && ba.currency) m.set(ba.gl_account_id, ba.currency);
    }
    return m;
  }, [bankAccounts]);

  const [quickAddVendorOpen, setQuickAddVendorOpen] = useState(false);
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickAddAccountOpen, setQuickAddAccountOpen] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  // Filter to postable accounts only
  const postableAccounts = accounts.filter((a) => !a.is_header && a.is_active);
  // Use all tax codes - filter active if there are any, otherwise show all
  const activeTaxCodes = taxCodes?.length > 0 
    ? (taxCodes.filter((tc) => tc.is_active).length > 0 
        ? taxCodes.filter((tc) => tc.is_active) 
        : taxCodes)
    : [];

  // Build synthetic "combined" tax options for GST_PST provinces (BC/SK/MB/QC).
  // Selecting one of these splits into two separate tax GL postings on submit.
  const combinedTaxOptions: TaxCode[] = useMemo(() => {
    const provinces: Array<{ code: 'BC' | 'SK' | 'MB' | 'QC'; label: string }> = [
      { code: 'BC', label: 'BC – GST 5% + PST 7%' },
      { code: 'SK', label: 'SK – GST 5% + PST 6%' },
      { code: 'MB', label: 'MB – GST 5% + PST 7%' },
      { code: 'QC', label: 'QC – GST 5% + QST 9.975%' },
    ];
    return provinces.map(({ code, label }) => {
      const cfg = PROVINCE_TAX_CONFIG[code];
      const rate = Math.round((cfg.gstRate + cfg.pstRate) * 1000) / 1000;
      return {
        id: `combined:${code}`,
        organization_id: organizationId,
        code: `${code} GST+${code === 'QC' ? 'QST' : 'PST'}`,
        name: label,
        rate,
        jurisdiction: code,
        tax_type: 'combined',
        is_recoverable: true,
        is_compound: false,
        is_active: true,
        gl_collected_account_id: null,
        gl_paid_account_id: null,
        created_at: '',
        updated_at: '',
      } as TaxCode;
    });
  }, [organizationId]);

  const selectableTaxCodes: TaxCode[] = useMemo(
    () => [...combinedTaxOptions, ...activeTaxCodes],
    [combinedTaxOptions, activeTaxCodes]
  );

  // Helper: split a combined synthetic id into province + components
  const getCombinedSplit = (taxCodeId: string | null | undefined, amount: number) => {
    if (!taxCodeId || !taxCodeId.startsWith('combined:')) return null;
    const province = taxCodeId.split(':')[1];
    if (!PROVINCE_TAX_CONFIG[province]) return null;
    const calc = calculateSplitTaxes(amount, province, false);
    return { province, taxes: calc.taxes, total: calc.totalTax };
  };

  // Helper to determine entity type based on account
  const getEntityTypeForAccount = (accountId: string): 'customer' | 'vendor' | 'both' | 'none' => {
    const account = postableAccounts.find(a => a.id === accountId);
    if (!account) return 'none';
    
    const code = account.code.toLowerCase();
    const name = account.name.toLowerCase();
    const type = account.account_type;
    
    // AR accounts - show Customer
    if (code.startsWith('110') || code.startsWith('1100') || 
        name.includes('receivable') || name.includes('accounts receivable')) {
      return 'customer';
    }
    
    // AP accounts - show Vendor
    if (code.startsWith('200') || code.startsWith('2000') || 
        name.includes('payable') || name.includes('accounts payable')) {
      return 'vendor';
    }
    
    // Income accounts - typically customer-related
    if (type === 'income') {
      return 'customer';
    }
    
    // Expense accounts - typically vendor-related
    if (type === 'expense') {
      return 'vendor';
    }
    
    // For other accounts (assets, liabilities, equity) - show both
    return 'both';
  };

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      reference: '',
      entry_date: new Date().toISOString().split('T')[0],
      journal_type: 'manual',
      description: '',
      notes: '',
      transaction_currency: baseCcy,
      exchange_rate: 1,
      rate_override: false,
      lines: [
        { account_id: '', description: '', debit: 0, credit: 0, vendor_id: null, customer_id: null, tax_code_id: null, tax_amount: 0 },
        { account_id: '', description: '', debit: 0, credit: 0, vendor_id: null, customer_id: null, tax_code_id: null, tax_amount: 0 },
      ],
    },
  });

  // Pre-populate reference when dialog opens and next reference is available
  useEffect(() => {
    if (open && nextReference) {
      // Always set the latest reference when dialog opens
      form.setValue('reference', nextReference);
    }
  }, [open, nextReference]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        reference: '',
        entry_date: new Date().toISOString().split('T')[0],
        journal_type: 'manual',
        description: '',
        notes: '',
        transaction_currency: baseCcy,
        exchange_rate: 1,
        rate_override: false,
        lines: [
          { account_id: '', description: '', debit: 0, credit: 0, vendor_id: null, customer_id: null, tax_code_id: null, tax_amount: 0 },
          { account_id: '', description: '', debit: 0, credit: 0, vendor_id: null, customer_id: null, tax_code_id: null, tax_amount: 0 },
        ],
      });
    }
  }, [open]);

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

  // Auto-fetch FX rate when currency or date changes (unless user has overridden)
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
  }, [txnCcy, entryDate, baseCcy, isFc, rateOverride]);

  // Per-line currency + rate resolution (cross-currency JE aware).
  // Each line takes its currency from the bank/credit-card account it posts to;
  // GL accounts without an attached currency fall back to the entry's
  // transaction currency. Rates are auto-looked up from `exchange_rates`.
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
    // Also include the entry-level transaction currency if FC (for header rate UX)
    if (txnCcy && txnCcy !== baseCcy && !perCcy.has(txnCcy)) {
      perCcy.set(txnCcy, { rate: exchangeRate, missing: !exchangeRate || exchangeRate <= 0 });
      cross = true;
    }
    const missing = [...perCcy.entries()].filter(([, v]) => v.missing).map(([c]) => c);
    return { perCcy, isCrossCurrency: cross, missingCurrencies: missing };
  }, [watchedLines, accountCurrencyMap, txnCcy, baseCcy, exchangeRate, entryDate]);

  const isCrossCurrency = lineCurrencyInfo.isCrossCurrency;
  const missingLineRates = lineCurrencyInfo.missingCurrencies;


  
  // Calculate sub-totals (before tax)
  const subTotalDebits = watchedLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const subTotalCredits = watchedLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  // Group tax amounts by tax code for summary display.
  // For combined synthetic codes, break out into GST + PST/QST rows.
  const taxSummary = watchedLines.reduce((acc, line) => {
    if (!line.tax_code_id || !line.tax_amount || line.tax_amount <= 0) return acc;

    const base = Math.max(line.debit || 0, line.credit || 0);
    const split = getCombinedSplit(line.tax_code_id, base);

    if (split) {
      // Two rows: GST + PST/QST
      for (const comp of split.taxes) {
        const key = `${line.tax_code_id}:${comp.type}`;
        if (!acc[key]) {
          acc[key] = { code: comp.code, name: comp.code, rate: comp.rate, debit: 0, credit: 0 };
        }
        if ((line.debit || 0) > 0) acc[key].debit += comp.amount;
        else if ((line.credit || 0) > 0) acc[key].credit += comp.amount;
      }
      return acc;
    }

    const taxCode = selectableTaxCodes.find((tc) => tc.id === line.tax_code_id);
    if (taxCode) {
      const key = taxCode.id;
      if (!acc[key]) {
        acc[key] = { code: taxCode.code, name: taxCode.name, rate: taxCode.rate, debit: 0, credit: 0 };
      }
      if ((line.debit || 0) > 0) acc[key].debit += line.tax_amount;
      else if ((line.credit || 0) > 0) acc[key].credit += line.tax_amount;
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

  // Base-currency totals (for cross-currency entries). Each line's debit/credit
  // is converted at its resolved FX rate so we can detect data-entry mistakes
  // that "balance" in raw nominal but blow up the FX plug.
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

  // Suspiciously large FX plug: warn if |diff| exceeds 5% of larger side
  // (and at least 1.00 in base units). Mirrors the JE-0051 mistake where the
  // user typed the wrong-currency amount on a foreign-currency bank line.
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
    
    const taxCode = selectableTaxCodes.find((tc) => tc.id === taxCodeId);
    if (taxCode && taxCode.rate > 0) {
      const taxAmount = amount * (taxCode.rate / 100);
      form.setValue(`lines.${lineIndex}.tax_amount`, Math.round(taxAmount * 100) / 100);
    } else {
      form.setValue(`lines.${lineIndex}.tax_amount`, 0);
    }
  };


  const resolveTaxAccountId = (
    taxCode: { code: string; gl_collected_account_id: string | null; gl_paid_account_id: string | null },
    baseLine: { debit: number; credit: number }
  ) => {
    const isDebit = (baseLine.debit || 0) > 0;

    const explicitAccountId = isDebit ? taxCode.gl_paid_account_id : taxCode.gl_collected_account_id;
    if (explicitAccountId) return explicitAccountId;

    // Fallback: try to find an existing tax account in the chart (common in generated COA)
    const candidates = accounts.filter((a) => !a.is_header && a.is_active);
    const code = (taxCode.code || '').toLowerCase();

    const matchesTax = (name: string) => {
      const n = name.toLowerCase();
      return (
        n.includes('sales tax') ||
        n.includes(code) ||
        (code.includes('gst') && n.includes('gst')) ||
        (code.includes('hst') && n.includes('hst')) ||
        (code.includes('pst') && n.includes('pst')) ||
        (code.includes('qst') && n.includes('qst'))
      );
    };

    const find = (must: string[]) =>
      candidates.find((a) => {
        const n = (a.name || '').toLowerCase();
        return must.every((m) => n.includes(m)) && matchesTax(n);
      })?.id ?? null;

    return isDebit
      ? (find(['paid', 'purchase']) ?? find(['paid']) ?? find(['input']) ?? find(['recover']) ?? find(['sales', 'tax', 'paid']))
      : (find(['collected']) ?? find(['payable']) ?? find(['sales', 'tax', 'payable']));
  };

  const onSubmit = async (values: EntryFormValues) => {
    if (!user) return;

    const txn = values.transaction_currency || baseCcy;
    const rate = values.exchange_rate || 1;
    const isFcEntry = txn !== baseCcy;

    // Block if FC and rate missing
    if (isFcEntry && (!rate || rate <= 0)) {
      toast.error(`Exchange rate required for ${txn}. Add one in Banking → Exchange Rates.`);
      return;
    }

    // Cross-currency: block only when a per-line currency cannot be resolved.
    if (missingLineRates.length > 0) {
      toast.error(
        `Missing exchange rate for ${missingLineRates.join(', ')}. Add one in Banking → Exchange Rates or enable Override.`,
      );
      return;
    }

    type Built = {
      account_id: string;
      description?: string;
      debit: number;
      credit: number;
      line_order: number;
      customer_id?: string | null;
      vendor_id?: string | null;
      currency?: string | null;
      exchange_rate?: number | null;
      base_currency_debit?: number;
      base_currency_credit?: number;
    };

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const fxAcctId = mcSettings?.realized_fx_account_id || null;
    const pushBuilt = (arr: Built[], partial: Omit<Built, 'currency' | 'exchange_rate' | 'base_currency_debit' | 'base_currency_credit'>) => {
      // The configured Realized FX Gain/Loss account is always denominated in
      // the base currency — never translate it at the FC rate (avoids the
      // JE-0053 defect where the FX plug itself was posted in USD).
      const isFxAcct = fxAcctId && partial.account_id === fxAcctId;
      const fx = isFxAcct
        ? { ccy: baseCcy, rate: 1, missing: false }
        : resolveLineFx(partial.account_id);
      if (!isFcEntry && fx.ccy === baseCcy) {
        // Pure base-currency entry — write raw amounts without ccy/rate columns.
        arr.push({ ...partial });
        return;
      }
      arr.push({
        ...partial,
        currency: fx.ccy,
        exchange_rate: fx.rate,
        base_currency_debit: round2(partial.debit * fx.rate),
        base_currency_credit: round2(partial.credit * fx.rate),
      });
    };

    const journalLines: Built[] = [];

    for (const line of values.lines) {
      // Add main line
      pushBuilt(journalLines, {
        account_id: line.account_id,
        description: buildLineDescription(line),
        debit: line.debit,
        credit: line.credit,
        line_order: journalLines.length,
        customer_id: line.customer_id || null,
        vendor_id: line.vendor_id || null,
      });

      // Add tax line(s) if applicable
      if (line.tax_code_id && line.tax_amount && line.tax_amount > 0) {
        const baseAmount = Math.max(line.debit || 0, line.credit || 0);
        const split = getCombinedSplit(line.tax_code_id, baseAmount);

        if (split) {
          const findOrgTaxCode = (codeCandidates: string[]) =>
            activeTaxCodes.find((tc) =>
              codeCandidates.some((c) => (tc.code || '').toUpperCase() === c.toUpperCase())
            );

          for (const comp of split.taxes) {
            const candidates =
              comp.type === 'GST'
                ? ['GST']
                : comp.type === 'QST'
                ? ['QST', 'PST']
                : ['PST', comp.code];
            const orgCode = findOrgTaxCode(candidates);
            const stubCode = orgCode ?? {
              code: comp.code,
              gl_collected_account_id: null,
              gl_paid_account_id: null,
            };
            const taxAccountId = resolveTaxAccountId(stubCode as any, {
              debit: line.debit,
              credit: line.credit,
            });
            if (!taxAccountId) {
              toast.error(
                `Tax account not found for ${comp.code}. Please add a ${comp.type} tax account in Chart of Accounts.`
              );
              return;
            }
            pushBuilt(journalLines, {
              account_id: taxAccountId,
              description: `${comp.code} ${comp.rate}% on ${buildLineDescription(line)}`,
              debit: (line.debit || 0) > 0 ? comp.amount : 0,
              credit: (line.credit || 0) > 0 ? comp.amount : 0,
              line_order: journalLines.length,
            });
          }
        } else {
          const taxCode = activeTaxCodes.find((tc) => tc.id === line.tax_code_id);
          if (!taxCode) continue;

          const taxAccountId = resolveTaxAccountId(taxCode, { debit: line.debit, credit: line.credit });
          if (!taxAccountId) {
            toast.error(`Tax account not found for ${taxCode.code}. Please add a tax account in Chart of Accounts.`);
            return;
          }

          pushBuilt(journalLines, {
            account_id: taxAccountId,
            description: `${taxCode.name} on ${buildLineDescription(line)}`,
            debit: line.debit > 0 ? line.tax_amount : 0,
            credit: line.credit > 0 ? line.tax_amount : 0,
            line_order: journalLines.length,
          });
        }
      }
    }

    // Base-currency balance check + Realized FX Gain/Loss plug.
    // For any FC or cross-currency entry, balance the JE in base currency by
    // adding a plug line against organizations.realized_fx_account_id. This
    // covers both pure rounding drift (≤ 2¢) and legitimate cross-currency
    // spreads (e.g. CAD→USD bank transfers booked as a JE).
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
          line_order: journalLines.length,
          currency: baseCcy,
          exchange_rate: 1,
          base_currency_debit: driftCents < 0 ? plug : 0,
          base_currency_credit: driftCents > 0 ? plug : 0,
        });
      }
    }

    // Audit note: capture FX rate provenance
    let notes = values.notes || '';
    if (isFcEntry) {
      const src = autoFetchedRate === rate ? 'auto' : 'manual_override';
      const auditLine = `FX: 1 ${txn} = ${rate} ${baseCcy} (source: ${src})`;
      notes = notes ? `${notes}\n${auditLine}` : auditLine;
    }

    const created = await createEntry.mutateAsync({
      organizationId,
      userId: user.id,
      entry: {
        reference: values.reference,
        entry_date: values.entry_date,
        journal_type: values.journal_type,
        description: values.description,
        notes,
        department_id: values.department_id ?? null,
        lines: journalLines,
      },
    });

    if (submitMode === 'post' && created?.id) {
      try {
        await postEntry.mutateAsync({
          id: created.id,
          organizationId,
          userId: user.id,
        });
      } catch {
        return;
      }
    }

    onOpenChange(false);
  };

  const buildLineDescription = (line: typeof watchedLines[0]): string => {
    const parts: string[] = [];
    if (line.description) parts.push(line.description);
    if (line.vendor_name) parts.push(`[Vendor: ${line.vendor_name}]`);
    if (line.customer_name) parts.push(`[Customer: ${line.customer_name}]`);
    return parts.join(' ') || '';
  };

  const handleVendorSelect = (lineIndex: number, vendorId: string | null, vendorName: string | null) => {
    form.setValue(`lines.${lineIndex}.vendor_id`, vendorId);
    form.setValue(`lines.${lineIndex}.vendor_name`, vendorName);
  };

  const handleCustomerSelect = (lineIndex: number, customerId: string | null, customerName: string | null) => {
    form.setValue(`lines.${lineIndex}.customer_id`, customerId);
    form.setValue(`lines.${lineIndex}.customer_name`, customerName);
  };

  const handleQuickAddVendor = (lineIndex: number) => {
    setActiveLineIndex(lineIndex);
    setQuickAddVendorOpen(true);
  };

  const handleQuickAddCustomer = (lineIndex: number) => {
    setActiveLineIndex(lineIndex);
    setQuickAddCustomerOpen(true);
  };

  const handleVendorCreated = (vendorId: string, vendorName: string) => {
    if (activeLineIndex !== null) {
      handleVendorSelect(activeLineIndex, vendorId, vendorName);
    }
    setActiveLineIndex(null);
  };

  const handleCustomerCreated = (customerId: string, customerName: string) => {
    if (activeLineIndex !== null) {
      handleCustomerSelect(activeLineIndex, customerId, customerName);
    }
    setActiveLineIndex(null);
  };

  const handleQuickAddAccount = () => {
    setQuickAddAccountOpen(true);
  };

  const handleAccountCreated = (accountId: string, accountName: string) => {
    // Refresh accounts list will happen automatically via query invalidation
  };

  const { organization } = useCurrentOrganization();
  
  const formatCurrency = (value: number) => {
    const countryCode = organization?.country || 'CA';
    const localization = getCountryLocalization(countryCode);
    const locale = getLocaleForCountry(countryCode);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>
              Create a new journal entry. Debits must equal credits.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="JE-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {journalTypeOptions.map((opt) => (
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
                              : [{ code: baseCcy, name: baseCcy, symbol: '' }] as any
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
                        <FormLabel className="!mt-0">Override rate (requires approval)</FormLabel>
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



              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Division</FormLabel>
                    <FormControl>
                      <DivisionSelect
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v)}
                        placeholder="Tag this entry to a division"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this journal entry..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


              {/* Lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Entry Lines</FormLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleQuickAddAccount}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add GL Account
                    </Button>
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
                          vendor_id: null,
                          customer_id: null,
                          tax_code_id: null,
                          tax_amount: 0,
                        })
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Line
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Account</th>
                        <th className="text-left p-2 font-medium w-48">Entity</th>
                        <th className="text-left p-2 font-medium w-40">Tax Code</th>
                        <th className="text-right p-2 font-medium w-32">Debit</th>
                        <th className="text-right p-2 font-medium w-32">Credit</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => {
                        const line = watchedLines[index];
                        const entityType = getEntityTypeForAccount(line?.account_id || '');
                        
                        return (
                          <tr key={field.id} className="border-t">
                            <td className="p-2">
                              <FormField
                                control={form.control}
                                name={`lines.${index}.account_id`}
                                render={({ field }) => (
                                  <SearchableAccountSelect
                                    accounts={postableAccounts}
                                    value={field.value}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      // Clear entity selections when account changes
                                      handleVendorSelect(index, null, null);
                                      handleCustomerSelect(index, null, null);
                                    }}
                                    placeholder="Select account"
                                  />
                                )}
                              />
                            </td>
                            <td className="p-2">
                              {/* Show entity selector based on account type, defaulting to both */}
                              {entityType === 'vendor' ? (
                                <EntityLookupPopover
                                  type="vendor"
                                  entities={vendors}
                                  selectedId={line?.vendor_id}
                                  onSelect={(id, name) => handleVendorSelect(index, id, name)}
                                  onAddNew={() => handleQuickAddVendor(index)}
                                />
                              ) : entityType === 'customer' ? (
                                <EntityLookupPopover
                                  type="customer"
                                  entities={customers}
                                  selectedId={line?.customer_id}
                                  onSelect={(id, name) => handleCustomerSelect(index, id, name)}
                                  onAddNew={() => handleQuickAddCustomer(index)}
                                />
                              ) : (
                                <div className="flex gap-1">
                                  <EntityLookupPopover
                                    type="vendor"
                                    entities={vendors}
                                    selectedId={line?.vendor_id}
                                    onSelect={(id, name) => {
                                      handleVendorSelect(index, id, name);
                                      if (id) handleCustomerSelect(index, null, null);
                                    }}
                                    onAddNew={() => handleQuickAddVendor(index)}
                                  />
                                  <EntityLookupPopover
                                    type="customer"
                                    entities={customers}
                                    selectedId={line?.customer_id}
                                    onSelect={(id, name) => {
                                      handleCustomerSelect(index, id, name);
                                      if (id) handleVendorSelect(index, null, null);
                                    }}
                                    onAddNew={() => handleQuickAddCustomer(index)}
                                  />
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              <FormField
                                control={form.control}
                                name={`lines.${index}.tax_code_id`}
                                render={({ field }) => (
                                  <SearchableTaxCodeSelect
                                    taxCodes={selectableTaxCodes}
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
                                    className="h-9"
                                    value={field.value || 0}
                                    onChange={(value) => {
                                      field.onChange(value);
                                      // Auto-clear credit when debit is entered
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
                                    className="h-9"
                                    value={field.value || 0}
                                    onChange={(value) => {
                                      field.onChange(value);
                                      // Auto-clear debit when credit is entered
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
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
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
                    <tfoot className="border-t bg-muted/30">
                      {/* Sub Total Row */}
                      <tr className="border-b">
                        <td className="p-2 font-medium" colSpan={3}>Sub Total</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(subTotalDebits)}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(subTotalCredits)}</td>
                        <td></td>
                      </tr>
                      {/* Tax Summary Rows */}
                      {taxEntries.map((tax) => (
                        <tr key={tax.code} className="border-b text-sm text-muted-foreground">
                          <td className="p-2 pl-4" colSpan={3}>
                            {tax.code} [{tax.rate}%]
                          </td>
                          <td className="p-2 text-right font-mono">
                            {tax.debit > 0 ? formatCurrency(tax.debit) : '-'}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {tax.credit > 0 ? formatCurrency(tax.credit) : '-'}
                          </td>
                          <td></td>
                        </tr>
                      ))}
                      {/* Grand Total Row */}
                      <tr className="font-semibold text-base">
                        <td className="p-2" colSpan={3}>Total</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(totalDebits)}</td>
                        <td className="p-2 text-right font-mono">{formatCurrency(totalCredits)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {!isBalanced && totalDebits + totalCredits > 0 && (
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
                      {((Math.abs(baseTotals.diff) / largerSide) * 100).toFixed(1)}% of the larger side). Verify each
                      line's foreign-currency amount — a common mistake is entering the base-currency equivalent into
                      a foreign-currency account.
                    </div>
                  </div>
                )}

                {isFc && (
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 pt-1">
                    <span>
                      Totals in {txnCcy}: Dr {totalDebits.toFixed(2)} / Cr {totalCredits.toFixed(2)}
                    </span>
                    <span>
                      Equivalent in {baseCcy} @ {exchangeRate}: Dr{' '}
                      {(totalDebits * exchangeRate).toFixed(2)} / Cr{' '}
                      {(totalCredits * exchangeRate).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
                </div>
              </ScrollArea>

              <DialogFooter className="pt-4 border-t mt-4 flex-shrink-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  onClick={() => setSubmitMode('draft')}
                  disabled={
                    createEntry.isPending ||
                    postEntry.isPending ||
                    (!isCrossCurrency && !isBalanced) ||
                    missingLineRates.length > 0
                  }
                >
                  {createEntry.isPending && submitMode === 'draft' ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="submit"
                  onClick={() => setSubmitMode('post')}
                  disabled={
                    createEntry.isPending ||
                    postEntry.isPending ||
                    (!isCrossCurrency && !isBalanced) ||
                    missingLineRates.length > 0 ||
                    (isFc && (!exchangeRate || exchangeRate <= 0))
                  }
                >
                  {(createEntry.isPending || postEntry.isPending) && submitMode === 'post'
                    ? 'Posting...'
                    : 'Save & Post'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <QuickAddVendorDialog
        open={quickAddVendorOpen}
        onOpenChange={setQuickAddVendorOpen}
        onVendorCreated={handleVendorCreated}
      />

      <QuickAddCustomerDialog
        open={quickAddCustomerOpen}
        onOpenChange={setQuickAddCustomerOpen}
        onCustomerCreated={handleCustomerCreated}
      />

      <QuickAddAccountDialog
        open={quickAddAccountOpen}
        onOpenChange={setQuickAddAccountOpen}
        organizationId={organizationId}
        onAccountCreated={handleAccountCreated}
      />
    </>
  );
}
