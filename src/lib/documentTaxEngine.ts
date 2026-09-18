/**
 * Document-level retail sales tax engine.
 *
 * Calculates and persists GST/HST (ITC), VAT / IVA / TVA (input tax),
 * PST paid, and other retail taxes on invoices (collected) and
 * bills / expenses (paid).
 */
import { supabase } from '@/integrations/supabase/client';
import {
  classifyRetailTaxFamily,
  getCountryLocalization,
  getPrimaryRetailTaxType,
  getRetailTaxTypes,
  isRecoverableRetailTax,
  resolveCountryCode,
  type TaxDirection,
} from '@/data/countryLocalizations';
import { calculateTaxes } from '@/lib/taxCalculator';
import { calculateSplitTaxes } from '@/lib/splitTaxCalculator';
import type { SalesTaxSettings, TaxCode } from '@/hooks/useSalesTax';

export interface DocumentTaxLine {
  taxType: string;
  taxCode: string;
  taxName: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  isRecoverable: boolean;
  glAccountId: string | null;
  authority: string | null;
  jurisdictionCode: string | null;
  taxDirection: TaxDirection;
}

export interface DocumentTaxComputation {
  taxes: DocumentTaxLine[];
  taxableAmount: number;
  totalTax: number;
  recoverableTax: number;
  nonRecoverableTax: number;
}

export interface TaxGlAccountMap {
  gstCollectedAccountId?: string | null;
  gstPaidAccountId?: string | null;
  pstCollectedAccountId?: string | null;
  pstPaidAccountId?: string | null;
  vatCollectedAccountId?: string | null;
  vatPaidAccountId?: string | null;
}

function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function settingsAllowRecoverable(
  settings: Partial<SalesTaxSettings> | null | undefined,
  family: ReturnType<typeof classifyRetailTaxFamily>,
  direction: TaxDirection,
): boolean {
  if (direction !== 'paid') return true;
  if (settings?.claim_input_tax === false) return false;
  if ((family === 'gst' || family === 'hst') && settings?.claim_gst_hst_itc === false) {
    return false;
  }
  return true;
}

export function resolveRetailTaxGlAccount(
  taxCode: string,
  direction: TaxDirection,
  accounts: TaxGlAccountMap,
  taxCodeRow?: Pick<TaxCode, 'gl_collected_account_id' | 'gl_paid_account_id'> | null,
): string | null {
  if (direction === 'collected' && taxCodeRow?.gl_collected_account_id) {
    return taxCodeRow.gl_collected_account_id;
  }
  if (direction === 'paid' && taxCodeRow?.gl_paid_account_id) {
    return taxCodeRow.gl_paid_account_id;
  }

  const family = classifyRetailTaxFamily(taxCode);
  if (direction === 'collected') {
    if (family === 'pst') return accounts.pstCollectedAccountId ?? null;
    if (family === 'vat' || family === 'sales_tax') {
      return accounts.vatCollectedAccountId ?? accounts.gstCollectedAccountId ?? null;
    }
    return accounts.gstCollectedAccountId ?? accounts.vatCollectedAccountId ?? null;
  }

  if (family === 'pst') return accounts.pstPaidAccountId ?? null;
  if (family === 'vat' || family === 'sales_tax') {
    return accounts.vatPaidAccountId ?? accounts.gstPaidAccountId ?? null;
  }
  return accounts.gstPaidAccountId ?? accounts.vatPaidAccountId ?? null;
}

function accountsFromSettings(settings?: Partial<SalesTaxSettings> | null): TaxGlAccountMap {
  return {
    gstCollectedAccountId: settings?.gst_collected_account_id,
    gstPaidAccountId: settings?.gst_paid_account_id,
    pstCollectedAccountId: settings?.pst_collected_account_id,
    pstPaidAccountId: settings?.pst_paid_account_id,
    vatCollectedAccountId: settings?.vat_collected_account_id,
    vatPaidAccountId: settings?.vat_paid_account_id,
  };
}

function findTaxCodeRow(
  taxCodes: TaxCode[] | undefined,
  code: string,
  taxType: string,
): TaxCode | undefined {
  if (!taxCodes?.length) return undefined;
  const upper = code.toUpperCase();
  return (
    taxCodes.find((c) => c.code.toUpperCase() === upper) ||
    taxCodes.find((c) => c.tax_type.toUpperCase() === taxType.toUpperCase()) ||
    taxCodes.find((c) => c.code.toUpperCase().startsWith(upper.split(/[+_-]/)[0]))
  );
}

function displayName(
  countryCode: string,
  taxType: string,
  direction: TaxDirection,
  fallback: string,
): string {
  const match = getCountryLocalization(countryCode).taxTypes.find(
    (t) => t.code === taxType || taxType.startsWith(t.code),
  );
  if (!match) return fallback;
  return direction === 'paid' ? (match.paidName || fallback) : match.name || fallback;
}

