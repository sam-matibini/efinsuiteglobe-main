import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';
export type JournalType = 'manual' | 'sales' | 'purchase' | 'payroll' | 'bank' | 'adjustment' | 'depreciation';

export interface DbJournalEntry {
  id: string;
  organization_id: string | null;
  reference: string;
  entry_date: string;
  description: string | null;
  status: JournalEntryStatus;
  journal_type: JournalType;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  reversal_of: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbJournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  line_order: number;
  created_at: string;
  // Joined fields
  account?: {
    code: string;
    name: string;
  };
}

export interface JournalEntryWithLines extends DbJournalEntry {
  lines: DbJournalEntryLine[];
  created_by_profile?: {
    full_name: string | null;
    email: string;
  };
}

export interface JournalLineInput {
  account_id: string;
  description?: string;
  debit: number;
  credit: number;
  line_order?: number;
  customer_id?: string | null;
  vendor_id?: string | null;
  // Multi-currency (optional). When omitted, line is treated as base currency.
  currency?: string | null;
  exchange_rate?: number | null;
  base_currency_debit?: number | null;
  base_currency_credit?: number | null;
}

export interface JournalEntryInput {
  reference: string;
  entry_date: string;
  description?: string;
  notes?: string;
  journal_type?: JournalType;
  /** Division (department) for the entry; defaults onto every line that doesn't override it. */
  department_id?: string | null;
  lines: JournalLineInput[];
}

export interface JournalEntriesFilter {
  status?: JournalEntryStatus | 'all';
  journalType?: JournalType | 'all';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  accountId?: string; // filter to entries that touch this account
  vendorId?: string;
  customerId?: string;
  createdBy?: string;
}

