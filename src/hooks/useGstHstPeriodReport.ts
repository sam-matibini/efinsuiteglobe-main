import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  bankDocumentHasGstTax,
  coalesceGstHstJournal,
  emptyGstHstSnapshot,
  gstHstDocumentsFromJournalEntries,
  gstHstJournalFallbackFromEntries,
  isBankCollectedSide,
  summarizeGstHstDocuments,
  taxesFromBankingPosting,
  type GstHstBankDocument,
  type GstHstDocumentTax,
  type GstHstInvoiceDocument,
  type GstHstJournalEntrySource,
  type GstHstJournalFallback,
  type GstHstPurchaseDocument,
  type GstHstTaxCodeFlag,
} from '@/lib/gstHstPeriodEngine';
import { classifyTaxAccountName, summarizeTaxMovements, toISODate, type TaxComparisonRange, type TaxMovementRow } from '@/lib/taxPeriodReport';
import { fetchPeriodMovements } from '@/hooks/useTaxPeriodActivity';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const ID_CHUNK = 200;

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

async function pageQuery<T>(
  run: (from: number, to: number) => PromiseLike<QueryResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchByIds<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<QueryResult<T>>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await run(chunk);
    if (error) throw error;
    if (data?.length) rows.push(...data);
  }
  return rows;
}

interface StoredTaxRow extends GstHstDocumentTax {
  parentId: string;
}

function groupTaxes(rows: StoredTaxRow[]): Map<string, GstHstDocumentTax[]> {
  const map = new Map<string, GstHstDocumentTax[]>();
  for (const row of rows) {
    const tax: GstHstDocumentTax = {
      tax_code: row.tax_code,
      tax_type: row.tax_type,
      rate: row.rate,
      taxable_amount: row.taxable_amount,
      tax_amount: row.tax_amount,
      is_recoverable: row.is_recoverable,
      authority: row.authority,
    };
    if (!map.has(row.parentId)) map.set(row.parentId, []);
    map.get(row.parentId)!.push(tax);
  }
  return map;
}

