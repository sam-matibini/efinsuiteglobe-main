import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry, getDefaultAccounts, getTaxGlAccounts } from '@/hooks/useJournalEntryCreation';
import { postBillToGL } from '@/lib/postBillToGL';
import {
  computeDocumentTaxes,
  persistBillTaxes,
  persistExpenseTaxes,
  resolveRetailTaxGlAccount,
  splitPurchaseTaxPosting,
  type DocumentTaxLine,
} from '@/lib/documentTaxEngine';
import type { SalesTaxSettings } from '@/hooks/useSalesTax';
import type { ApprovalDocumentType } from './index';

async function loadOrgTaxContext(organizationId: string) {
  const [{ data: org }, { data: settings }] = await Promise.all([
    supabase.from('organizations').select('country, province').eq('id', organizationId).maybeSingle(),
    supabase.from('sales_tax_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
  ]);
  return {
    country: (org as { country?: string | null } | null)?.country ?? null,
    province: (org as { province?: string | null } | null)?.province ?? (settings as SalesTaxSettings | null)?.province ?? null,
    settings: (settings as SalesTaxSettings | null) ?? null,
  };
}

function rowsToTaxLines(rows: Array<{
  tax_type: string;
  tax_code: string | null;
  rate: number;
  taxable_amount: number;
  tax_amount: number;
  is_recoverable: boolean | null;
  gl_account_id: string | null;
  authority: string | null;
  jurisdiction_code: string | null;
  tax_direction?: string | null;
}>): DocumentTaxLine[] {
  return rows.map((row) => ({
    taxType: row.tax_type,
    taxCode: row.tax_code || row.tax_type,
    taxName: row.tax_code || row.tax_type,
    taxRate: Number(row.rate) || 0,
    taxableAmount: Number(row.taxable_amount) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    isRecoverable: row.is_recoverable !== false,
    glAccountId: row.gl_account_id,
    authority: row.authority,
    jurisdictionCode: row.jurisdiction_code,
    taxDirection: row.tax_direction === 'collected' ? 'collected' : 'paid',
  }));
}

/** Posts an approved bill to the GL. Returns the journal entry id. */
export async function postBillDocument(organizationId: string, billId: string): Promise<string> {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*')
    .eq('id', billId)
    .single();
  if (error) throw error;
  if ((bill as any).journal_entry_id) return (bill as any).journal_entry_id;

  const { data: lines } = await supabase
    .from('bill_lines')
    .select('expense_account_id, amount, description')
    .eq('bill_id', billId)
    .order('line_order', { ascending: true });

  const taxAmount = Number((bill as any).tax_amount) || 0;
  const total = Number((bill as any).total) || 0;
  const subtotal = Number((bill as any).subtotal) || Math.max(0, total - taxAmount);

  const { data: existingTaxes } = await supabase
    .from('bill_taxes')
    .select('*')
    .eq('bill_id', billId);

  let taxLines = rowsToTaxLines((existingTaxes || []) as any);
  if (taxLines.length === 0 && taxAmount > 0) {
    const ctx = await loadOrgTaxContext(organizationId);
    const computed = computeDocumentTaxes({
      countryCode: ctx.country,
      jurisdictionCode: ctx.province,
      amount: subtotal,
      direction: 'paid',
      settings: ctx.settings,
      taxRateOverride: subtotal > 0 ? (taxAmount / subtotal) * 100 : 0,
    });
    taxLines = computed.taxes;
    try {
      await persistBillTaxes(billId, taxLines);
    } catch (err) {
      console.warn('Could not persist bill_taxes:', err);
    }
  }

  return await postBillToGL({
    organizationId,
    billId,
    billNumber: (bill as any).bill_number,
    billDate: (bill as any).bill_date,
    vendorId: (bill as any).vendor_id,
    taxAmount,
    total,
    departmentId: (bill as any).department_id ?? null,
    lines: (lines || []).map((l: any) => ({
      account_id: l.expense_account_id,
      amount: Number(l.amount) || 0,
      description: l.description,
    })),
    taxLines,
  });
}

/** Posts an approved direct expense to the GL. */
export async function postExpenseDocument(
  organizationId: string,
  expenseId: string,
): Promise<string> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single();
  if (error) throw error;
  if ((expense as any).journal_entry_id) return (expense as any).journal_entry_id;

  const e = expense as any;
  if (!e.expense_account_id || !e.paid_through_account_id) {
    throw new Error(
      'This expense needs both an expense account and a paid-through account before it can post to the General Ledger.',
    );
  }

  const amount = Number(e.amount) || 0;
  const taxAmount = Number(e.tax_amount) || 0;
  const total = amount + taxAmount;

  const { data: existingTaxes } = await supabase
    .from('expense_taxes')
    .select('*')
    .eq('expense_id', expenseId);

  let taxLines = rowsToTaxLines((existingTaxes || []) as any);
  if (taxLines.length === 0 && taxAmount > 0) {
    const ctx = await loadOrgTaxContext(organizationId);
    const computed = computeDocumentTaxes({
      countryCode: ctx.country,
      jurisdictionCode: ctx.province,
      amount,
      direction: 'paid',
      settings: ctx.settings,
      taxRateOverride: amount > 0 ? (taxAmount / amount) * 100 : 0,
    });
    taxLines = computed.taxes;
    try {
      await persistExpenseTaxes(expenseId, taxLines);
    } catch (err) {
      console.warn('Could not persist expense_taxes:', err);
    }
  }

  const split = taxLines.length ? splitPurchaseTaxPosting(taxLines) : null;
  const expenseDebit = amount + (split?.nonRecoverableTotal ?? 0);

  const lines: any[] = [
    {
      account_id: e.expense_account_id,
      debit: expenseDebit,
      credit: 0,
      memo: e.notes || 'Expense',
      source_document_type: 'expense',
      source_document_id: expenseId,
    },
  ];

  if (split && split.recoverable.length > 0) {
    const taxGl = await getTaxGlAccounts(organizationId);
    for (const tax of split.recoverable) {
      const accountId =
        tax.glAccountId ||
        resolveRetailTaxGlAccount(tax.taxCode || tax.taxType, 'paid', {
          gstPaidAccountId: taxGl.gstPaidAccountId,
          vatPaidAccountId: taxGl.vatPaidAccountId,
          pstPaidAccountId: taxGl.pstPaidAccountId,
        });
      if (!accountId) {
        throw new Error(
          `No paid/ITC account configured for ${tax.taxName}. Set the tax paid GL account in Settings → Sales Tax.`,
        );
      }
      lines.push({
        account_id: accountId,
        debit: tax.taxAmount,
        credit: 0,
        memo: tax.taxName,
        source_document_type: 'expense',
        source_document_id: expenseId,
      });
    }
  } else if (taxAmount > 0 && !split) {
    const [defaults, taxGl] = await Promise.all([
      getDefaultAccounts(organizationId),
      getTaxGlAccounts(organizationId),
    ]);
    const paidId = taxGl.gstPaidAccountId || taxGl.vatPaidAccountId || defaults.salesTax?.id;
    if (paidId) {
      lines.push({
        account_id: paidId,
        debit: taxAmount,
        credit: 0,
        memo: 'Input Tax',
        source_document_type: 'expense',
        source_document_id: expenseId,
      });
    }
  }

  lines.push({
    account_id: e.paid_through_account_id,
    debit: 0,
    credit: total,
    memo: e.notes || 'Expense payment',
    source_document_type: 'expense',
    source_document_id: expenseId,
  });

  const journalId = await createJournalEntry({
    organizationId,
    date: e.expense_date,
    description: e.notes || 'Direct Expense',
    reference: e.reference || undefined,
    journalType: 'purchase',
    departmentId: e.department_id || null,
    lines,
    status: 'posted',
  });

  await supabase
    .from('expenses')
    .update({ journal_entry_id: journalId, is_posted: true, posted_at: new Date().toISOString() })
    .eq('id', expenseId);

  return journalId;
}

