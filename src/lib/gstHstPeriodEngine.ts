/**
 * CRA GST/HST period engine.
 *
 * Builds a GST34 working copy from invoices, bills, and expenses in the
 * selected reporting period — not from lifetime tax GL balances.
 *
 * Line mapping (GST/HST NETFILE / GST34):
 *   90  Taxable sales including zero-rated supplies (except zero-rated exports)
 *   90A Taxable sales (GST/HST charged)
 *   90B Zero-rated sales (GST/HST at 0%)
 *   91  Exempt supplies, zero-rated exports, and other revenue
 *   101 Sales and other revenue (90 + 91)
 *   103 GST/HST collected or collectible
 *   106 Input tax credits (ITCs)
 *   109 Net tax (105 − 108)
 *
 * @see https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/instructions-preparing-return.html
 */
import { buildGstHstReturn } from '@/lib/filings/canadaGstHst';
import type { FilingFormResult, PeriodTaxRow, PeriodTotals } from '@/lib/filings/types';
import type { TaxCodePeriodRow } from '@/lib/taxPeriodReport';
import {
  bumpRstAgency,
  finalizeRstAgencies,
  type RstAgencyTotals,
} from '@/lib/rstAgencies';

export type GstHstSupplyClass = 'taxable' | 'zero_rated' | 'exempt';

export interface GstHstTaxCodeFlag {
  id?: string | null;
  code: string;
  name?: string | null;
  tax_type?: string | null;
  rate?: number | null;
  is_zero_rated?: boolean | null;
  is_exempt?: boolean | null;
  is_recoverable?: boolean | null;
  gl_collected_account_id?: string | null;
  gl_paid_account_id?: string | null;
}

export interface GstHstDocumentTax {
  tax_code?: string | null;
  tax_type?: string | null;
  rate?: number | null;
  taxable_amount?: number | null;
  tax_amount?: number | null;
  is_recoverable?: boolean | null;
  authority?: string | null;
}

export interface GstHstInvoiceLine {
  amount?: number | null;
  tax_amount?: number | null;
  tax_rate?: number | null;
  description?: string | null;
}

export interface GstHstInvoiceDocument {
  id: string;
  date: string;
  number: string;
  description?: string | null;
  partyName?: string | null;
  status?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  gst_hst_amount?: number | null;
  is_gst_hst_exempt?: boolean | null;
  taxes?: GstHstDocumentTax[] | null;
  lines?: GstHstInvoiceLine[] | null;
}

export interface GstHstPurchaseDocument {
  source: 'bill' | 'expense';
  id: string;
  date: string;
  number: string;
  description?: string | null;
  partyName?: string | null;
  status?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  taxes?: GstHstDocumentTax[] | null;
}

export interface GstHstBankDocument {
  source: 'bank' | 'credit_card' | 'journal';
  direction: 'collected' | 'paid';
  id: string;
  date: string;
  number: string;
  description?: string | null;
  partyName?: string | null;
  amount?: number | null;
  subtotal?: number | null;
  matchedInvoiceId?: string | null;
  matchedBillId?: string | null;
  taxes?: GstHstDocumentTax[] | null;
}

export interface GstHstSupportRow {
  date: string;
  type: 'Invoice' | 'Bill' | 'Expense' | 'Bank' | 'Credit card' | 'Journal';
  number: string;
  description: string;
  name: string;
  taxCode: string;
  taxRate: number;
  supplyClass: GstHstSupplyClass | 'itc' | 'non_recoverable';
  craLine: string;
  taxableAmount: number;
  taxAmount: number;
}

export interface GstHstPeriodSnapshot {
  periodStart: string;
  periodEnd: string;
  taxableSales: number;
  zeroRatedSales: number;
  exemptSales: number;
  exemptZeroRatedSales: number;
  line90: number;
  line91: number;
  line101: number;
  gstHstCollected: number;
  gstHstCollectedGross: number;
  gstHstCollectedException: number;
  itc: number;
  itcGross: number;
  itcException: number;
  netTax: number;
  agencies: RstAgencyTotals[];
  invoiceCount: number;
  purchaseCount: number;
  usedDocumentCollected: boolean;
  usedDocumentItc: boolean;
  supportRows: GstHstSupportRow[];
  rows: PeriodTaxRow[];
  totals: PeriodTotals;
  byTaxCode: TaxCodePeriodRow[];
  form: FilingFormResult;
}