function nestedName(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) return String((value[0] as { name?: string } | undefined)?.name ?? '');
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return String((value as { name?: string }).name ?? '');
  }
  return '';
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function toTax(row: Record<string, unknown>, parentKey: string): StoredTaxRow {
  return {
    parentId: String(row[parentKey] ?? ''),
    tax_code: (row.tax_code as string | null) ?? null,
    tax_type: (row.tax_type as string | null) ?? null,
    rate: Number(row.rate ?? 0),
    taxable_amount: Number(row.taxable_amount ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    is_recoverable: (row.is_recoverable as boolean | null) ?? null,
    authority: (row.authority as string | null) ?? null,
  };
}

function journalPartyName(row: Record<string, unknown>): string {
  return nestedName(row.customers) || nestedName(row.vendors) || '';
}

function toJournalLineSource(row: Record<string, unknown>): GstHstJournalEntrySource['lines'][number] {
  const account = nestedRecord(row.account) ?? nestedRecord(row.accounts);
  return {
    id: String(row.id),
    accountId: String(row.account_id ?? ''),
    accountType: account?.account_type ? String(account.account_type) : null,
    accountName: account?.name ? String(account.name) : null,
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
    description: row.description ? String(row.description) : null,
    taxCodeId: row.tax_code_id ? String(row.tax_code_id) : null,
    sourceDocumentType: row.source_document_type ? String(row.source_document_type) : null,
    sourceDocumentId: row.source_document_id ? String(row.source_document_id) : null,
    partyName: journalPartyName(row),
  };
}

export async function fetchStandaloneGstHstJournalDocuments(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
  taxCodes: GstHstTaxCodeFlag[],
  countedLinkedSources: Iterable<string> = [],
): Promise<{ documents: GstHstBankDocument[]; journal: GstHstJournalFallback }> {
  const mappedGlIds = [
    ...new Set(
      taxCodes.flatMap((code) => [code.gl_collected_account_id, code.gl_paid_account_id]).filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: namedAccounts, error: namedError } = await supabase
    .from('accounts')
    .select('id, name, account_type')
    .eq('organization_id', organizationId)
    .or('name.ilike.%gst%,name.ilike.%hst%,name.ilike.%pst%,name.ilike.%qst%,name.ilike.%vat%,name.ilike.%sales tax%,name.ilike.%input tax%');
  if (namedError) throw namedError;

  const extraCollected: string[] = [];
  const extraPaid: string[] = [];
  for (const account of namedAccounts ?? []) {
    const id = String(account.id);
    const side = classifyTaxAccountName(String(account.name ?? ''))
      || (/(input|itc|recover|paid)/i.test(String(account.name ?? '')) && !/payable/i.test(String(account.name ?? ''))
        ? 'paid'
        : 'collected');
    if (side === 'paid') extraPaid.push(id);
    else extraCollected.push(id);
  }

  const taxGlIds = [...new Set([...mappedGlIds, ...extraCollected, ...extraPaid])];

  const candidateRows = await pageQuery<Record<string, unknown>>((from, to) => {
    let query = supabase
      .from('journal_entry_lines')
      .select(`
        id,
        journal_entry_id,
        journal_entries!inner(id, organization_id, entry_date, reference, description, status, journal_type)
      `)
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'posted')
      .gte('journal_entries.entry_date', periodStart)
      .lte('journal_entries.entry_date', periodEnd)
      .range(from, to);
    if (taxGlIds.length > 0) {
      query = query.or(`tax_code_id.not.is.null,account_id.in.(${taxGlIds.join(',')})`);
    } else {
      query = query.not('tax_code_id', 'is', null);
    }
    return query;
  });

  const entryIds = [...new Set(candidateRows.map((row) => String(row.journal_entry_id ?? '')).filter(Boolean))];
  if (entryIds.length === 0) return [];

  const headerById = new Map<string, Record<string, unknown>>();
  for (const row of candidateRows) {
    const id = String(row.journal_entry_id ?? '');
    const header = nestedRecord(row.journal_entries);
    if (id && header && !headerById.has(id)) headerById.set(id, header);
  }

  const allLines = await fetchByIds<Record<string, unknown>>(entryIds, (chunk) =>
    supabase
      .from('journal_entry_lines')
      .select(`
        id, journal_entry_id, account_id, debit, credit, description, tax_code_id,
        source_document_type, source_document_id, customer_id, vendor_id,
        account:accounts(id, name, account_type),
        customers(name), vendors(name)
      `)
      .in('journal_entry_id', chunk),
  );

  const linesByEntry = new Map<string, Record<string, unknown>[]>();
  for (const row of allLines) {
    const id = String(row.journal_entry_id ?? '');
    if (!linesByEntry.has(id)) linesByEntry.set(id, []);
    linesByEntry.get(id)!.push(row);
  }

  const entries: GstHstJournalEntrySource[] = entryIds.map((id) => {
    const header = headerById.get(id) ?? {};
    return {
      id,
      date: String(header.entry_date ?? ''),
      reference: String(header.reference ?? id),
      description: header.description ? String(header.description) : null,
      status: header.status ? String(header.status) : 'posted',
      journalType: header.journal_type ? String(header.journal_type) : null,
      lines: (linesByEntry.get(id) ?? []).map(toJournalLineSource),
    };
  });

  return {
    documents: gstHstDocumentsFromJournalEntries(entries, taxCodes, {
      collectedAccountIds: extraCollected,
      paidAccountIds: extraPaid,
      countedLinkedSources,
    }),
    journal: gstHstJournalFallbackFromEntries(entries, taxCodes, {
      collectedAccountIds: extraCollected,
      paidAccountIds: extraPaid,
    }),
  };
}

export async function fetchGstHstPeriodDocuments(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{
  invoices: GstHstInvoiceDocument[];
  purchases: GstHstPurchaseDocument[];
  bankDocuments: GstHstBankDocument[];
  taxCodes: GstHstTaxCodeFlag[];
  journal: GstHstJournalFallback;
}> {
  const [invoiceRows, billRows, expenseRows, taxCodeRows, bankRows, cardRows, movements] = await Promise.all([
    pageQuery<Record<string, unknown>>((from, to) =>
      supabase
        .from('invoices')
        .select('id, invoice_date, invoice_number, status, subtotal, tax_amount, gst_hst_amount, is_gst_hst_exempt, subject, notes, customer_id, customers(name)')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .gte('invoice_date', periodStart)
        .lte('invoice_date', periodEnd)
        .range(from, to),
    ),
    pageQuery<Record<string, unknown>>((from, to) =>
      supabase
        .from('bills')
        .select('id, bill_date, bill_number, status, subtotal, tax_amount, notes, vendor_id, vendors(name)')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .gte('bill_date', periodStart)
        .lte('bill_date', periodEnd)
        .range(from, to),
    ),
    pageQuery<Record<string, unknown>>((from, to) =>
      supabase
        .from('expenses')
        .select('id, expense_date, reference, notes, approval_status, is_posted, amount, tax_amount, tax_code_id, vendor_id, vendors(name)')
        .eq('organization_id', organizationId)
        .gte('expense_date', periodStart)
        .lte('expense_date', periodEnd)
        .range(from, to),
    ),
    (async () => {
      const { data, error } = await supabase
        .from('tax_codes')
        .select('id, code, name, tax_type, rate, is_zero_rated, is_exempt, is_recoverable, gl_collected_account_id, gl_paid_account_id')
        .eq('organization_id', organizationId);
      if (error) throw error;
      return data ?? [];
    })(),
    pageQuery<Record<string, unknown>>((from, to) =>
      supabase
        .from('bank_transactions')
        .select('id, transaction_date, description, reference, payee_payor, amount, subtotal_amount, tax_amount, tax_code_id, tax_breakdown, transaction_type, journal_entry_id, matched_invoice_id, matched_bill_id, bank_accounts!inner(organization_id)')
        .eq('bank_accounts.organization_id', organizationId)
        .not('journal_entry_id', 'is', null)
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .range(from, to),
    ),
    pageQuery<Record<string, unknown>>((from, to) =>
      supabase
        .from('credit_card_transactions')
        .select('id, transaction_date, description, reference, payee_payor, amount, subtotal_amount, tax_amount, tax_code_id, tax_breakdown, transaction_type, journal_entry_id, credit_cards!inner(organization_id)')
        .eq('credit_cards.organization_id', organizationId)
        .not('journal_entry_id', 'is', null)
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .range(from, to),
    ),
    (async () => {
      try {
        return await fetchPeriodMovements(organizationId, periodStart, periodEnd);
      } catch {
        return { movements: [] as TaxMovementRow[], revenue: 0 };
      }
    })(),
  ]);

  const invoiceIds = invoiceRows.map((row) => String(row.id));
  const billIds = billRows.map((row) => String(row.id));
  const expenseIds = expenseRows.map((row) => String(row.id));

  const [invoiceTaxRows, billTaxRows, expenseTaxRows, invoiceLineRows] = await Promise.all([
    fetchByIds<Record<string, unknown>>(invoiceIds, (chunk) =>
      supabase
        .from('invoice_taxes')
        .select('invoice_id, tax_code, tax_type, rate, taxable_amount, tax_amount, is_recoverable, authority')
        .in('invoice_id', chunk),
    ),
    fetchByIds<Record<string, unknown>>(billIds, (chunk) =>
      supabase
        .from('bill_taxes')
        .select('bill_id, tax_code, tax_type, rate, taxable_amount, tax_amount, is_recoverable, authority')
        .in('bill_id', chunk),
    ),
    fetchByIds<Record<string, unknown>>(expenseIds, (chunk) =>
      supabase
        .from('expense_taxes')
        .select('expense_id, tax_code, tax_type, rate, taxable_amount, tax_amount, is_recoverable, authority')
        .in('expense_id', chunk),
    ),
    fetchByIds<Record<string, unknown>>(invoiceIds, (chunk) =>
      supabase
        .from('invoice_lines')
        .select('invoice_id, amount, tax_amount, tax_rate, description')
        .in('invoice_id', chunk),
    ),
  ]);

  const invoiceTaxes = groupTaxes(invoiceTaxRows.map((row) => toTax(row, 'invoice_id')));
  const billTaxes = groupTaxes(billTaxRows.map((row) => toTax(row, 'bill_id')));
  const expenseTaxes = groupTaxes(expenseTaxRows.map((row) => toTax(row, 'expense_id')));
  const invoiceLines = new Map<string, { amount: number; tax_amount: number; tax_rate: number; description: string }[]>();
  for (const row of invoiceLineRows) {
    const id = String(row.invoice_id ?? '');
    if (!invoiceLines.has(id)) invoiceLines.set(id, []);
    invoiceLines.get(id)!.push({
      amount: Number(row.amount ?? 0),
      tax_amount: Number(row.tax_amount ?? 0),
      tax_rate: Number(row.tax_rate ?? 0),
      description: String(row.description ?? ''),
    });
  }

  const taxCodes: GstHstTaxCodeFlag[] = taxCodeRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    tax_type: row.tax_type,
    rate: row.rate,
    is_zero_rated: row.is_zero_rated,
    is_exempt: row.is_exempt,
    is_recoverable: row.is_recoverable,
    gl_collected_account_id: (row as { gl_collected_account_id?: string | null }).gl_collected_account_id ?? null,
    gl_paid_account_id: (row as { gl_paid_account_id?: string | null }).gl_paid_account_id ?? null,
  }));
  const taxCodeById = new Map(taxCodeRows.map((row) => [String((row as { id?: string }).id ?? ''), row]));

  const invoices: GstHstInvoiceDocument[] = invoiceRows.map((row) => ({
    id: String(row.id),
    date: String(row.invoice_date ?? ''),
    number: String(row.invoice_number ?? ''),
    description: String(row.subject || row.notes || row.invoice_number || ''),
    partyName: nestedName(row.customers),
    status: String(row.status ?? ''),
    subtotal: Number(row.subtotal ?? 0),
    tax_amount: Number(row.tax_amount ?? 0),
    gst_hst_amount: Number(row.gst_hst_amount ?? 0),
    is_gst_hst_exempt: Boolean(row.is_gst_hst_exempt),
    taxes: invoiceTaxes.get(String(row.id)) ?? [],
    lines: invoiceLines.get(String(row.id)) ?? [],
  }));

  const purchases: GstHstPurchaseDocument[] = [
    ...billRows.map((row) => ({
      source: 'bill' as const,
      id: String(row.id),
      date: String(row.bill_date ?? ''),
      number: String(row.bill_number ?? ''),
      description: String(row.notes || row.bill_number || ''),
      partyName: nestedName(row.vendors),
      status: String(row.status ?? ''),
      subtotal: Number(row.subtotal ?? 0),
      tax_amount: Number(row.tax_amount ?? 0),
      taxes: billTaxes.get(String(row.id)) ?? [],
    })),
    ...expenseRows.map((row) => {
      const id = String(row.id);
      let taxes = expenseTaxes.get(id) ?? [];
      if (taxes.length === 0 && row.tax_code_id) {
        const code = taxCodeById.get(String(row.tax_code_id));
        if (code) {
          const taxAmount = Number(row.tax_amount ?? 0);
          const amount = Number(row.amount ?? 0);
          taxes = [{
            tax_code: code.code,
            tax_type: code.tax_type,
            rate: code.rate,
            taxable_amount: amount - taxAmount,
            tax_amount: taxAmount,
            is_recoverable: code.is_recoverable !== false,
          }];
        }
      }
      return {
        source: 'expense' as const,
        id,
        date: String(row.expense_date ?? ''),
        number: String(row.reference || id),
        description: String(row.notes || row.reference || ''),
        partyName: nestedName(row.vendors),
        status: row.is_posted ? 'posted' : String(row.approval_status ?? ''),
        subtotal: Number(row.amount ?? 0) - Number(row.tax_amount ?? 0),
        tax_amount: Number(row.tax_amount ?? 0),
        taxes,
      };
    }),
  ];

  const taxCodeByCode = new Map(taxCodes.map((code) => [code.code.toUpperCase(), code]));
  const toBankDoc = (
    row: Record<string, unknown>,
    source: 'bank' | 'credit_card',
  ): GstHstBankDocument => {
    const code = row.tax_code_id ? taxCodeById.get(String(row.tax_code_id)) : undefined;
    const flag: GstHstTaxCodeFlag | undefined = code
      ? {
          code: code.code,
          name: code.name,
          tax_type: code.tax_type,
          rate: code.rate,
          is_zero_rated: code.is_zero_rated,
          is_exempt: code.is_exempt,
          is_recoverable: code.is_recoverable,
        }
      : undefined;
    const taxes = taxesFromBankingPosting({
      taxCode: flag,
      taxAmount: Number(row.tax_amount ?? 0),
      subtotal: Number(row.subtotal_amount ?? 0) || undefined,
      amount: Number(row.amount ?? 0),
      taxBreakdown: Array.isArray(row.tax_breakdown) ? row.tax_breakdown as Array<{ code?: string; rate?: number; amount?: number }> : null,
    }).map((tax) => {
      const byCode = tax.tax_code ? taxCodeByCode.get(String(tax.tax_code).toUpperCase()) : undefined;
      return {
        ...tax,
        tax_type: tax.tax_type || byCode?.tax_type || flag?.tax_type,
        is_recoverable: tax.is_recoverable ?? byCode?.is_recoverable ?? flag?.is_recoverable,
      };
    });
    return {
      source,
      direction: isBankCollectedSide(String(row.transaction_type ?? '')) ? 'collected' : 'paid',
      id: String(row.id),
      date: String(row.transaction_date ?? ''),
      number: String(row.reference || row.id),
      description: String(row.description || row.payee_payor || ''),
      partyName: String(row.payee_payor || row.description || ''),
      amount: Number(row.amount ?? 0),
      subtotal: Number(row.subtotal_amount ?? 0),
      matchedInvoiceId: row.matched_invoice_id ? String(row.matched_invoice_id) : null,
      matchedBillId: row.matched_bill_id ? String(row.matched_bill_id) : null,
      taxes,
    };
  };

  const bankingDocuments: GstHstBankDocument[] = [
    ...bankRows.map((row) => toBankDoc(row, 'bank')),
    ...cardRows.map((row) => toBankDoc(row, 'credit_card')),
  ];
  const countedLinkedSources = bankingDocuments
    .filter(bankDocumentHasGstTax)
    .map((doc) => `${doc.source === 'credit_card' ? 'credit_card_transaction' : 'bank_transaction'}:${doc.id}`);
  const standalone = await fetchStandaloneGstHstJournalDocuments(
    organizationId,
    periodStart,
    periodEnd,
    taxCodes,
    countedLinkedSources,
  );
  const bankDocuments: GstHstBankDocument[] = [
    ...bankingDocuments,
    ...standalone.documents,
  ];
  const movementSummary = summarizeTaxMovements(movements.movements, 'gst', movements.revenue);
  const journal = coalesceGstHstJournal(standalone.journal, {
    taxCollected: movementSummary.taxCollected,
    itcClaimed: movementSummary.itcClaimed,
    taxableSales: movementSummary.taxableSales || movements.revenue,
    rows: movementSummary.rows,
  });

  return { invoices, purchases, bankDocuments, taxCodes, journal };
}