export function useJournalEntries(
  organizationId?: string,
  filters: JournalEntriesFilter = {},
) {
  const {
    status, journalType, startDate, endDate,
    accountId, vendorId, customerId, createdBy,
  } = filters;

  return useQuery({
    queryKey: [
      'journal-entries', organizationId,
      status ?? 'all', journalType ?? 'all',
      startDate ?? '', endDate ?? '',
      accountId ?? '', vendorId ?? '', customerId ?? '', createdBy ?? '',
    ],
    queryFn: async () => {
      // If filtering by account/vendor/customer, first resolve which JE ids match
      let entryIdFilter: string[] | null = null;
      if (accountId || vendorId || customerId) {
        const lineIds: Set<string> = new Set();
        const pageSize = 1000;
        let from = 0;
        while (true) {
          let lq = supabase
            .from('journal_entry_lines')
            .select('journal_entry_id')
            .range(from, from + pageSize - 1);
          if (accountId) lq = lq.eq('account_id', accountId);
          if (vendorId) lq = lq.eq('vendor_id', vendorId);
          if (customerId) lq = lq.eq('customer_id', customerId);
          const { data: lineRows, error: lineErr } = await lq;
          if (lineErr) throw lineErr;
          for (const r of lineRows ?? []) lineIds.add((r as any).journal_entry_id);
          if (!lineRows || lineRows.length < pageSize) break;
          from += pageSize;
        }
        entryIdFilter = Array.from(lineIds);
        if (entryIdFilter.length === 0) return [];
      }

      // Paginated fetch of JEs with lines (lifts the 1000-row cap)
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from('journal_entries')
          .select(`
            *,
            lines:journal_entry_lines(
              *,
              account:accounts(code, name)
            )
          `)
          .eq('organization_id', organizationId)
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (status && status !== 'all') q = q.eq('status', status);
        if (journalType && journalType !== 'all') q = q.eq('journal_type', journalType);
        if (startDate) q = q.gte('entry_date', startDate);
        if (endDate) q = q.lte('entry_date', endDate);
        if (createdBy) q = q.eq('created_by', createdBy);
        if (entryIdFilter) {
          // .in has a practical URL-length limit; chunk if huge
          if (entryIdFilter.length > 500) {
            // fall back: fetch and filter client-side below
          } else {
            q = q.in('id', entryIdFilter);
          }
        }

        const { data, error } = await q;
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }

      let rows = all;
      if (entryIdFilter && entryIdFilter.length > 500) {
        const ids = new Set(entryIdFilter);
        rows = rows.filter((r: any) => ids.has(r.id));
      }

      // Fetch profile names for created_by
      const userIds = [...new Set(rows.map((e: any) => e.created_by).filter(Boolean))] as string[];
      let profileMap: Record<string, { full_name: string | null; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        if (profiles) {
          profileMap = Object.fromEntries(
            profiles.map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }])
          );
        }
      }

      return rows.map((entry: any) => ({
        ...entry,
        created_by_profile: entry.created_by ? profileMap[entry.created_by] : undefined,
      })) as JournalEntryWithLines[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      organizationId,
      entry,
      userId,
    }: {
      organizationId: string;
      entry: JournalEntryInput;
      userId: string;
    }) => {
      // FC-bank-account guardrail (same rule as update path)
      const lineAccountIds = entry.lines.map((l) => l.account_id);
      if (lineAccountIds.length > 0) {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('currency')
          .eq('id', organizationId)
          .maybeSingle();
        const baseCcy = (orgRow as any)?.currency || '';
        const { data: fcBanks } = await supabase
          .from('bank_accounts')
          .select('gl_account_id, currency')
          .in('gl_account_id', lineAccountIds);
        const acctCcy = new Map<string, string>();
        (fcBanks || []).forEach((b: any) => {
          if (b.gl_account_id && b.currency) acctCcy.set(b.gl_account_id, b.currency);
        });
        for (const l of entry.lines) {
          const ccy = acctCcy.get(l.account_id);
          if (!ccy) continue;
          // Intra-base-currency bank line: currency/rate are implicit (rate=1, ccy=base)
          if (ccy === baseCcy && !l.currency) continue;
          if (!l.currency || !l.exchange_rate || l.exchange_rate <= 0) {
            throw new Error(
              `This line posts to a ${ccy} bank account. Set the transaction currency and exchange rate before saving.`,
            );
          }
          if (l.currency !== ccy) {
            throw new Error(
              `Currency mismatch: account is ${ccy} but line currency is ${l.currency}.`,
            );
          }
        }
      }


      // Validate debits = credits in BASE currency (matches FX-aware posting).
      const baseDebits = entry.lines.reduce(
        (sum, l) => sum + (l.base_currency_debit ?? l.debit * (l.exchange_rate ?? 1)),
        0
      );
      const baseCredits = entry.lines.reduce(
        (sum, l) => sum + (l.base_currency_credit ?? l.credit * (l.exchange_rate ?? 1)),
        0
      );

      if (Math.abs(baseDebits - baseCredits) > 0.02) {
        throw new Error('Journal entry must balance: base-currency debits must equal credits');
      }

      // Create the journal entry
      const { data: journalEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          organization_id: organizationId,
          reference: entry.reference,
          entry_date: entry.entry_date,
          description: entry.description || null,
          notes: entry.notes || null,
          journal_type: entry.journal_type || 'manual',
          created_by: userId,
          status: 'draft',
          department_id: entry.department_id ?? null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create the lines (with optional multi-currency fields).
      const lines = entry.lines.map((line, index) => {
        const rate = line.exchange_rate ?? 1;
        const baseDr =
          line.base_currency_debit ?? Math.round((line.debit || 0) * rate * 100) / 100;
        const baseCr =
          line.base_currency_credit ?? Math.round((line.credit || 0) * rate * 100) / 100;
        return {
          journal_entry_id: journalEntry.id,
          account_id: line.account_id,
          description: line.description || null,
          debit: line.debit,
          credit: line.credit,
          line_order: line.line_order ?? index,
          customer_id: line.customer_id || null,
          vendor_id: line.vendor_id || null,
          department_id: (line as any).department_id || entry.department_id || null,
          currency: line.currency || null,
          exchange_rate: line.exchange_rate ?? null,
          base_currency_debit: baseDr,
          base_currency_credit: baseCr,
        };
      });

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return journalEntry;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['next-journal-reference', organizationId] });
      toast.success('Journal entry created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create journal entry: ${error.message}`);
    },
  });
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      organizationId,
      userId,
    }: {
      id: string;
      organizationId: string;
      userId: string;
    }) => {
      // Get the journal entry to check date
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .select('entry_date')
        .eq('id', id)
        .single();
      
      if (jeError) throw jeError;
      
      // Check if entry date falls within a closed fiscal period
      const { data: closedPeriod, error: periodError } = await supabase
        .from('fiscal_periods')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('status', 'closed')
        .lte('start_date', journalEntry.entry_date)
        .gte('end_date', journalEntry.entry_date)
        .maybeSingle();
      
      if (periodError) throw periodError;
      
      if (closedPeriod) {
        throw new Error(`Cannot post to closed fiscal period: ${closedPeriod.name}. Please change the entry date or reopen the period.`);
      }
      
      // Account balances are automatically updated by the database trigger
      // 'trigger_auto_update_account_balance' when the entry status changes to 'posted'.
      // The trigger 'trigger_on_journal_entry_posted' recalculates affected account balances.
      // No manual balance updates needed here.
      
      // Update journal entry status to posted
      const { data, error } = await supabase
        .from('journal_entries')
        .update({
          status: 'posted',
          posted_by: userId,
          posted_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Auto-create donation records for credit lines on donation-income accounts with customer_id
      try {
        const { data: linesWithAccounts } = await supabase
          .from('journal_entry_lines')
          .select('id, account_id, credit, customer_id, description, account:accounts(t3010_category)')
          .eq('journal_entry_id', id)
          .gt('credit', 0)
          .not('customer_id', 'is', null);

        if (linesWithAccounts && linesWithAccounts.length > 0) {
          const donationLines = linesWithAccounts.filter(
            (l: any) => l.account?.t3010_category && ['receipted_gifts', 'non_receipted_gifts'].includes(l.account.t3010_category)
          );

          if (donationLines.length > 0) {
            // Get next donation number
            const { data: existingNums } = await supabase
              .from('donations')
              .select('donation_number')
              .eq('organization_id', organizationId)
              .like('donation_number', 'DON-%')
              .order('created_at', { ascending: false })
              .limit(200);

            let maxNum = 0;
            (existingNums || []).forEach((row: any) => {
              const match = row.donation_number?.match(/DON-(\d+)/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
              }
            });

            const donationInserts = donationLines.map((line: any, idx: number) => ({
              organization_id: organizationId,
              donation_number: `DON-${String(maxNum + 1 + idx).padStart(5, '0')}`,
              donor_id: line.customer_id,
              date_received: journalEntry.entry_date,
              amount: Number(line.credit),
              currency: 'CAD',
              donation_type: 'cash' as const,
              journal_entry_id: id,
              eligible_amount: Number(line.credit),
              advantage_value: 0,
              notes: line.description || `Auto-created from ${data.reference}`,
              status: 'confirmed' as const,
              confirmed_at: new Date().toISOString(),
            }));

            await supabase.from('donations').insert(donationInserts);
          }
        }
      } catch (donErr) {
        console.warn('Auto-donation creation skipped:', donErr);
      }

      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry posted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to post journal entry: ${error.message}`);
    },
  });
}

export function useReverseJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      entry,
      organizationId,
      userId,
      reversalDate,
    }: {
      entry: {
        id: string;
        reference: string;
        entry_date: string;
        description: string | null;
        lines: Array<{
          account_id: string;
          description: string | null;
          debit: number;
          credit: number;
          // Multi-currency fields — preserved on reversal so FX reports net to zero
          currency?: string | null;
          exchange_rate?: number | null;
          base_currency_debit?: number | null;
          base_currency_credit?: number | null;
        }>;
      };
      organizationId: string;
      userId: string;
      reversalDate?: string;
    }) => {
      // Create the reversing entry with swapped debits/credits
      const reversalRef = `REV-${entry.reference}`;
      const entryDate = reversalDate || new Date().toISOString().split('T')[0];
      
      const { data: reversalEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          organization_id: organizationId,
          reference: reversalRef,
          entry_date: entryDate,
          description: `Reversal of ${entry.reference}: ${entry.description || ''}`,
          notes: `Reversing entry for ${entry.reference}`,
          created_by: userId,
          status: 'posted',
          posted_by: userId,
          posted_at: new Date().toISOString(),
          reversal_of: entry.id,
        })
        .select()
        .single();
      
      if (entryError) throw entryError;
      
      // Create reversed lines (swap debit/credit AND base_currency_debit/credit)
      // and carry forward currency + exchange_rate so multi-currency reversals
      // net to zero in base-currency reports.
      const reversedLines = entry.lines.map((line, index) => ({
        journal_entry_id: reversalEntry.id,
        account_id: line.account_id,
        description: line.description || null,
        debit: Number(line.credit) || 0,
        credit: Number(line.debit) || 0,
        line_order: index,
        currency: line.currency ?? null,
        exchange_rate: line.exchange_rate ?? null,
        base_currency_debit:
          line.base_currency_credit != null ? Number(line.base_currency_credit) || 0 : null,
        base_currency_credit:
          line.base_currency_debit != null ? Number(line.base_currency_debit) || 0 : null,
      }));
      
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(reversedLines);
      
      if (linesError) throw linesError;
      
      // Account balances are automatically updated by the database triggers:
      // 1. 'trigger_auto_update_account_balance' fires on the new reversal lines INSERT
      // 2. 'trigger_on_journal_entry_posted' fires when original entry status changes to 'reversed'
      // No manual balance updates needed here.
      
      // Mark the original entry as reversed
      const { error: updateError } = await supabase
        .from('journal_entries')
        .update({
          status: 'reversed',
          reversed_by: userId,
          reversed_at: new Date().toISOString(),
        })
        .eq('id', entry.id);
      
      if (updateError) throw updateError;
      
      return reversalEntry;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Journal entry reversed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reverse journal entry: ${error.message}`);
    },
  });
}

