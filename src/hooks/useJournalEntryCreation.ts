import { supabase } from '@/integrations/supabase/client';

export interface JournalEntryLineDimensions {
  cost_center_id?: string;
  department_id?: string;
  project_id?: string;
  fund_id?: string;
  location_id?: string;
  segment_id?: string;
  currency?: string;
  exchange_rate?: number;
  vendor_id?: string;
  customer_id?: string;
  source_document_type?: string;
  source_document_id?: string;
}

export interface JournalEntryLine extends JournalEntryLineDimensions {
  account_id: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface CreateJournalEntryParams {
  organizationId: string;
  date: string;
  description: string;
  reference?: string;
  journalType?: 'manual' | 'sales' | 'purchase' | 'payroll' | 'bank' | 'adjustment' | 'depreciation';
  /** Division (department) tag inherited by lines that don't set their own. */
  departmentId?: string | null;
  lines: JournalEntryLine[];
  status?: 'draft' | 'posted';
}

/**
 * Creates a journal entry with the given lines
 * Returns the created journal entry ID
 */
export async function createJournalEntry(params: CreateJournalEntryParams): Promise<string> {
  const { organizationId, date, description, reference, lines, status = 'posted' } = params;

  // Validate that all account IDs belong to this organization
  const accountIds = lines.map(l => l.account_id);
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, organization_id')
    .in('id', accountIds);
  
  if (accountsError) throw accountsError;
  
  const invalidAccounts = accounts?.filter(a => a.organization_id !== organizationId);
  if (invalidAccounts && invalidAccounts.length > 0) {
    throw new Error('Cannot create journal entry with accounts from different organizations');
  }

  // Validate debits = credits using integer cents (in BASE currency for multi-currency JEs).
  const toCents = (n: number) => Math.round(n * 100);
  const baseDebitCents = lines.reduce((sum, l) => sum + Math.round(toCents(l.debit || 0) * (l.exchange_rate || 1)), 0);
  const baseCreditCents = lines.reduce((sum, l) => sum + Math.round(toCents(l.credit || 0) * (l.exchange_rate || 1)), 0);
  const diffCents = Math.abs(baseDebitCents - baseCreditCents);

  if (diffCents > 2) {
    throw new Error(`Journal entry is out of balance. Base Debits: ${baseDebitCents / 100}, Base Credits: ${baseCreditCents / 100}`);
  } else if (diffCents > 0) {
    const lastCreditLine = [...lines].reverse().find(l => (l.credit || 0) > 0);
    if (lastCreditLine) {
      const rate = lastCreditLine.exchange_rate || 1;
      const adjustedCreditCents = toCents(lastCreditLine.credit) + Math.round((baseDebitCents - baseCreditCents) / rate);
      lastCreditLine.credit = adjustedCreditCents / 100;
    }
  }

  // Generate reference number if not provided
  let entryReference = reference;
  if (!entryReference) {
    // Fetch ALL references to find the highest number, not just the most recent
    const { data: allEntries } = await supabase
      .from('journal_entries')
      .select('reference')
      .eq('organization_id', organizationId)
      .like('reference', 'JE-%');
    
    let maxNum = 0;
    if (allEntries && allEntries.length > 0) {
      for (const entry of allEntries) {
        const match = entry.reference?.match(/JE-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    entryReference = `JE-${String(maxNum + 1).padStart(4, '0')}`;
  }

  // Create journal entry as DRAFT first to prevent orphaned posted entries
  // if lines insertion fails (e.g., trigger validation errors)
  const { data: journalEntry, error: jeError } = await supabase
    .from('journal_entries')
    .insert([{
      organization_id: organizationId,
      entry_date: date,
      reference: entryReference,
      description,
      journal_type: params.journalType || 'manual',
      status: 'draft',
      department_id: params.departmentId ?? null,
    }])
    .select()
    .single();

  if (jeError) throw jeError;

  // Create journal entry lines with dimension support.
  // For multi-currency JEs, pass explicit base_currency_debit/credit so JS is the
  // single source of truth and the validation trigger compares the same numbers
  // the FX rounding plug calculated against (avoids precision loss when the
  // exchange_rate column rounds an extreme rate like NGN→CAD ~0.000879).
  const { error: linesError } = await supabase
    .from('journal_entry_lines')
    .insert(
      lines.map((line, idx) => {
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        const rate = line.exchange_rate || 1;
        return {
          journal_entry_id: journalEntry.id,
          account_id: line.account_id,
          debit,
          credit,
          description: line.memo || null,
          line_order: idx,
          // Dimension fields
          cost_center_id: line.cost_center_id || null,
          department_id: line.department_id || params.departmentId || null,
          project_id: line.project_id || null,
          fund_id: line.fund_id || null,
          location_id: line.location_id || null,
          segment_id: line.segment_id || null,
          // Multi-currency
          currency: line.currency || null,
          exchange_rate: line.exchange_rate || null,
          base_currency_debit: Math.round(debit * rate * 100) / 100,
          base_currency_credit: Math.round(credit * rate * 100) / 100,
          // Entity references
          vendor_id: line.vendor_id || null,
          customer_id: line.customer_id || null,
          // Source document tracking
          source_document_type: line.source_document_type || null,
          source_document_id: line.source_document_id || null,
        };
      })
    );

  if (linesError) {
    // Clean up the draft entry if lines failed
    await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
    throw linesError;
  }

  // Now promote to the requested status (triggers balance validation on 'posted')
  if (status !== 'draft') {
    const { error: statusError } = await supabase
      .from('journal_entries')
      .update({ status })
      .eq('id', journalEntry.id);

    if (statusError) {
      // If posting fails (e.g., balance trigger), clean up
      await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', journalEntry.id);
      await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
      throw statusError;
    }
  }

  // Account balances are automatically updated by the database trigger
  // 'trigger_auto_update_account_balance' on journal_entry_lines table.
  // No manual balance updates needed here - the trigger calls
  // recalculate_account_balance() which derives the correct balance
  // from opening_balance + all posted journal entry lines.

  return journalEntry.id;
}

/**
 * Get default accounts for AR/AP transactions
 * Supports various chart of accounts coding schemes (e.g., 1100, 1-01-100-0001, etc.)
 *
 * IMPORTANT: when nothing matches the code or name patterns, the resolver returns
 * `undefined` instead of silently picking an arbitrary account of the right type.
 * Callers MUST null-check and fall through to explicit per-tax-code GL mappings
 * (see `getTaxGlAccounts` and `sales_tax_settings`) before posting a JE.
 */
export async function getDefaultAccounts(organizationId: string) {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, account_type, is_header')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  // Filter out header accounts - we only want postable accounts
  const postableAccounts = accounts?.filter(a => !a.is_header) || [];

  const findAccount = (
    type: string,
    codePatterns: RegExp[],
    namePatterns: string[],
    nameExcludes: string[] = [],
  ) => {
    const candidates = postableAccounts.filter(
      a => a.account_type === type &&
        !nameExcludes.some(ex => a.name.toLowerCase().includes(ex)),
    );

    // First try by code pattern (supports various formats)
    for (const pattern of codePatterns) {
      const found = candidates.find(a => pattern.test(a.code));
      if (found) return found;
    }
    // Then try by name pattern, in priority order (most specific first)
    for (const pattern of namePatterns) {
      const found = candidates.find(a =>
        a.name.toLowerCase().includes(pattern.toLowerCase()),
      );
      if (found) return found;
    }
    // No silent fallback — return undefined and let caller raise a clear error.
    return undefined;
  };

  return {
    // Accounts Receivable: 110x, 1100, 1-01-110, 1100-xxxx, etc.
    ar: findAccount('asset', [
      /^110\d*$/,           // 110, 1100, 1101
      /^1-\d+-110/,         // 1-01-110-0001
      /^1\d{3}-.*$/,        // 1100-0001
    ], ['accounts receivable', 'trade receivable', 'receivable', 'a/r']),

    // Accounts Payable: 200x, 2000, 2-01-100, etc.
    ap: findAccount('liability', [
      /^200\d*$/,
      /^2-\d+-100/,
      /^2\d{3}-.*$/,
    ], ['accounts payable', 'trade payable', 'payable', 'a/p'],
       ['tax', 'gst', 'hst', 'pst', 'qst', 'vat', 'payroll', 'wage']),

    // Cash/Bank: 100x, 1000, 1-01-100, etc.
    cash: findAccount('asset', [
      /^100\d*$/,
      /^1-\d+-100/,
      /^1\d{3}-.*$/,
    ], ['cash', 'bank', 'chequing', 'checking', 'petty cash']),

    // Sales Revenue: 400x, 4000, 4-01-100, etc.
    // Exclude contra-revenue accounts (returns, discounts, allowances, refunds).
    salesRevenue: findAccount('income', [
      /^400\d*$/,
      /^4-\d+-\d+/,
      /^4\d{3}-.*$/,
    ], ['sales revenue', 'service revenue', 'professional fee', 'sales', 'revenue', 'income', 'fee'],
       ['return', 'discount', 'allowance', 'refund', 'contra']),

    // Sales Tax Payable (GST/HST Collected): 220x, 2200, 2-01-110, 2-01-102 (Oluspe), etc.
    // Specific names first; exclude employee/payroll/withholding/ITC liabilities.
    salesTax: findAccount('liability', [
      /^220\d*$/,
      /^2-\d+-110/,
      /^2-\d+-102/,         // Oluspe / similar CoA where 102 holds sales-tax accounts
      /^2\d{3}-.*$/,
    ], ['gst/hst collected', 'hst collected', 'gst collected',
        'gst/hst payable', 'hst payable', 'gst payable',
        'sales tax payable', 'sales tax', 'gst/hst'],
       ['employee', 'income tax', 'payroll', 'wage',
        'withholding', 'wht', 'paid', 'itc', 'input tax credit']),
  };
}

/**
 * Resolve the configured GL accounts for sales tax from `sales_tax_settings`.
 * Returns the explicit per-organization mapping (preferred over keyword-guessed
 * `getDefaultAccounts().salesTax`). Always check these first when posting a JE
 * for an invoice, bill, expense or payment.
 */
export async function getTaxGlAccounts(organizationId: string): Promise<{
  gstCollectedAccountId: string | null;
  gstPaidAccountId: string | null;
  pstCollectedAccountId: string | null;
  pstPaidAccountId: string | null;
}> {
  const { data } = await supabase
    .from('sales_tax_settings')
    .select('gst_collected_account_id, gst_paid_account_id, pst_collected_account_id, pst_paid_account_id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  return {
    gstCollectedAccountId: data?.gst_collected_account_id ?? null,
    gstPaidAccountId: data?.gst_paid_account_id ?? null,
    pstCollectedAccountId: data?.pst_collected_account_id ?? null,
    pstPaidAccountId: data?.pst_paid_account_id ?? null,
  };
}