export function computeDocumentTaxes(params: {
  countryCode?: string | null;
  jurisdictionCode?: string | null;
  amount: number;
  taxInclusive?: boolean;
  direction: TaxDirection;
  settings?: Partial<SalesTaxSettings> | null;
  taxCodes?: TaxCode[];
  /** When a line already has an explicit rate, emit a single tax using the primary type. */
  taxRateOverride?: number | null;
}): DocumentTaxComputation {
  const countryCode = resolveCountryCode(params.countryCode);
  const jurisdictionCode = params.jurisdictionCode || params.settings?.province || null;
  const direction = params.direction;
  const amount = Number(params.amount) || 0;
  const accounts = accountsFromSettings(params.settings);

  if (amount === 0) {
    return { taxes: [], taxableAmount: 0, totalTax: 0, recoverableTax: 0, nonRecoverableTax: 0 };
  }

  const collectEnabled = (taxType: string) => {
    const family = classifyRetailTaxFamily(taxType);
    if (!params.settings) return true;
    if (family === 'hst') return params.settings.collect_hst !== false;
    if (family === 'gst') return params.settings.collect_gst !== false || params.settings.collect_hst !== false;
    if (family === 'pst') return params.settings.collect_pst !== false;
    if (family === 'sales_tax') return params.settings.collect_sales_tax !== false;
    if (family === 'vat') return params.settings.collect_vat !== false || params.settings.collect_gst !== false;
    return true;
  };

  const toComputation = (taxes: DocumentTaxLine[], taxableAmount: number): DocumentTaxComputation => {
    const totalTax = roundCurrency(taxes.reduce((sum, t) => sum + t.taxAmount, 0));
    const recoverableTax = roundCurrency(
      taxes.filter((t) => t.isRecoverable).reduce((sum, t) => sum + t.taxAmount, 0),
    );
    return {
      taxes,
      taxableAmount: roundCurrency(taxableAmount),
      totalTax,
      recoverableTax,
      nonRecoverableTax: roundCurrency(totalTax - recoverableTax),
    };
  };

  if (params.taxRateOverride != null && params.taxRateOverride >= 0) {
    const primary = getPrimaryRetailTaxType(countryCode);
    const taxType = primary?.code || 'VAT';
    const rate = params.taxRateOverride;
    const taxableAmount = params.taxInclusive ? amount / (1 + rate / 100) : amount;
    const taxAmount = roundCurrency(params.taxInclusive ? amount - taxableAmount : taxableAmount * (rate / 100));
    const family = classifyRetailTaxFamily(taxType);
    const recoverable =
      direction === 'paid' &&
      isRecoverableRetailTax(taxType, countryCode, jurisdictionCode || undefined) &&
      settingsAllowRecoverable(params.settings, family, direction);
    const row = findTaxCodeRow(params.taxCodes, taxType, taxType);
    const taxes: DocumentTaxLine[] = [
      {
        taxType,
        taxCode: row?.code || taxType,
        taxName: displayName(countryCode, taxType, direction, primary?.name || taxType),
        taxRate: rate,
        taxableAmount: roundCurrency(taxableAmount),
        taxAmount,
        isRecoverable: direction === 'collected' ? true : recoverable,
        glAccountId: resolveRetailTaxGlAccount(taxType, direction, accounts, row),
        authority: null,
        jurisdictionCode,
        taxDirection: direction,
      },
    ];
    return toComputation(taxes, taxableAmount);
  }

  if (countryCode === 'CA' && jurisdictionCode) {
    const split = calculateSplitTaxes(amount, jurisdictionCode, params.taxInclusive === true, {
      gst: direction === 'paid' ? accounts.gstPaidAccountId : accounts.gstCollectedAccountId,
      hst: direction === 'paid' ? accounts.gstPaidAccountId : accounts.gstCollectedAccountId,
      pst: direction === 'paid' ? accounts.pstPaidAccountId : accounts.pstCollectedAccountId,
    });

    const taxes: DocumentTaxLine[] = split.taxes
      .filter((t) => collectEnabled(t.type))
      .map((t) => {
        const family = classifyRetailTaxFamily(t.type);
        const claimable = settingsAllowRecoverable(params.settings, family, direction);
        const recoverable =
          direction === 'paid'
            ? Boolean(claimable && t.isRecoverable)
            : t.isRecoverable;
        const row = findTaxCodeRow(params.taxCodes, t.code, t.type);
        return {
          taxType: t.type,
          taxCode: t.code,
          taxName: displayName(countryCode, t.type, direction, `${t.type} - ${t.authority}`),
          taxRate: t.rate,
          taxableAmount: split.taxableAmount,
          taxAmount: t.amount,
          isRecoverable: recoverable,
          glAccountId: t.glAccountId ?? resolveRetailTaxGlAccount(t.type, direction, accounts, row),
          authority: t.authority,
          jurisdictionCode,
          taxDirection: direction,
        } satisfies DocumentTaxLine;
      })
    return toComputation(taxes, split.taxableAmount);
  }

  const retailTypes = getRetailTaxTypes(countryCode, direction).filter((t) => collectEnabled(t.code));
  const rules = retailTypes.map((t) => {
    const row = findTaxCodeRow(params.taxCodes, t.code, t.code);
    let rate = t.defaultRate;
    if (params.settings) {
      const family = classifyRetailTaxFamily(t.code);
      if (family === 'gst') rate = params.settings.gst_rate ?? rate;
      if (family === 'hst') rate = params.settings.hst_rate ?? rate;
      if (family === 'pst') rate = params.settings.pst_rate ?? rate;
      if (family === 'vat') rate = params.settings.vat_rate ?? rate;
      if (family === 'sales_tax') rate = params.settings.sales_tax_rate ?? rate;
    }
    if (row?.rate != null) rate = row.rate;
    return {
      id: row?.id || t.code,
      code: row?.code || t.code,
      name: direction === 'paid' ? t.paidName : t.name,
      rate,
      isRecoverable:
        direction === 'paid'
          ? t.isRecoverable && settingsAllowRecoverable(params.settings, classifyRetailTaxFamily(t.code), direction)
          : true,
      isCompound: row?.is_compound ?? false,
    };
  }).filter((r) => r.rate > 0);

  const calc = calculateTaxes({
    grossAmount: amount,
    taxRules: rules,
    isInclusive: params.taxInclusive === true,
    countryCode,
    jurisdictionCode: jurisdictionCode || undefined,
  });

  const taxes: DocumentTaxLine[] = calc.taxes.map((t) => {
    const row = findTaxCodeRow(params.taxCodes, t.taxCode, t.taxCode);
    const family = classifyRetailTaxFamily(t.taxCode);
    const recoverable =
      direction === 'paid'
        ? isRecoverableRetailTax(t.taxCode, countryCode, jurisdictionCode || undefined) &&
          settingsAllowRecoverable(params.settings, family, direction) &&
          t.isRecoverable
        : t.isRecoverable;
    return {
      taxType: family === 'vat' ? (row?.tax_type || t.taxCode) : t.taxCode,
      taxCode: t.taxCode,
      taxName: displayName(countryCode, t.taxCode, direction, t.taxName),
      taxRate: t.rate,
      taxableAmount: calc.taxableAmount,
      taxAmount: t.amount,
      isRecoverable: recoverable,
      glAccountId: resolveRetailTaxGlAccount(t.taxCode, direction, accounts, row),
      authority: null,
      jurisdictionCode,
      taxDirection: direction,
    };
  });

  return toComputation(taxes, calc.taxableAmount);
}