/** Posts an approved expense claim to the GL (DR expenses / CR payable). */
export async function postExpenseClaimDocument(
  organizationId: string,
  claimId: string,
): Promise<string> {
  const { data: claim, error } = await supabase
    .from('expense_claims')
    .select('*')
    .eq('id', claimId)
    .single();
  if (error) throw error;
  if ((claim as any).journal_entry_id) return (claim as any).journal_entry_id;

  const { data: claimLines } = await supabase
    .from('expense_claim_lines')
    .select('expense_account_id, amount, tax_amount, description')
    .eq('expense_claim_id', claimId)
    .order('line_order', { ascending: true });

  const defaults = await getDefaultAccounts(organizationId);
  if (!defaults.ap) {
    throw new Error(
      'No Accounts Payable account found. Add one in Settings → Chart of Accounts before posting expense claims.',
    );
  }

  let fallbackAccountId: string | null = null;
  if ((claimLines || []).some((l: any) => !l.expense_account_id)) {
    const { data: expenseAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('account_type', 'expense')
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code', { ascending: true })
      .limit(1)
      .maybeSingle();
    fallbackAccountId = expenseAccount?.id ?? null;
    if (!fallbackAccountId) {
      throw new Error('No expense account found. Select an account on each claim line.');
    }
  }

  const byAccount = new Map<string, number>();
  let total = 0;
  for (const line of claimLines || []) {
    const accountId = (line as any).expense_account_id || fallbackAccountId!;
    const amount = (Number((line as any).amount) || 0) + (Number((line as any).tax_amount) || 0);
    if (amount === 0) continue;
    byAccount.set(accountId, (byAccount.get(accountId) || 0) + amount);
    total += amount;
  }

  if (total === 0) throw new Error('This expense claim has no amounts to post.');

  const lines = Array.from(byAccount).map(([account_id, amount]) => ({
    account_id,
    debit: amount,
    credit: 0,
    memo: `Expense claim ${(claim as any).claim_number}`,
    source_document_type: 'expense_claim',
    source_document_id: claimId,
  }));

  lines.push({
    account_id: defaults.ap.id,
    debit: 0,
    credit: total,
    memo: `Expense claim ${(claim as any).claim_number}`,
    source_document_type: 'expense_claim',
    source_document_id: claimId,
  } as any);

  const journalId = await createJournalEntry({
    organizationId,
    date: (claim as any).claim_date,
    description: `Expense claim ${(claim as any).claim_number}`,
    journalType: 'purchase',
    lines: lines as any,
    status: 'posted',
  });

  await supabase
    .from('expense_claims')
    .update({ journal_entry_id: journalId, posted_at: new Date().toISOString() })
    .eq('id', claimId);

  return journalId;
}

/** Posts any approved purchase document to the General Ledger. */
export async function postApprovedDocument(
  documentType: ApprovalDocumentType,
  organizationId: string,
  documentId: string,
): Promise<string> {
  switch (documentType) {
    case 'bill':
      return postBillDocument(organizationId, documentId);
    case 'expense':
      return postExpenseDocument(organizationId, documentId);
    case 'expense_claim':
      return postExpenseClaimDocument(organizationId, documentId);
  }
}