export function useUpdateJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      organizationId,
      entry,
    }: {
      id: string;
      organizationId: string;
      entry: JournalEntryInput;
    }) => {
      // Block edits on reversed entries (immutable history)
      const { data: existing, error: existingErr } = await supabase
        .from('journal_entries')
        .select('status')
        .eq('id', id)
        .single();
      if (existingErr) throw existingErr;
      if (existing?.status === 'reversed') {
        throw new Error('Cannot edit a reversed journal entry. Reversed entries are immutable.');
      }

      // FC-bank-account guardrail: any line whose account is a foreign-currency
      // bank account MUST carry that currency + an exchange rate. This catches
      // the historical defect where USD bank lines were saved without
      // `currency`, causing the system to treat the FC amount as base currency.
      const lineAccountIds = entry.lines.map((l) => l.account_id);
      if (lineAccountIds.length > 0) {
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('currency')
          .eq('id', organizationId)
          .maybeSingle();
        const baseCcy = (orgRow as any)?.currency || '';
        const { data: fcBanks } = await supabase
          .from('bank_accounts')
          .select('gl_account_id, currency')
          .in('gl_account_id', lineAccountIds);
        const acctCcy = new Map<string, string>();
        (fcBanks || []).forEach((b: any) => {
          if (b.gl_account_id && b.currency) acctCcy.set(b.gl_account_id, b.currency);
        });
        for (const l of entry.lines) {
          const ccy = acctCcy.get(l.account_id);
          if (!ccy) continue;
          // Intra-base-currency bank line: currency/rate are implicit (rate=1, ccy=base)
          if (ccy === baseCcy && !l.currency) continue;
          if (!l.currency || !l.exchange_rate || l.exchange_rate <= 0) {
            throw new Error(
              `This line posts to a ${ccy} bank account. Set the transaction currency and exchange rate before saving.`,
            );
          }
          if (l.currency !== ccy) {
            throw new Error(
              `Currency mismatch: account is ${ccy} but line currency is ${l.currency}.`,
            );
          }
        }
      }

      // Validate debits = credits in BASE currency
      const baseDebits = entry.lines.reduce(
        (sum, l) => sum + (l.base_currency_debit ?? l.debit * (l.exchange_rate ?? 1)),
        0
      );
      const baseCredits = entry.lines.reduce(
        (sum, l) => sum + (l.base_currency_credit ?? l.credit * (l.exchange_rate ?? 1)),
        0
      );
      if (Math.abs(baseDebits - baseCredits) > 0.02) {
        throw new Error('Journal entry must balance: base-currency debits must equal credits');
      }

      // Update the journal entry header
      const { data: journalEntry, error: entryError } = await supabase
        .from('journal_entries')
        .update({
          reference: entry.reference,
          entry_date: entry.entry_date,
          description: entry.description || null,
          notes: entry.notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (entryError) throw entryError;

      // Delete existing lines and re-create
      const { error: deleteError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', id);

      if (deleteError) throw deleteError;

      // Create new lines (with optional multi-currency fields)
      const lines = entry.lines.map((line, index) => {
        const rate = line.exchange_rate ?? 1;
        const baseDr =
          line.base_currency_debit ?? Math.round((line.debit || 0) * rate * 100) / 100;
        const baseCr =
          line.base_currency_credit ?? Math.round((line.credit || 0) * rate * 100) / 100;
        return {
          journal_entry_id: id,
          account_id: line.account_id,
          description: line.description || null,
          debit: line.debit,
          credit: line.credit,
          line_order: line.line_order ?? index,
          customer_id: line.customer_id || null,
          vendor_id: line.vendor_id || null,
          currency: line.currency || null,
          exchange_rate: line.exchange_rate ?? null,
          base_currency_debit: baseDr,
          base_currency_credit: baseCr,
        };
      });

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);

      if (linesError) throw linesError;
      
      return journalEntry;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId] });
      toast.success('Journal entry updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update journal entry: ${error.message}`);
    },
  });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, organizationId }: { id: string; organizationId: string }) => {
      // Lines will be deleted via CASCADE
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries', organizationId] });
      toast.success('Journal entry deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete journal entry: ${error.message}`);
    },
  });
}

export function useNextJournalReference(organizationId?: string) {
  return useQuery({
    queryKey: ['next-journal-reference', organizationId],
    queryFn: async () => {
      // Fetch ALL JE-* references to find the highest number (avoids gaps/duplicates)
      const { data } = await supabase
        .from('journal_entries')
        .select('reference')
        .eq('organization_id', organizationId)
        .like('reference', 'JE-%');
      
      let maxNum = 0;
      if (data && data.length > 0) {
        for (const entry of data) {
          const match = entry.reference?.match(/JE-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      }
      return `JE-${String(maxNum + 1).padStart(4, '0')}`;
    },
    enabled: !!organizationId,
    staleTime: 0, // Always refetch to get the latest reference
  });
}