export interface GstHstJournalFallback {
  taxCollected: number;
  itcClaimed: number;
  taxableSales: number;
  rows?: PeriodTaxRow[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function addSupport(
  rows: GstHstSupportRow[],
  row: Omit<GstHstSupportRow, 'name' | 'taxRate'> & Partial<Pick<GstHstSupportRow, 'name' | 'taxRate'>>,
) {
  rows.push({
    ...row,
    name: row.name ?? '',
    taxRate: Number(row.taxRate ?? 0),
  });
}

function splitSignedTax(amount: number): { gross: number; exception: number } {
  if (amount < 0) return { gross: 0, exception: amount };
  return { gross: amount, exception: 0 };
}

export const EXCLUDED_GST_HST_STATUSES = new Set([
  'draft',
  'void',
  'cancelled',
  'canceled',
  'rejected',
]);

export function isIncludedGstHstDocument(status?: string | null): boolean {
  if (!status) return true;
  return !EXCLUDED_GST_HST_STATUSES.has(status.toLowerCase());
}

export function isGstHstTax(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
}): boolean {
  if (/(gst|hst)/i.test(String(row.tax_type ?? ''))) return true;
  const code = String(row.tax_code ?? '').toUpperCase();
  if (code.includes('GST') || code.includes('HST')) return true;
  const auth = String(row.authority ?? '').toUpperCase();
  return auth.includes('GST') || auth.includes('HST');
}

export function isProvincialSalesTax(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
}): boolean {
  if (/^(pst|qst|rst|tvq)$/i.test(String(row.tax_type ?? ''))) return true;
  const hay = `${row.tax_code ?? ''} ${row.authority ?? ''}`.toUpperCase();
  return hay.includes('PST') || hay.includes('QST') || hay.includes('RST') || hay.includes('TVQ');
}

export function classifyGstHstSupply(
  tax: GstHstDocumentTax | undefined,
  flags: GstHstTaxCodeFlag | undefined,
  invoiceExempt?: boolean | null,
): GstHstSupplyClass {
  if (invoiceExempt) return 'exempt';
  if (flags?.is_exempt) return 'exempt';
  if (flags?.is_zero_rated) return 'zero_rated';
  const rate = Number(tax?.rate ?? flags?.rate ?? 0);
  const taxAmount = Number(tax?.tax_amount ?? 0);
  if (tax && isGstHstTax({ ...tax, tax_type: tax.tax_type ?? flags?.tax_type }) && rate === 0 && taxAmount === 0) {
    return 'zero_rated';
  }
  return 'taxable';
}

export function taxesFromBankingPosting(input: {
  taxCode?: GstHstTaxCodeFlag | null;
  taxAmount?: number | null;
  subtotal?: number | null;
  amount?: number | null;
  taxBreakdown?: Array<{ code?: string; rate?: number; amount?: number }> | null;
}): GstHstDocumentTax[] {
  const breakdown = Array.isArray(input.taxBreakdown) ? input.taxBreakdown : [];
  const subtotal = Number(
    input.subtotal ??
      (Number(input.amount ?? 0) - Number(input.taxAmount ?? 0)),
  );
  if (breakdown.length > 0) {
    return breakdown.map((item) => ({
      tax_code: item.code ?? input.taxCode?.code ?? null,
      tax_type: item.code ?? input.taxCode?.tax_type ?? null,
      rate: Number(item.rate ?? input.taxCode?.rate ?? 0),
      taxable_amount: subtotal,
      tax_amount: Number(item.amount ?? 0),
      is_recoverable: input.taxCode?.is_recoverable !== false,
    }));
  }
  if (!input.taxCode && !Number(input.taxAmount ?? 0)) return [];
  return [{
    tax_code: input.taxCode?.code ?? null,
    tax_type: input.taxCode?.tax_type ?? null,
    rate: Number(input.taxCode?.rate ?? 0),
    taxable_amount: subtotal,
    tax_amount: Number(input.taxAmount ?? 0),
    is_recoverable: input.taxCode?.is_recoverable !== false,
  }];
}

export function isBankCollectedSide(transactionType?: string | null): boolean {
  return /^(deposit|credit|refund|interest)$/i.test(String(transactionType ?? ''));
}

/** Source documents already counted from invoices/bills/expenses. */
export const DOCUMENT_LINKED_GST_HST_JE_SOURCES = new Set([
  'invoice',
  'bill',
  'expense',
  'expense_claim',
]);

/** Banking JEs are counted only when the bank/CC document already has GST/HST tax. */
export const BANKING_LINKED_GST_HST_JE_SOURCES = new Set([
  'bank_transaction',
  'credit_card_transaction',
]);

export const LINKED_GST_HST_JE_SOURCES = new Set([
  ...DOCUMENT_LINKED_GST_HST_JE_SOURCES,
  ...BANKING_LINKED_GST_HST_JE_SOURCES,
]);

export function isLinkedGstHstJournalSource(sourceType?: string | null): boolean {
  return LINKED_GST_HST_JE_SOURCES.has(String(sourceType ?? '').toLowerCase());
}

export function isYearEndClosingJournal(reference?: string | null): boolean {
  return String(reference ?? '').toUpperCase().startsWith('CLOSE-');
}

/** CRA remittances / refunds: JE only touches tax + bank/cash, no income or expense. */
export function isTaxAuthoritySettlementJournal(accountTypes: Array<string | null | undefined>): boolean {
  const known = accountTypes.map((type) => String(type ?? '').toLowerCase()).filter(Boolean);
  if (known.length === 0) return false;
  return !known.some((type) => type === 'income' || type === 'expense');
}

export function bankDocumentHasGstTax(doc: Pick<GstHstBankDocument, 'taxes'>): boolean {
  return (doc.taxes ?? []).some((tax) => isGstHstTax(tax) && (Number(tax.tax_amount ?? 0) !== 0 || Number(tax.taxable_amount ?? 0) !== 0));
}