export function useGstHstPeriodReport({
  organizationId,
  periodStart,
  periodEnd,
  journal,
  authority,
  enabled = true,
}: {
  organizationId?: string;
  periodStart: string;
  periodEnd: string;
  journal?: GstHstJournalFallback;
  authority: string;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: ['gst-hst-period-documents', organizationId, periodStart, periodEnd],
    enabled: enabled && !!organizationId,
    queryFn: () => fetchGstHstPeriodDocuments(organizationId!, periodStart, periodEnd),
  });

  const snapshot = useMemo(() => {
    if (!query.data) {
      return summarizeGstHstDocuments({
        periodStart,
        periodEnd,
        invoices: [],
        purchases: [],
        bankDocuments: [],
        journal,
        authority,
      });
    }
    return summarizeGstHstDocuments({
      periodStart,
      periodEnd,
      invoices: query.data.invoices,
      purchases: query.data.purchases,
      bankDocuments: query.data.bankDocuments,
      taxCodes: query.data.taxCodes,
      journal: journal ?? query.data.journal,
      authority,
    });
  }, [query.data, periodStart, periodEnd, journal, authority]);

  return {
    snapshot,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export function useGstHstComparisonReports({
  organizationId,
  ranges,
  enabled,
  authority,
}: {
  organizationId?: string;
  ranges: TaxComparisonRange[];
  enabled: boolean;
  authority: string;
}) {
  const queries = useQueries({
    queries: ranges.map((range) => {
      const start = toISODate(range.start);
      const end = toISODate(range.end);
      return {
        queryKey: ['gst-hst-period-documents', organizationId, start, end],
        enabled: enabled && !!organizationId,
        queryFn: () => fetchGstHstPeriodDocuments(organizationId!, start, end),
      };
    }),
  });

  return ranges.map((range, index) => {
    const start = toISODate(range.start);
    const end = toISODate(range.end);
    const data = queries[index]?.data;
    return {
      ...range,
      isLoading: queries[index]?.isLoading ?? false,
      snapshot: data
        ? summarizeGstHstDocuments({
            periodStart: start,
            periodEnd: end,
            invoices: data.invoices,
            purchases: data.purchases,
            bankDocuments: data.bankDocuments,
            taxCodes: data.taxCodes,
            journal: data.journal,
            authority,
          })
        : emptyGstHstSnapshot(start, end, authority),
    };
  });
}
