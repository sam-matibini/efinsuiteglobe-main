import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry, getDefaultAccounts } from '@/hooks/useJournalEntryCreation';
import { postBillToGL } from '@/lib/postBillToGL';
import type { ApprovalDocumentType } from './index';

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

  return await postBillToGL({
    organizationId,
    billId,
    billNumber: (bill as any).bill_number,
    billDate: (bill as any).bill_date,
    vendorId: (bill as any).vendor_id,
    taxAmount: Number((bill as any).tax_amount) || 0,
    total: Number((bill as any).total) || 0,
    departmentId: (bill as any).department_id ?? null,
    lines: (lines || []).map((l: any) => ({
      account_id: l.expense_account_id,
      amount: Number(l.amount) || 0,
      description: l.description,
    })),
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

  const lines: any[] = [
    {
      account_id: e.expense_account_id,
      debit: amount,
      credit: 0,
      memo: e.notes || 'Expense',
      source_document_type: 'expense',
      source_document_id: expenseId,
    },
  ];

  if (taxAmount > 0) {
    const defaults = await getDefaultAccounts(organizationId);
    if (defaults.salesTax) {
      lines.push({
        account_id: defaults.salesTax.id,
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