export function gstHstJournalEntryIsDuplicateDocument(
  lines: GstHstJournalLineSource[],
  countedLinkedSources?: Iterable<string>,
): boolean {
  const counted = new Set(countedLinkedSources);
  for (const line of lines) {
    const type = String(line.sourceDocumentType ?? '').toLowerCase();
    if (DOCUMENT_LINKED_GST_HST_JE_SOURCES.has(type)) return true;
    if (BANKING_LINKED_GST_HST_JE_SOURCES.has(type)) {
      const id = String(line.sourceDocumentId ?? '');
      if (id && counted.has(`${type}:${id}`)) return true;
    }
  }
  return false;
}

export function looksLikeTaxGlAccount(accountName?: string | null, accountType?: string | null): boolean {
  const type = String(accountType ?? '').toLowerCase();
  if (type === 'income' || type === 'expense' || type === 'equity') return false;
  return /gst|hst|pst|qst|vat|sales tax|input tax|tax payable|tax recoverable|tax paid|tax collected/i.test(
    String(accountName ?? ''),
  );
}

export interface GstHstJournalLineSource {
  id: string;
  accountId: string;
  accountType?: string | null;
  accountName?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
  taxCodeId?: string | null;
  sourceDocumentType?: string | null;
  sourceDocumentId?: string | null;
  partyName?: string | null;
}

export interface GstHstJournalEntrySource {
  id: string;
  date: string;
  reference: string;
  description?: string | null;
  status?: string | null;
  journalType?: string | null;
  lines: GstHstJournalLineSource[];
}

export function journalTaxDirection(
  accountId: string,
  debit: number,
  credit: number,
  collectedAccountIds: Set<string>,
  paidAccountIds: Set<string>,
): 'collected' | 'paid' {
  if (paidAccountIds.has(accountId) && !collectedAccountIds.has(accountId)) return 'paid';
  if (collectedAccountIds.has(accountId)) return 'collected';
  return credit >= debit ? 'collected' : 'paid';
}

export function gstHstDocumentFromJournalTaxLine(input: {
  id: string;
  date: string;
  number: string;
  description?: string | null;
  partyName?: string | null;
  debit: number;
  credit: number;
  accountId: string;
  taxCode?: GstHstTaxCodeFlag | null;
  collectedAccountIds: Set<string>;
  paidAccountIds: Set<string>;
}): GstHstBankDocument {
  const direction = journalTaxDirection(
    input.accountId,
    input.debit,
    input.credit,
    input.collectedAccountIds,
    input.paidAccountIds,
  );
  const taxAmount = direction === 'collected'
    ? round2(input.credit - input.debit)
    : round2(input.debit - input.credit);
  const rate = Number(input.taxCode?.rate ?? 0);
  const taxableAmount = rate > 0 ? round2(taxAmount / (rate / 100)) : 0;
  return {
    source: 'journal',
    direction,
    id: input.id,
    date: input.date,
    number: input.number,
    description: input.description ?? input.number,
    partyName: input.partyName ?? '',
    amount: taxAmount,
    subtotal: taxableAmount,
    taxes: [{
      tax_code: input.taxCode?.code ?? null,
      tax_type: input.taxCode?.tax_type ?? null,
      rate,
      taxable_amount: taxableAmount,
      tax_amount: taxAmount,
      is_recoverable: input.taxCode?.is_recoverable !== false,
      authority: null,
    }],
  };
}

function inferTaxTypeFromAccountName(name?: string | null): string {
  if (isProvincialSalesTax({ tax_code: name })) return 'pst';
  return 'hst';
}

function inferCodeFromAccountName(name?: string | null): string {
  const n = String(name ?? '').toUpperCase();
  if (n.includes('QST')) return 'QST';
  if (n.includes('PST')) return 'PST';
  if (n.includes('GST')) return 'GST';
  if (n.includes('HST')) return 'HST';
  return 'GST/HST';
}

function resolveJournalTaxCode(
  line: GstHstJournalLineSource,
  byId: Map<string, GstHstTaxCodeFlag>,
  byCode: Map<string, GstHstTaxCodeFlag>,
  byCollectedAccount: Map<string, GstHstTaxCodeFlag>,
  byPaidAccount: Map<string, GstHstTaxCodeFlag>,
): GstHstTaxCodeFlag | undefined {
  if (line.taxCodeId && byId.has(line.taxCodeId)) return byId.get(line.taxCodeId);
  const hay = `${line.description ?? ''}`.toUpperCase();
  for (const [code, flag] of byCode) {
    if (code && hay.includes(code)) return flag;
  }
  return byCollectedAccount.get(line.accountId) || byPaidAccount.get(line.accountId);
}

