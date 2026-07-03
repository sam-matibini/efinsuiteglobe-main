import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaxAuditRow {
  source: 'bank' | 'credit_card';
  transactionId: string;
  bankAccountId?: string;
  creditCardId?: string;
  accountName: string;
  transactionDate: string;
  description: string;
  payeePayor: string | null;
  amount: number;
  transactionType: string;
  glAccountId: string | null;
  glAccountName: string | null;
  journalEntryId: string | null;
  reference: string | null;
  taxCodeId: string | null;
  taxAmount: number | null;
  issue: 'missing_tax' | 'unmapped_tax_code' | 'no_tax_on_taxable_account';
  detail: string;
}

/**
 * Audit sales tax posting from banking. Lists categorized & posted bank /
 * credit-card transactions whose journal entry has no line on a tax account,
 * but whose GL account is mapped on the org's sales tax settings as a
 * taxable revenue / expense / ITC target.
 */
export function useBankingTaxAudit(organizationId?: string) {
  return useQuery({
    queryKey: ['banking-tax-audit', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<TaxAuditRow[]> => {
      if (!organizationId) return [];

      // 1. Resolve which accounts the org treats as "tax" accounts
      //    (GST/HST Payable, Input Tax Credits, PST Paid/Collected, etc.)
      const { data: taxCodes } = await supabase
        .from('tax_codes')
        .select('id, code, name, gl_collected_account_id, gl_paid_account_id')
        .eq('organization_id', organizationId);

      const taxAccountIds = new Set<string>();
      (taxCodes || []).forEach((tc) => {
        if (tc.gl_collected_account_id) taxAccountIds.add(tc.gl_collected_account_id);
        if (tc.gl_paid_account_id) taxAccountIds.add(tc.gl_paid_account_id);
      });

      // Heuristic: also catch accounts whose name implies sales tax even if not
      // mapped on a code (older data).
      const { data: namedTaxAccounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('organization_id', organizationId)
        .or(
          'name.ilike.%GST%,name.ilike.%HST%,name.ilike.%PST%,name.ilike.%VAT%,name.ilike.%Input Tax%,name.ilike.%ITC%'
        );
      (namedTaxAccounts || []).forEach((a) => taxAccountIds.add(a.id));

      // 2. Pull posted bank & CC transactions (paginated to honour the 1000-row cap)
      const fetchAll = async <T,>(table: 'bank_transactions' | 'credit_card_transactions') => {
        const rows: T[] = [];
        const pageSize = 1000;
        let from = 0;
        // Filter by org via parent join
        // We need org isolation — bank_transactions joins bank_accounts.
        while (true) {
          let q = supabase
            .from(table)
            .select(
              table === 'bank_transactions'
                ? 'id, transaction_date, description, payee_payor, amount, transaction_type, gl_account_id, journal_entry_id, tax_code_id, tax_amount, bank_account_id, bank_accounts!inner(name, organization_id)'
                : 'id, transaction_date, description, payee_payor, amount, transaction_type, gl_account_id, journal_entry_id, tax_code_id, tax_amount, credit_card_id, credit_cards!inner(name, organization_id)'
            )
            .not('journal_entry_id', 'is', null)
            .range(from, from + pageSize - 1);
          if (table === 'bank_transactions') {
            q = q.eq('bank_accounts.organization_id', organizationId);
          } else {
            q = q.eq('credit_cards.organization_id', organizationId);
          }
          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;
          rows.push(...(data as unknown as T[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        return rows;
      };

      type BankRow = {
        id: string;
        transaction_date: string;
        description: string;
        payee_payor: string | null;
        amount: number;
        transaction_type: string;
        gl_account_id: string | null;
        journal_entry_id: string;
        tax_code_id: string | null;
        tax_amount: number | null;
        bank_account_id: string;
        bank_accounts: { name: string; organization_id: string };
      };
      type CcRow = Omit<BankRow, 'bank_account_id' | 'bank_accounts'> & {
        credit_card_id: string;
        credit_cards: { name: string; organization_id: string };
      };

      const [bankTxs, ccTxs] = await Promise.all([
        fetchAll<BankRow>('bank_transactions'),
        fetchAll<CcRow>('credit_card_transactions'),
      ]);

      // 3. Pull the JE lines for the union of involved journal entries (paginated)
      const jeIds = Array.from(
        new Set<string>([
          ...bankTxs.map((t) => t.journal_entry_id),
          ...ccTxs.map((t) => t.journal_entry_id),
        ].filter(Boolean))
      );

      const jeLinesByJe = new Map<string, Set<string>>();
      const chunkSize = 200;
      for (let i = 0; i < jeIds.length; i += chunkSize) {
        const chunk = jeIds.slice(i, i + chunkSize);
        const { data: lines, error } = await supabase
          .from('journal_entry_lines')
          .select('journal_entry_id, account_id')
          .in('journal_entry_id', chunk);
        if (error) throw error;
        (lines || []).forEach((l) => {
          const set = jeLinesByJe.get(l.journal_entry_id) || new Set<string>();
          set.add(l.account_id);
          jeLinesByJe.set(l.journal_entry_id, set);
        });
      }

      // 4. Resolve GL account names
      const accountIds = new Set<string>();
      bankTxs.forEach((t) => t.gl_account_id && accountIds.add(t.gl_account_id));
      ccTxs.forEach((t) => t.gl_account_id && accountIds.add(t.gl_account_id));
      const acctNameById = new Map<string, string>();
      if (accountIds.size > 0) {
        const { data: accts } = await supabase
          .from('accounts')
          .select('id, name, code')
          .in('id', Array.from(accountIds));
        (accts || []).forEach((a) => acctNameById.set(a.id, `${a.code} ${a.name}`));
      }

      // 5. Detect issues
      const rows: TaxAuditRow[] = [];
      const isTaxLikelyOnAccount = (acctId: string | null) => {
        // The user wants us to flag categorized transactions where the offsetting
        // GL account is a revenue/expense type that *could* carry tax. Without a
        // full revenue-vs-tax classifier, we conservatively flag any account
        // that isn't itself a tax account and has no tax line on the JE.
        if (!acctId) return false;
        return !taxAccountIds.has(acctId);
      };

      const consider = (
        tx: BankRow | CcRow,
        source: 'bank' | 'credit_card'
      ) => {
        if (!tx.journal_entry_id) return;
        const jeAccounts = jeLinesByJe.get(tx.journal_entry_id) || new Set<string>();
        const jeHasTaxLine = Array.from(jeAccounts).some((id) => taxAccountIds.has(id));

        // Case A: tax_code_id was set but no tax line landed (unmapped/silent drop)
        if (tx.tax_code_id && !jeHasTaxLine) {
          rows.push(buildRow(tx, source, 'unmapped_tax_code',
            'A tax code was selected but no tax line was posted (likely missing GL mapping).'));
          return;
        }

        // Case B: no tax code recorded, no tax line, but offset GL exists.
        // Surfaced as advisory so the user can decide whether tax applies.
        if (!tx.tax_code_id && !jeHasTaxLine && isTaxLikelyOnAccount(tx.gl_account_id)) {
          rows.push(buildRow(tx, source, 'missing_tax',
            'Categorized without a tax code — confirm whether sales tax applies.'));
        }
      };

      const buildRow = (
        tx: BankRow | CcRow,
        source: 'bank' | 'credit_card',
        issue: TaxAuditRow['issue'],
        detail: string
      ): TaxAuditRow => ({
        source,
        transactionId: tx.id,
        bankAccountId: source === 'bank' ? (tx as BankRow).bank_account_id : undefined,
        creditCardId: source === 'credit_card' ? (tx as CcRow).credit_card_id : undefined,
        accountName:
          source === 'bank'
            ? (tx as BankRow).bank_accounts?.name
            : (tx as CcRow).credit_cards?.name,
        transactionDate: tx.transaction_date,
        description: tx.description,
        payeePayor: tx.payee_payor,
        amount: Number(tx.amount),
        transactionType: tx.transaction_type,
        glAccountId: tx.gl_account_id,
        glAccountName: tx.gl_account_id ? acctNameById.get(tx.gl_account_id) ?? null : null,
        journalEntryId: tx.journal_entry_id,
        reference: null,
        taxCodeId: tx.tax_code_id,
        taxAmount: tx.tax_amount,
        issue,
        detail,
      });

      bankTxs.forEach((t) => consider(t, 'bank'));
      ccTxs.forEach((t) => consider(t, 'credit_card'));

      // Most recent first
      rows.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      return rows;
    },
  });
}