function toPersistRows(taxes: DocumentTaxLine[]) {
  return taxes.map((t) => ({
    tax_type: t.taxType,
    tax_code: t.taxCode,
    rate: t.taxRate,
    taxable_amount: t.taxableAmount,
    tax_amount: t.taxAmount,
    is_recoverable: t.isRecoverable,
    gl_account_id: t.glAccountId,
    authority: t.authority,
    jurisdiction_code: t.jurisdictionCode,
    tax_direction: t.taxDirection,
  }));
}

export async function persistInvoiceTaxes(invoiceId: string, taxes: DocumentTaxLine[]): Promise<void> {
  await supabase.from('invoice_taxes').delete().eq('invoice_id', invoiceId);
  if (taxes.length === 0) return;
  const { error } = await supabase.from('invoice_taxes').insert(
    toPersistRows(taxes).map((row) => ({ ...row, invoice_id: invoiceId })),
  );
  if (error) throw error;
}

export async function persistBillTaxes(billId: string, taxes: DocumentTaxLine[]): Promise<void> {
  await supabase.from('bill_taxes').delete().eq('bill_id', billId);
  if (taxes.length === 0) return;
  const { error } = await supabase.from('bill_taxes').insert(
    toPersistRows(taxes).map((row) => ({ ...row, bill_id: billId })),
  );
  if (error) throw error;
}

export async function persistExpenseTaxes(expenseId: string, taxes: DocumentTaxLine[]): Promise<void> {
  await supabase.from('expense_taxes').delete().eq('expense_id', expenseId);
  if (taxes.length === 0) return;
  const { error } = await supabase.from('expense_taxes').insert(
    toPersistRows(taxes).map((row) => ({ ...row, expense_id: expenseId })),
  );
  if (error) throw error;
}

export function splitPurchaseTaxPosting(taxes: DocumentTaxLine[]): {
  recoverable: DocumentTaxLine[];
  nonRecoverable: DocumentTaxLine[];
  recoverableTotal: number;
  nonRecoverableTotal: number;
} {
  const recoverable = taxes.filter((t) => t.isRecoverable && t.taxAmount > 0);
  const nonRecoverable = taxes.filter((t) => !t.isRecoverable && t.taxAmount > 0);
  return {
    recoverable,
    nonRecoverable,
    recoverableTotal: roundCurrency(recoverable.reduce((s, t) => s + t.taxAmount, 0)),
    nonRecoverableTotal: roundCurrency(nonRecoverable.reduce((s, t) => s + t.taxAmount, 0)),
  };
}