/** Convert posted tax JEs into RST documents. Skips invoice/bill JEs, remittances, and bank JEs already counted. */
export function gstHstDocumentsFromJournalEntries(
  entries: GstHstJournalEntrySource[],
  taxCodes: GstHstTaxCodeFlag[] = [],
  extraAccounts?: {
    collectedAccountIds?: Iterable<string>;
    paidAccountIds?: Iterable<string>;
    countedLinkedSources?: Iterable<string>;
  },
): GstHstBankDocument[] {
  const collectedAccountIds = new Set<string>(extraAccounts?.collectedAccountIds);
  const paidAccountIds = new Set<string>(extraAccounts?.paidAccountIds);
  const countedLinkedSources = extraAccounts?.countedLinkedSources;
  const byId = new Map<string, GstHstTaxCodeFlag>();
  const byCode = new Map<string, GstHstTaxCodeFlag>();
  const byCollectedAccount = new Map<string, GstHstTaxCodeFlag>();
  const byPaidAccount = new Map<string, GstHstTaxCodeFlag>();

  for (const code of taxCodes) {
    if (code.id) byId.set(code.id, code);
    if (code.code) byCode.set(code.code.toUpperCase(), code);
    if (code.gl_collected_account_id) {
      collectedAccountIds.add(code.gl_collected_account_id);
      byCollectedAccount.set(code.gl_collected_account_id, code);
    }
    if (code.gl_paid_account_id) {
      paidAccountIds.add(code.gl_paid_account_id);
      byPaidAccount.set(code.gl_paid_account_id, code);
    }
  }

  const documents: GstHstBankDocument[] = [];

  for (const entry of entries) {
    if (entry.status && String(entry.status).toLowerCase() !== 'posted') continue;
    if (isYearEndClosingJournal(entry.reference)) continue;
    if (gstHstJournalEntryIsDuplicateDocument(entry.lines, countedLinkedSources)) continue;
    if (isTaxAuthoritySettlementJournal(entry.lines.map((line) => line.accountType))) continue;

    const partyName = entry.lines.map((line) => line.partyName).find((name) => name && name.trim()) || '';

    for (const line of entry.lines) {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      if (debit === 0 && credit === 0) continue;

      const mapped = collectedAccountIds.has(line.accountId) || paidAccountIds.has(line.accountId);
      const taggedTaxGl = Boolean(line.taxCodeId) && looksLikeTaxGlAccount(line.accountName, line.accountType);
      if (!mapped && !taggedTaxGl) continue;

      const taxCode = resolveJournalTaxCode(line, byId, byCode, byCollectedAccount, byPaidAccount);
      if (taxCode && !isGstHstTax(taxCode) && !isProvincialSalesTax(taxCode)) continue;

      documents.push(gstHstDocumentFromJournalTaxLine({
        id: line.id,
        date: entry.date,
        number: entry.reference,
        description: line.description || entry.description || entry.reference,
        partyName,
        debit,
        credit,
        accountId: line.accountId,
        taxCode: taxCode ?? {
          code: inferCodeFromAccountName(line.accountName),
          tax_type: inferTaxTypeFromAccountName(line.accountName),
          rate: 0,
        },
        collectedAccountIds,
        paidAccountIds,
      }));
    }
  }

  return documents;
}

function flagMap(flags: GstHstTaxCodeFlag[]): Map<string, GstHstTaxCodeFlag> {
  const map = new Map<string, GstHstTaxCodeFlag>();
  for (const flag of flags) {
    if (flag.code) map.set(flag.code.toUpperCase(), flag);
  }
  return map;
}

function lookupFlag(map: Map<string, GstHstTaxCodeFlag>, code?: string | null): GstHstTaxCodeFlag | undefined {
  if (!code) return undefined;
  return map.get(code.toUpperCase());
}

function toPeriodRow(
  source: PeriodTaxRow['source'],
  tax: GstHstDocumentTax,
  flags: GstHstTaxCodeFlag | undefined,
  supply: GstHstSupplyClass,
): PeriodTaxRow {
  return {
    source,
    tax_type: String(tax.tax_type || flags?.tax_type || 'hst').toLowerCase(),
    tax_code: tax.tax_code ?? flags?.code ?? null,
    authority: tax.authority ?? 'CRA',
    jurisdiction_code: null,
    rate: Number(tax.rate ?? flags?.rate ?? 0),
    taxable_amount: Number(tax.taxable_amount ?? 0),
    tax_amount: Number(tax.tax_amount ?? 0),
    is_recoverable: tax.is_recoverable !== false && flags?.is_recoverable !== false,
    is_zero_rated: supply === 'zero_rated',
    is_exempt: supply === 'exempt',
  };
}

function bumpCode(
  map: Map<string, TaxCodePeriodRow>,
  code: string,
  name: string,
  rate: number,
  patch: Partial<Pick<TaxCodePeriodRow, 'taxableAmount' | 'taxCollected' | 'itcClaimed'>>,
) {
  if (!map.has(code)) {
    map.set(code, {
      code,
      name,
      rate,
      taxableAmount: 0,
      taxCollected: 0,
      itcClaimed: 0,
      taxDue: 0,
    });
  }
  const row = map.get(code)!;
  if (patch.taxableAmount) row.taxableAmount += patch.taxableAmount;
  if (patch.taxCollected) row.taxCollected += patch.taxCollected;
  if (patch.itcClaimed) row.itcClaimed += patch.itcClaimed;
}

