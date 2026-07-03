import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';

export interface ReconciliationLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  t3010Category: string | null;
  glBalance: number;
  donationModuleTotal: number;
  variance: number;
}

export interface ReconciliationSummary {
  lines: ReconciliationLine[];
  totalGl: number;
  totalDonations: number;
  totalVariance: number;
  unlinkedDonations: number; // donations with no journal_entry_id
  periodStart: string;
  periodEnd: string;
}

export function useDonationReconciliation(startDate: string, endDate: string) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['donation-reconciliation', organization?.id, startDate, endDate],
    queryFn: async (): Promise<ReconciliationSummary> => {
      if (!organization?.id) throw new Error('No organization');

      // 1. Get all donation-related income accounts (t3010_category IS NOT NULL = donation accounts)
      const { data: donationAccounts, error: accErr } = await supabase
        .from('accounts')
        .select('id, code, name, t3010_category, current_balance')
        .eq('organization_id', organization.id)
        .eq('account_type', 'income')
        .not('t3010_category', 'is', null)
        .eq('is_active', true)
        .order('code');

      if (accErr) throw accErr;

      // 2. Get GL balances from journal entries for each donation account in the period
      const { data: journalLines, error: jlErr } = await supabase
        .from('journal_entry_lines')
        .select(`
          account_id,
          debit,
          credit,
          journal_entry:journal_entries!inner(status, entry_date, organization_id)
        `)
        .eq('journal_entry.organization_id', organization.id)
        .eq('journal_entry.status', 'posted')
        .gte('journal_entry.entry_date', startDate)
        .lte('journal_entry.entry_date', endDate);

      if (jlErr) throw jlErr;

      // Build GL balance map (income = credit normal, so net = credits - debits)
      const glBalanceMap = new Map<string, number>();
      for (const line of journalLines || []) {
        const current = glBalanceMap.get(line.account_id) || 0;
        glBalanceMap.set(line.account_id, current + (line.credit - line.debit));
      }

      // 3. Get donation module totals grouped by the GL account they were posted to
      //    We link via journal_entry_id -> journal_entry_lines -> account_id
      const { data: donations, error: donErr } = await supabase
        .from('donations')
        .select('id, amount, eligible_amount, journal_entry_id, status')
        .eq('organization_id', organization.id)
        .in('status', ['confirmed'])
        .gte('date_received', startDate)
        .lte('date_received', endDate);

      if (donErr) throw donErr;

      // Count unlinked (no journal entry)
      const unlinkedDonations = (donations || []).filter(d => !d.journal_entry_id).length;

      // For linked donations, find which GL account they posted to
      const linkedDonationIds = (donations || [])
        .filter(d => d.journal_entry_id)
        .map(d => d.journal_entry_id!);

      const donationByJe = new Map<string, number>();
      for (const d of donations || []) {
        if (d.journal_entry_id) {
          donationByJe.set(d.journal_entry_id, (donationByJe.get(d.journal_entry_id) || 0) + d.amount);
        }
      }

      // Get the credit lines from those journal entries to map to accounts
      const donationAccountTotals = new Map<string, number>();
      if (linkedDonationIds.length > 0) {
        // Batch in chunks of 50 to avoid URL limits
        for (let i = 0; i < linkedDonationIds.length; i += 50) {
          const batch = linkedDonationIds.slice(i, i + 50);
          const { data: jeLines } = await supabase
            .from('journal_entry_lines')
            .select('journal_entry_id, account_id, credit')
            .in('journal_entry_id', batch)
            .gt('credit', 0);

          for (const jl of jeLines || []) {
            if (donationByJe.has(jl.journal_entry_id)) {
              const current = donationAccountTotals.get(jl.account_id) || 0;
              donationAccountTotals.set(jl.account_id, current + jl.credit);
            }
          }
        }
      }

      // Also add total of unlinked donations as "Unallocated"
      const totalUnlinked = (donations || [])
        .filter(d => !d.journal_entry_id)
        .reduce((sum, d) => sum + d.amount, 0);

      // 4. Build reconciliation lines
      const accountIds = new Set<string>();
      (donationAccounts || []).forEach(a => accountIds.add(a.id));
      donationAccountTotals.forEach((_, id) => accountIds.add(id));

      const accountMap = new Map<string, typeof donationAccounts extends (infer T)[] | null ? T : never>();
      (donationAccounts || []).forEach(a => accountMap.set(a.id, a));

      const lines: ReconciliationLine[] = [];

      for (const accId of accountIds) {
        const acc = accountMap.get(accId);
        if (!acc) continue; // skip non-donation accounts
        const glBal = glBalanceMap.get(accId) || 0;
        const donBal = donationAccountTotals.get(accId) || 0;
        lines.push({
          accountId: accId,
          accountCode: acc.code,
          accountName: acc.name,
          t3010Category: acc.t3010_category,
          glBalance: glBal,
          donationModuleTotal: donBal,
          variance: Math.round((glBal - donBal) * 100) / 100,
        });
      }

      // Add unlinked row if any
      if (totalUnlinked > 0) {
        lines.push({
          accountId: 'unlinked',
          accountCode: '—',
          accountName: 'Unlinked Donations (no GL posting)',
          t3010Category: null,
          glBalance: 0,
          donationModuleTotal: totalUnlinked,
          variance: -totalUnlinked,
        });
      }

      lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      const totalGl = lines.reduce((s, l) => s + l.glBalance, 0);
      const totalDonations = lines.reduce((s, l) => s + l.donationModuleTotal, 0);

      return {
        lines,
        totalGl: Math.round(totalGl * 100) / 100,
        totalDonations: Math.round(totalDonations * 100) / 100,
        totalVariance: Math.round((totalGl - totalDonations) * 100) / 100,
        unlinkedDonations,
        periodStart: startDate,
        periodEnd: endDate,
      };
    },
    enabled: !!organization?.id && !!startDate && !!endDate,
  });
}