export function summarizeGstHstDocuments(input: {
  periodStart: string;
  periodEnd: string;
  invoices: GstHstInvoiceDocument[];
  purchases: GstHstPurchaseDocument[];
  bankDocuments?: GstHstBankDocument[];
  taxCodes?: GstHstTaxCodeFlag[];
  journal?: GstHstJournalFallback;
  authority?: string;
}): GstHstPeriodSnapshot {
  const flags = flagMap(input.taxCodes ?? []);
  const invoices = input.invoices.filter((inv) => isIncludedGstHstDocument(inv.status));
  const purchases = input.purchases.filter((doc) => isIncludedGstHstDocument(doc.status));

  let taxableSales = 0;
  let zeroRatedSales = 0;
  let exemptSales = 0;
  let gstHstCollected = 0;
  let gstHstCollectedGross = 0;
  let gstHstCollectedException = 0;
  let itc = 0;
  let itcGross = 0;
  let itcException = 0;
  let totalPurchases = 0;
  let invoiceGstTaxPosted = 0;
  let purchaseGstTaxPosted = 0;

  const supportRows: GstHstSupportRow[] = [];
  const rows: PeriodTaxRow[] = [];
  const codeMap = new Map<string, TaxCodePeriodRow>();
  const agencyMap = new Map<string, RstAgencyTotals>();

  for (const inv of invoices) {
    const gstRows = (inv.taxes ?? []).filter((tax) => isGstHstTax(tax));
    const pstRows = (inv.taxes ?? []).filter((tax) => isProvincialSalesTax(tax));
    const subtotal = Number(inv.subtotal ?? 0);
    const headerGst = Number(inv.gst_hst_amount ?? 0) || Number(inv.tax_amount ?? 0);
    const description = inv.description || inv.number || 'Invoice';
    const partyName = inv.partyName || '';

    for (const tax of pstRows) {
      bumpRstAgency(agencyMap, tax, 'collected', Number(tax.tax_amount ?? 0));
    }

    if (gstRows.length > 0) {
      for (const tax of gstRows) {
        const flag = lookupFlag(flags, tax.tax_code);
        const supply = classifyGstHstSupply(tax, flag, inv.is_gst_hst_exempt);
        const taxable = Number(tax.taxable_amount ?? 0);
        const taxAmount = Number(tax.tax_amount ?? 0);
        const code = tax.tax_code || flag?.code || 'GST/HST';
        const taxRate = Number(tax.rate ?? flag?.rate ?? 0);
        rows.push(toPeriodRow('invoice', tax, flag, supply));
        invoiceGstTaxPosted += taxAmount;

        if (supply === 'exempt') {
          exemptSales += taxable || subtotal;
          addSupport(supportRows, {
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description,
            name: partyName,
            taxCode: code,
            taxRate,
            supplyClass: 'exempt',
            craLine: '91',
            taxableAmount: taxable || subtotal,
            taxAmount: 0,
          });
          bumpCode(codeMap, code, flag?.name || code, taxRate, {
            taxableAmount: taxable || subtotal,
          });
          continue;
        }

        if (supply === 'zero_rated') {
          zeroRatedSales += taxable || subtotal;
          addSupport(supportRows, {
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description,
            name: partyName,
            taxCode: code,
            taxRate: 0,
            supplyClass: 'zero_rated',
            craLine: '90B',
            taxableAmount: taxable || subtotal,
            taxAmount: 0,
          });
          bumpCode(codeMap, code, flag?.name || code, 0, { taxableAmount: taxable || subtotal });
          continue;
        }

        taxableSales += taxable;
        gstHstCollected += taxAmount;
        const collectedSplit = splitSignedTax(taxAmount);
        gstHstCollectedGross += collectedSplit.gross;
        gstHstCollectedException += collectedSplit.exception;
        bumpRstAgency(agencyMap, { tax_type: tax.tax_type || 'hst', tax_code: code, authority: tax.authority || 'CRA' }, 'collected', taxAmount);
        addSupport(supportRows, {
          date: inv.date,
          type: 'Invoice',
          number: inv.number,
          description,
          name: partyName,
          taxCode: code,
          taxRate,
          supplyClass: 'taxable',
          craLine: '90A / 103',
          taxableAmount: taxable,
          taxAmount,
        });
        bumpCode(codeMap, code, flag?.name || code, taxRate, {
          taxableAmount: taxable,
          taxCollected: taxAmount,
        });
      }
      continue;
    }

    const lines = (inv.lines ?? []).filter((line) => Number(line.amount ?? 0) !== 0 || Number(line.tax_amount ?? 0) !== 0);
    if (lines.length > 0) {
      for (const line of lines) {
        const amount = Number(line.amount ?? 0);
        const lineTax = Number(line.tax_amount ?? 0);
        const rate = Number(line.tax_rate ?? 0);
        if (inv.is_gst_hst_exempt) {
          exemptSales += amount;
          addSupport(supportRows, {
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description: line.description || description,
            name: partyName,
            taxCode: 'EXEMPT',
            taxRate: 0,
            supplyClass: 'exempt',
            craLine: '91',
            taxableAmount: amount,
            taxAmount: 0,
          });
          continue;
        }
        if (rate === 0 && lineTax === 0) {
          zeroRatedSales += amount;
          addSupport(supportRows, {
            date: inv.date,
            type: 'Invoice',
            number: inv.number,
            description: line.description || description,
            name: partyName,
            taxCode: 'GST-ZR',
            taxRate: 0,
            supplyClass: 'zero_rated',
            craLine: '90B',
            taxableAmount: amount,
            taxAmount: 0,
          });
          continue;
        }
        taxableSales += amount;
        gstHstCollected += lineTax;
        invoiceGstTaxPosted += lineTax;
        const collectedSplit = splitSignedTax(lineTax);
        gstHstCollectedGross += collectedSplit.gross;
        gstHstCollectedException += collectedSplit.exception;
        bumpRstAgency(agencyMap, { tax_type: 'hst', tax_code: 'GST/HST', authority: 'CRA' }, 'collected', lineTax);
        addSupport(supportRows, {
          date: inv.date,
          type: 'Invoice',
          number: inv.number,
          description: line.description || description,
          name: partyName,
          taxCode: 'GST/HST',
          taxRate: rate,
          supplyClass: 'taxable',
          craLine: '90A / 103',
          taxableAmount: amount,
          taxAmount: lineTax,
        });
      }
      continue;
    }

    if (inv.is_gst_hst_exempt) {
      exemptSales += subtotal;
      addSupport(supportRows, {
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        name: partyName,
        taxCode: 'EXEMPT',
        taxRate: 0,
        supplyClass: 'exempt',
        craLine: '91',
        taxableAmount: subtotal,
        taxAmount: 0,
      });
      continue;
    }

    if (headerGst > 0) {
      taxableSales += subtotal;
      gstHstCollected += headerGst;
      invoiceGstTaxPosted += headerGst;
      const collectedSplit = splitSignedTax(headerGst);
      gstHstCollectedGross += collectedSplit.gross;
      gstHstCollectedException += collectedSplit.exception;
      bumpRstAgency(agencyMap, { tax_type: 'hst', tax_code: 'GST/HST', authority: 'CRA' }, 'collected', headerGst);
      addSupport(supportRows, {
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        name: partyName,
        taxCode: 'GST/HST',
        taxRate: subtotal > 0 ? round2((headerGst / subtotal) * 100) : 0,
        supplyClass: 'taxable',
        craLine: '90A / 103',
        taxableAmount: subtotal,
        taxAmount: headerGst,
      });
      rows.push({
        source: 'invoice',
        tax_type: 'hst',
        tax_code: 'GST/HST',
        authority: 'CRA',
        jurisdiction_code: null,
        rate: subtotal > 0 ? round2((headerGst / subtotal) * 100) : 0,
        taxable_amount: subtotal,
        tax_amount: headerGst,
        is_recoverable: true,
        is_zero_rated: false,
        is_exempt: false,
      });
      bumpCode(codeMap, 'GST/HST', 'GST/HST', subtotal > 0 ? round2((headerGst / subtotal) * 100) : 0, {
        taxableAmount: subtotal,
        taxCollected: headerGst,
      });
      continue;
    }

    if (subtotal > 0 && Number(inv.tax_amount ?? 0) === 0) {
      exemptSales += subtotal;
      addSupport(supportRows, {
        date: inv.date,
        type: 'Invoice',
        number: inv.number,
        description,
        name: partyName,
        taxCode: 'OTHER',
        taxRate: 0,
        supplyClass: 'exempt',
        craLine: '91',
        taxableAmount: subtotal,
        taxAmount: 0,
      });
    }
  }

  for (const doc of purchases) {
    const gstRows = (doc.taxes ?? []).filter((tax) => isGstHstTax(tax));
    const pstRows = (doc.taxes ?? []).filter((tax) => isProvincialSalesTax(tax));
    const type = doc.source === 'expense' ? 'Expense' : 'Bill';
    const description = doc.description || doc.number || type;
    const partyName = doc.partyName || '';

    for (const tax of pstRows) {
      bumpRstAgency(agencyMap, tax, 'paid', Number(tax.tax_amount ?? 0));
    }

    for (const tax of gstRows) {
      const flag = lookupFlag(flags, tax.tax_code);
      const taxable = Number(tax.taxable_amount ?? 0);
      const taxAmount = Number(tax.tax_amount ?? 0);
      const recoverable = tax.is_recoverable !== false && flag?.is_recoverable !== false;
      const code = tax.tax_code || flag?.code || 'GST/HST';
      const taxRate = Number(tax.rate ?? flag?.rate ?? 0);
      purchaseGstTaxPosted += taxAmount;
      totalPurchases += taxable;
      rows.push(toPeriodRow(doc.source, tax, flag, 'taxable'));

      if (recoverable) {
        itc += taxAmount;
        const itcSplit = splitSignedTax(taxAmount);
        itcGross += itcSplit.gross;
        itcException += itcSplit.exception;
        bumpRstAgency(agencyMap, { tax_type: tax.tax_type || 'hst', tax_code: code, authority: tax.authority || 'CRA' }, 'paid', taxAmount);
        addSupport(supportRows, {
          date: doc.date,
          type,
          number: doc.number,
          description,
          name: partyName,
          taxCode: code,
          taxRate,
          supplyClass: 'itc',
          craLine: '106',
          taxableAmount: taxable,
          taxAmount,
        });
        bumpCode(codeMap, code, flag?.name || code, taxRate, {
          itcClaimed: taxAmount,
        });
      } else {
        addSupport(supportRows, {
          date: doc.date,
          type,
          number: doc.number,
          description,
          name: partyName,
          taxCode: code,
          taxRate,
          supplyClass: 'non_recoverable',
          craLine: '—',
          taxableAmount: taxable,
          taxAmount,
        });
      }
    }
  }

  const bankDocuments = (input.bankDocuments ?? []).filter(
    (doc) => !doc.matchedInvoiceId && !doc.matchedBillId,
  );

  for (const doc of bankDocuments) {
    const gstRows = (doc.taxes ?? []).filter((tax) => isGstHstTax(tax));
    const pstRows = (doc.taxes ?? []).filter((tax) => isProvincialSalesTax(tax));
    const type = doc.source === 'journal' ? 'Journal' : doc.source === 'credit_card' ? 'Credit card' : 'Bank';
    const description = doc.description || doc.number || type;
    const partyName = doc.partyName || doc.description || '';
    const source = doc.direction === 'collected' ? 'invoice' : 'bill';

    for (const tax of pstRows) {
      bumpRstAgency(agencyMap, tax, doc.direction === 'collected' ? 'collected' : 'paid', Number(tax.tax_amount ?? 0));
    }

    for (const tax of gstRows) {
      const flag = lookupFlag(flags, tax.tax_code);
      const supply = classifyGstHstSupply(tax, flag, false);
      const taxable = Number(tax.taxable_amount ?? doc.subtotal ?? 0);
      const taxAmount = Number(tax.tax_amount ?? 0);
      const code = tax.tax_code || flag?.code || 'GST/HST';
      const taxRate = Number(tax.rate ?? flag?.rate ?? 0);
      rows.push(toPeriodRow(source, tax, flag, supply));

      if (doc.direction === 'collected') {
        invoiceGstTaxPosted += taxAmount;
        if (supply === 'exempt') {
          exemptSales += taxable;
          addSupport(supportRows, {
            date: doc.date, type, number: doc.number, description, name: partyName, taxCode: code, taxRate,
            supplyClass: 'exempt', craLine: '91', taxableAmount: taxable, taxAmount: 0,
          });
        } else if (supply === 'zero_rated') {
          zeroRatedSales += taxable;
          addSupport(supportRows, {
            date: doc.date, type, number: doc.number, description, name: partyName, taxCode: code, taxRate: 0,
            supplyClass: 'zero_rated', craLine: '90B', taxableAmount: taxable, taxAmount: 0,
          });
        } else {
          taxableSales += taxable;
          gstHstCollected += taxAmount;
          const collectedSplit = splitSignedTax(taxAmount);
          gstHstCollectedGross += collectedSplit.gross;
          gstHstCollectedException += collectedSplit.exception;
          bumpRstAgency(agencyMap, { tax_type: tax.tax_type || 'hst', tax_code: code, authority: tax.authority || 'CRA' }, 'collected', taxAmount);
          addSupport(supportRows, {
            date: doc.date, type, number: doc.number, description, name: partyName, taxCode: code, taxRate,
            supplyClass: 'taxable', craLine: '90A / 103', taxableAmount: taxable, taxAmount,
          });
          bumpCode(codeMap, code, flag?.name || code, taxRate, {
            taxableAmount: taxable,
            taxCollected: taxAmount,
          });
        }
      } else {
        purchaseGstTaxPosted += taxAmount;
        totalPurchases += taxable;
        const recoverable = tax.is_recoverable !== false && flag?.is_recoverable !== false;
        if (recoverable) {
          itc += taxAmount;
          const itcSplit = splitSignedTax(taxAmount);
          itcGross += itcSplit.gross;
          itcException += itcSplit.exception;
          bumpRstAgency(agencyMap, { tax_type: tax.tax_type || 'hst', tax_code: code, authority: tax.authority || 'CRA' }, 'paid', taxAmount);
          addSupport(supportRows, {
            date: doc.date, type, number: doc.number, description, name: partyName, taxCode: code, taxRate,
            supplyClass: 'itc', craLine: '106', taxableAmount: taxable, taxAmount,
          });
          bumpCode(codeMap, code, flag?.name || code, taxRate, {
            itcClaimed: taxAmount,
          });
        } else {
          addSupport(supportRows, {
            date: doc.date, type, number: doc.number, description, name: partyName, taxCode: code, taxRate,
            supplyClass: 'non_recoverable', craLine: '—', taxableAmount: taxable, taxAmount,
          });
        }
      }
    }
  }

  const journal = input.journal;
  const usedDocumentCollected = invoiceGstTaxPosted !== 0 || gstHstCollected !== 0;
  const usedDocumentItc = purchaseGstTaxPosted !== 0 || itc !== 0;
  const hasSourceDocuments = invoices.length > 0 || purchases.length > 0 || bankDocuments.length > 0;

  if (journal) {
    if (!usedDocumentCollected) {
      gstHstCollected = journal.taxCollected;
      gstHstCollectedGross = journal.taxCollected >= 0 ? journal.taxCollected : 0;
      gstHstCollectedException = journal.taxCollected < 0 ? journal.taxCollected : 0;
      bumpRstAgency(agencyMap, { tax_type: 'hst', tax_code: 'GST/HST', authority: 'CRA' }, 'collected', journal.taxCollected);
      if (taxableSales === 0 && journal.taxableSales) taxableSales = journal.taxableSales;
    }
    if (!usedDocumentItc && !hasSourceDocuments) {
      itc = journal.itcClaimed;
      itcGross = journal.itcClaimed >= 0 ? journal.itcClaimed : 0;
      itcException = journal.itcClaimed < 0 ? journal.itcClaimed : 0;
      bumpRstAgency(agencyMap, { tax_type: 'hst', tax_code: 'GST/HST', authority: 'CRA' }, 'paid', journal.itcClaimed);
    }
    if (journal.rows?.length && (!usedDocumentCollected || (!usedDocumentItc && !hasSourceDocuments))) {
      for (const row of journal.rows) {
        if (usedDocumentCollected && row.source === 'invoice') continue;
        if (usedDocumentItc && row.source !== 'invoice') continue;
        if (!rows.some((existing) => existing.tax_code === row.tax_code && existing.source === row.source && existing.tax_amount === row.tax_amount)) {
          rows.push(row);
        }
      }
    }
  }

  for (const code of input.taxCodes ?? []) {
    if (isProvincialSalesTax(code)) {
      bumpRstAgency(agencyMap, {
        tax_type: code.tax_type,
        tax_code: code.code,
        authority: undefined,
      }, 'collected', 0);
    }
  }

  taxableSales = round2(taxableSales);
  zeroRatedSales = round2(zeroRatedSales);
  exemptSales = round2(exemptSales);
  gstHstCollected = round2(gstHstCollected);
  gstHstCollectedGross = round2(gstHstCollectedGross);
  gstHstCollectedException = round2(gstHstCollectedException);
  itc = round2(itc);
  itcGross = round2(itcGross);
  itcException = round2(itcException);
  const line90 = round2(taxableSales + zeroRatedSales);
  const line91 = exemptSales;
  const line101 = round2(line90 + line91);
  const netTax = round2(gstHstCollected - itc);
  const exemptZeroRatedSales = round2(zeroRatedSales + exemptSales);
  const agencies = finalizeRstAgencies(agencyMap);

  const byTaxCode = Array.from(codeMap.values())
    .map((row) => ({
      ...row,
      taxableAmount: round2(row.taxableAmount),
      taxCollected: round2(row.taxCollected),
      itcClaimed: round2(row.itcClaimed),
      taxDue: round2(row.taxCollected - row.itcClaimed),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  supportRows.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  const totals: PeriodTotals = {
    rows,
    totalSales: line101,
    totalPurchases: round2(totalPurchases),
    taxableSales,
    zeroRatedSales,
    exemptSales,
  };

  const form = buildGstHstReturn(totals, {
    authority: input.authority ?? 'CRA',
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: 'CAD',
  });

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    taxableSales,
    zeroRatedSales,
    exemptSales,
    exemptZeroRatedSales,
    line90,
    line91,
    line101,
    gstHstCollected,
    gstHstCollectedGross,
    gstHstCollectedException,
    itc,
    itcGross,
    itcException,
    netTax,
    agencies,
    invoiceCount: invoices.length,
    purchaseCount: purchases.length,
    usedDocumentCollected,
    usedDocumentItc,
    supportRows,
    rows,
    totals,
    byTaxCode,
    form,
  };
}

export function emptyGstHstSnapshot(periodStart: string, periodEnd: string, authority = 'CRA'): GstHstPeriodSnapshot {
  return summarizeGstHstDocuments({
    periodStart,
    periodEnd,
    invoices: [],
    purchases: [],
    authority,
  });
}

export function groupGstHstSupportByLine(rows: GstHstSupportRow[]): { line: string; label: string; rows: GstHstSupportRow[]; taxableAmount: number; taxAmount: number }[] {
  const order = ['90A / 103', '90B', '91', '106', '—'];
  const labels: Record<string, string> = {
    '90A / 103': 'Taxable sales and GST/HST collected',
    '90B': 'Zero-rated sales',
    '91': 'Exempt / other revenue',
    '106': 'Input tax credits (ITCs)',
    '—': 'Non-recoverable GST/HST',
  };
  const map = new Map<string, GstHstSupportRow[]>();
  for (const row of rows) {
    if (!map.has(row.craLine)) map.set(row.craLine, []);
    map.get(row.craLine)!.push(row);
  }
  const extra = Array.from(map.keys()).filter((line) => !order.includes(line)).sort();
  return [...order, ...extra]
    .filter((line) => map.has(line))
    .map((line) => {
      const groupRows = map.get(line)!;
      return {
        line,
        label: labels[line] || line,
        rows: groupRows,
        taxableAmount: round2(groupRows.reduce((s, r) => s + r.taxableAmount, 0)),
        taxAmount: round2(groupRows.reduce((s, r) => s + r.taxAmount, 0)),
      };
    });
}
