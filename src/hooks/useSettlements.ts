import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { runSettlementMatching, normalizeReference } from '@/lib/settlementMatcher';

export function useProcessorAccounts() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['processor-accounts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processor_accounts')
        .select('*, bank_accounts:expected_bank_account_id(id,name,currency)')
        .eq('organization_id', orgId!)
        .order('display_name');
      if (error) throw error;
      return data as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!orgId) throw new Error('No organization selected');
      if (payload.id) {
        const { id, ...changes } = payload;
        const { data, error } = await supabase
          .from('processor_accounts')
          .update(changes)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('processor_accounts')
        .insert({ ...payload, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processor-accounts', orgId] });
      toast.success('Processor account saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('processor_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['processor-accounts', orgId] }),
  });

  return { accounts: query.data ?? [], isLoading: query.isLoading, upsert, remove };
}

export function useSettlements() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlements', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*, processor_account:processor_account_id(id,display_name,processor,currency)')
        .eq('organization_id', orgId!)
        .order('settlement_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const importCsv = useMutation({
    mutationFn: async ({ processorAccountId, rows, fileName }: { processorAccountId: string; rows: any[]; fileName?: string }) => {
      if (!orgId) throw new Error('No organization selected');

      // Create batch
      const { data: batch, error: bErr } = await supabase
        .from('settlement_import_batches')
        .insert({
          organization_id: orgId,
          processor_account_id: processorAccountId,
          source: 'csv',
          file_name: fileName,
          status: 'running',
        })
        .select()
        .single();
      if (bErr) throw bErr;

      let imported = 0;
      let skipped = 0;
      const errors: any[] = [];

      const prepared = rows.map((r) => {
        const settlement_ref = String(r.settlement_ref ?? r.SettlementId ?? r.payout_id ?? '').trim();
        const gross = Number(r.gross_amount ?? r.gross ?? 0) || 0;
        const fees = Number(r.fees ?? 0) || 0;
        const chargebacks = Number(r.chargebacks ?? 0) || 0;
        const refunds = Number(r.refunds ?? 0) || 0;
        const reserves = Number(r.reserves ?? 0) || 0;
        const explicitNet = r.net_amount !== undefined && r.net_amount !== '' ? Number(r.net_amount) : null;
        const net_amount = explicitNet ?? (gross - fees - chargebacks - refunds - reserves);
        return {
          organization_id: orgId,
          processor_account_id: processorAccountId,
          settlement_ref,
          payout_ref: r.payout_ref ?? r.PayoutId ?? null,
          settlement_date: r.settlement_date,
          expected_deposit_date: r.expected_deposit_date ?? r.settlement_date,
          currency: r.currency ?? 'USD',
          gross_amount: gross,
          fees, chargebacks, refunds, reserves,
          net_amount,
          payer_name: r.payer_name ?? r.payer ?? r.from ?? null,
          payee_name: r.payee_name ?? r.payee ?? r.to ?? null,
          normalized_ref: normalizeReference(settlement_ref),
          source: 'csv' as const,
          import_batch_id: batch.id,
          raw_payload: r,
        };
      }).filter((r) => r.settlement_ref);

      // Upsert in chunks
      for (let i = 0; i < prepared.length; i += 100) {
        const chunk = prepared.slice(i, i + 100);
        const { error, count } = await supabase
          .from('settlements')
          .upsert(chunk, { onConflict: 'organization_id,processor_account_id,settlement_ref', ignoreDuplicates: false, count: 'exact' });
        if (error) { errors.push({ chunk: i, message: error.message }); }
        else { imported += count ?? chunk.length; }
      }
      skipped = rows.length - prepared.length;

      await supabase
        .from('settlement_import_batches')
        .update({
          imported_count: imported,
          skipped_count: skipped,
          error_count: errors.length,
          errors: errors.length ? errors : null,
          status: errors.length ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batch.id);

      return { imported, skipped, errors: errors.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      toast.success(`Imported ${res.imported} settlements (${res.skipped} skipped, ${res.errors} errors)`);
    },
    onError: (e: Error) => toast.error(`Import failed: ${e.message}`),
  });

  const syncStripe = useMutation({
    mutationFn: async (processorAccountId: string) => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.functions.invoke('import-stripe-payouts', {
        body: { organization_id: orgId, processor_account_id: processorAccountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success(`Stripe sync: ${res?.imported ?? 0} imported`);
    },
    onError: (e: Error) => toast.error(`Stripe sync failed: ${e.message}`),
  });

  const runMatching = useMutation({
    mutationFn: async (opts?: { levels?: number[] }) => {
      if (!orgId) throw new Error('No organization selected');
      return runSettlementMatching(orgId, opts);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-review-queue', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-investigation', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-exceptions', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-match-groups', orgId] });
      toast.success(`Matched ${res.matched} · Queued ${res.queued} · Agg ${res.aggregated} · Split ${res.split} · Fuzzy cached ${res.fuzzyCached} · Exc ${res.exceptions}`);
    },
    onError: (e: Error) => toast.error(`Matching failed: ${e.message}`),
  });

  return {
    settlements: query.data ?? [],
    isLoading: query.isLoading,
    importCsv,
    syncStripe,
    runMatching,
  };
}

export function useSettlementMatches() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-matches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_matches')
        .select('*, settlement:settlement_id(*), bank_transaction:bank_transaction_id(*)')
        .eq('organization_id', orgId!)
        .is('reversed_at', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const reverse = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: match, error: gErr } = await supabase
        .from('settlement_matches').select('settlement_id, bank_transaction_id').eq('id', id).single();
      if (gErr) throw gErr;
      const { error } = await supabase
        .from('settlement_matches')
        .update({ reversed_at: new Date().toISOString(), reversal_reason: reason })
        .eq('id', id);
      if (error) throw error;
      if (match) {
        await supabase.from('settlements').update({ status: 'pending' }).eq('id', match.settlement_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success('Match reversed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { matches: query.data ?? [], isLoading: query.isLoading, reverse };
}

/* -------------------- Phase 2 -------------------- */

export function useReviewQueue() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-review-queue', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('settlement_matches') as any)
        .select('*, settlement:settlement_id(*), bank_transaction:bank_transaction_id(*)')
        .eq('organization_id', orgId!)
        .eq('status', 'pending_review')
        .is('reversed_at', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const { data: m } = await supabase
        .from('settlement_matches')
        .select('settlement_id, bank_transaction_id, match_group_id, requires_second_approval, preparer_user_id, organization_id')
        .eq('id', id)
        .single();
      if (!m) throw new Error('Match not found');
      const requires = (m as any).requires_second_approval;
      const preparer = (m as any).preparer_user_id as string | null;

      if (requires && !preparer) {
        // Step 1: record this user as preparer; keep pending_review
        const { error: e1 } = await (supabase.from('settlement_matches').update as any)({ preparer_user_id: uid }).eq('id', id);
        if (e1) throw e1;
        await (supabase.from('settlement_approval_steps' as any).insert as any)({
          organization_id: (m as any).organization_id,
          match_id: id,
          step_number: 1,
          approver_user_id: uid,
          decision: 'approve',
        });
        return { stage: 'preparer' as const };
      }
      if (requires && preparer === uid) {
        throw new Error('A different user must provide the second approval (segregation of duties).');
      }
      // Final approval
      const { error } = await (supabase.from('settlement_matches').update as any)({
        status: 'auto_matched',
        auto_approved: true,
        approver_user_id: uid,
        approved_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      if (requires) {
        await (supabase.from('settlement_approval_steps' as any).insert as any)({
          organization_id: (m as any).organization_id,
          match_id: id,
          step_number: 2,
          approver_user_id: uid,
          decision: 'approve',
        });
      }
      if (m?.settlement_id) {
        await supabase.from('settlements').update({ status: 'matched' }).eq('id', m.settlement_id);
      }
      if (m?.bank_transaction_id) {
        await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', m.bank_transaction_id);
      }
      if ((m as any)?.match_group_id) {
        await (supabase.from('settlement_match_groups' as any).update as any)({ status: 'approved', auto_approved: true, approved_at: new Date().toISOString() })
          .eq('id', (m as any).match_group_id);
      }
      return { stage: 'final' as const };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settlement-review-queue', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success(res?.stage === 'preparer' ? 'Recorded — awaiting second approver' : 'Match approved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: m } = await supabase
        .from('settlement_matches')
        .select('settlement_id')
        .eq('id', id)
        .single();
      const { error } = await (supabase.from('settlement_matches').update as any)({
        status: 'rejected',
        reversed_at: new Date().toISOString(),
        reversal_reason: reason,
      }).eq('id', id);
      if (error) throw error;
      if (m?.settlement_id) {
        await supabase.from('settlements').update({ status: 'pending' }).eq('id', m.settlement_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-review-queue', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success('Match rejected');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { items: query.data ?? [], isLoading: query.isLoading, approve, reject };
}

export function useInvestigationQueue() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-investigation', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*, processor_account:processor_account_id(id,display_name,processor,expected_bank_account_id)')
        .eq('organization_id', orgId!)
        .eq('status', 'exception')
        .order('settlement_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const reassign = useMutation({
    mutationFn: async ({ settlementId, bankTransactionId, reason }: { settlementId: string; bankTransactionId: string; reason?: string }) => {
      const { error: insErr } = await (supabase.from('settlement_matches').insert as any)({
        organization_id: orgId,
        settlement_id: settlementId,
        bank_transaction_id: bankTransactionId,
        match_type: 'manual',
        confidence_score: 100,
        auto_approved: true,
        matched_amount: 0,
        status: 'auto_matched',
        notes: reason ?? null,
      });
      if (insErr) throw insErr;
      await supabase.from('settlements').update({ status: 'matched' }).eq('id', settlementId);
      await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', bankTransactionId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-investigation', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      toast.success('Settlement reassigned');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const markWriteOff = useMutation({
    mutationFn: async ({ settlementId, reason }: { settlementId: string; reason: string }) => {
      const { error } = await supabase
        .from('settlements')
        .update({ status: 'written_off', raw_payload: { write_off_reason: reason, written_off_at: new Date().toISOString() } as any })
        .eq('id', settlementId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-investigation', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success('Marked as written off');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { items: query.data ?? [], isLoading: query.isLoading, reassign, markWriteOff };
}

export function useScoringRules() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-scoring-rules', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_scoring_rules' as any)
        .select('*')
        .or(`organization_id.eq.${orgId},organization_id.is.null`)
        .order('rule_key');
      if (error) throw error;
      // Collapse: prefer org override over global
      const map = new Map<string, any>();
      for (const r of (data as any[]) ?? []) {
        const existing = map.get(r.rule_key);
        if (!existing || (r.organization_id && !existing.organization_id)) map.set(r.rule_key, r);
      }
      return Array.from(map.values());
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { rule_key: string; weight: number; is_active: boolean; description?: string }) => {
      if (!orgId) throw new Error('No organization selected');
      const { error } = await (supabase.from('settlement_scoring_rules' as any) as any).upsert(
        { ...payload, organization_id: orgId },
        { onConflict: 'organization_id,rule_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-scoring-rules', orgId] });
      toast.success('Scoring rule updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected');
      const { error } = await (supabase.from('settlement_scoring_rules' as any) as any)
        .delete().eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-scoring-rules', orgId] });
      toast.success('Reset to defaults');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { rules: query.data ?? [], isLoading: query.isLoading, upsert, resetToDefaults };
}

export function useMatchGroups() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: ['settlement-match-groups', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_match_groups' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  return { groups: query.data ?? [], isLoading: query.isLoading };
}

/* -------------------- Phase 3 -------------------- */

export interface ExceptionFilters {
  agingBucket?: string;
  processorAccountId?: string;
  reason?: string;
}

export function useExceptionsQueue(filters: ExceptionFilters = {}) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-exceptions', orgId, filters],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from('settlements')
        .select('*, processor_account:processor_account_id(id,display_name,processor,expected_bank_account_id)')
        .eq('organization_id', orgId!)
        .in('status', ['exception', 'pending'])
        .order('settlement_date', { ascending: true })
        .limit(500);
      if (filters.agingBucket) q = q.eq('aging_bucket', filters.agingBucket);
      if (filters.processorAccountId) q = q.eq('processor_account_id', filters.processorAccountId);
      if (filters.reason) q = q.eq('exception_reason', filters.reason);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const dismiss = useMutation({
    mutationFn: async ({ settlementId, reason }: { settlementId: string; reason: string }) => {
      const { error } = await supabase
        .from('settlements')
        .update({ status: 'written_off', exception_reason: reason })
        .eq('id', settlementId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-exceptions', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      toast.success('Dismissed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { items: query.data ?? [], isLoading: query.isLoading, dismiss };
}

export function useFuzzyCandidates(settlementId: string | null) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-fuzzy-candidates', orgId, settlementId],
    enabled: !!orgId && !!settlementId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('settlement_fuzzy_candidates' as any) as any)
        .select('*, bank_transaction:bank_transaction_id(*)')
        .eq('organization_id', orgId!)
        .eq('settlement_id', settlementId!)
        .order('total_score', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const acceptCandidate = useMutation({
    mutationFn: async ({ candidateId, autoApprove }: { candidateId: string; autoApprove: boolean }) => {
      if (!orgId) throw new Error('No organization');
      const { data: cand, error: cErr } = await (supabase
        .from('settlement_fuzzy_candidates' as any) as any)
        .select('*')
        .eq('id', candidateId)
        .single();
      if (cErr) throw cErr;
      const { error: insErr } = await (supabase.from('settlement_matches').insert as any)({
        organization_id: orgId,
        settlement_id: cand.settlement_id,
        bank_transaction_id: cand.bank_transaction_id,
        match_type: 'fuzzy',
        confidence_score: Math.round(Number(cand.total_score)),
        auto_approved: autoApprove,
        matched_amount: 0,
        score_breakdown: cand.breakdown,
        status: autoApprove ? 'auto_matched' : 'pending_review',
      });
      if (insErr) throw insErr;
      if (autoApprove) {
        await supabase.from('settlements').update({ status: 'matched' }).eq('id', cand.settlement_id);
        await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', cand.bank_transaction_id);
      } else {
        await supabase.from('settlements').update({ status: 'pending' }).eq('id', cand.settlement_id);
      }
      await (supabase.from('settlement_fuzzy_candidates' as any).delete as any)().eq('settlement_id', cand.settlement_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-exceptions', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-review-queue', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-fuzzy-candidates', orgId] });
      toast.success('Candidate applied');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { candidates: query.data ?? [], isLoading: query.isLoading, acceptCandidate };
}

export function useTriggerAutoMatch() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.functions.invoke('settlement-matcher-cron', {
        body: { organization_id: orgId },
      });
      if (error) {
        const context = error.context as Response | undefined;
        const body = context ? await context.clone().json().catch(() => null) : null;
        throw new Error(body?.error || error.message);
      }
      return data;
    },
    onSuccess: (res: any) => toast.success(`Auto-match: ${res?.ran ?? 0} accounts processed`),
    onError: (e: Error) => toast.error(`Cron failed: ${e.message}`),
  });
}

/* -------------------- Phase 4: Write-offs & dual approval -------------------- */

export function usePostWriteoff() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ settlementId, writeoffAccountId, reason }: { settlementId: string; writeoffAccountId?: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('post-settlement-writeoff', {
        body: { settlement_id: settlementId, writeoff_account_id: writeoffAccountId, reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: boolean; journal_entry_id: string; reference: string; writeoff_id: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-exceptions', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-writeoffs', orgId] });
      toast.success(`Write-off posted as JE ${res?.reference ?? ''}`);
    },
    onError: (e: Error) => toast.error(`Write-off failed: ${e.message}`),
  });
}

export function useReverseWriteoff() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settlementId: string) => {
      const { data, error } = await supabase.functions.invoke('post-settlement-writeoff', {
        body: { settlement_id: settlementId, reverse: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-writeoffs', orgId] });
      toast.success('Write-off reversed');
    },
    onError: (e: Error) => toast.error(`Reversal failed: ${e.message}`),
  });
}

export function useAwaitingSecondApproval() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['settlement-awaiting-second', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('settlement_matches') as any)
        .select('id')
        .eq('organization_id', orgId!)
        .eq('requires_second_approval', true)
        .eq('status', 'pending_review')
        .not('preparer_user_id', 'is', null);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { count: query.data?.length ?? 0, isLoading: query.isLoading };
}

export function useExpenseAccounts() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['expense-accounts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name, account_type')
        .eq('organization_id', orgId!)
        .in('account_type', ['expense', 'asset'])
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { accounts: query.data ?? [], isLoading: query.isLoading };
}


// ===== Phase 5: Analytics, FX revaluation, auditor packages =====

export function useProcessorMetricsDaily(daysBack = 30) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['processor-metrics-daily', orgId, daysBack],
    enabled: !!orgId,
    queryFn: async () => {
      const from = new Date(Date.now() - daysBack * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('settlement_processor_metrics_daily' as any)
        .select('*, processor:processor_account_id(id,display_name,processor,currency)')
        .eq('organization_id', orgId!)
        .gte('metric_date', from)
        .order('metric_date', { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { rows: query.data ?? [], isLoading: query.isLoading };
}

export function useRefreshMetrics() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (daysBack: number = 30) => {
      if (!orgId) throw new Error('No organization');
      const from = new Date(Date.now() - daysBack * 86400_000).toISOString().slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc('refresh_processor_metrics_daily' as any, {
        _org: orgId, _from: from, _to: to,
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processor-metrics-daily', orgId] });
      toast.success('Metrics refreshed');
    },
    onError: (e: Error) => toast.error(`Refresh failed: ${e.message}`),
  });
}

export function useFxRevaluations() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['fx-revaluations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_fx_revaluations' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { rows: query.data ?? [], isLoading: query.isLoading };
}

export function useRunFxRevaluation() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { period_end_date: string; processor_account_id?: string; reverse?: boolean }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.functions.invoke('revalue-settlements', {
        body: { organization_id: orgId, ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['fx-revaluations', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      if (data?.reversed != null) toast.success(`Reversed ${data.reversed} revaluation(s)`);
      else toast.success(`Posted ${data?.posted ?? 0} • skipped ${data?.skipped ?? 0} • errors ${data?.errors ?? 0}`);
    },
    onError: (e: Error) => toast.error(`FX revaluation failed: ${e.message}`),
  });
}

export function useAuditorPackages() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['settlement-auditor-packages', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_auditor_packages' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async (params: { period_start: string; period_end: string; delivery_email?: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.functions.invoke('generate-settlement-audit-pack', {
        body: { organization_id: orgId, ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-auditor-packages', orgId] });
      toast.success('Audit package generated');
    },
    onError: (e: Error) => toast.error(`Package generation failed: ${e.message}`),
  });

  const downloadUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from('auditor-bundles').createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  };

  return { packages: query.data ?? [], isLoading: query.isLoading, generate, downloadUrl };
}

export function useCashflowProjection(horizonDays = 30) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['settlement-cashflow', orgId, horizonDays],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('settlement_cashflow_projection' as any, {
        _org: orgId, _horizon_days: horizonDays,
      } as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { rows: query.data ?? [], isLoading: query.isLoading };
}





// ============================================================================
// Phase 6 — Disputes, Reserves, Processor API Sync
// ============================================================================

export function useDisputes() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settlement-disputes', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_disputes' as any)
        .select('*, processor_account:processor_account_id(id,display_name,processor), settlement:settlement_id(id,processor_settlement_id,settlement_date)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!orgId) throw new Error('No organization');
      const row = { ...payload, organization_id: orgId };
      const { data, error } = await supabase.from('settlement_disputes' as any).upsert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-disputes', orgId] });
      toast.success('Dispute saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const record = useMutation({
    mutationFn: async (params: { dispute_id: string; action: 'open' | 'won' | 'lost'; chargeback_expense_account_id?: string; bank_clearing_account_id?: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.functions.invoke('record-settlement-dispute', {
        body: { organization_id: orgId, ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlement-disputes', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-matches', orgId] });
      toast.success('Dispute updated');
    },
    onError: (e: Error) => toast.error(`Dispute action failed: ${e.message}`),
  });

  return { disputes: query.data ?? [], isLoading: query.isLoading, upsert, record };
}

export function useDisputeEvidence(disputeId?: string) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['dispute-evidence', orgId, disputeId],
    enabled: !!orgId && !!disputeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_dispute_evidence' as any)
        .select('*')
        .eq('dispute_id', disputeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!orgId || !disputeId) throw new Error('Missing context');
      const path = `${orgId}/${disputeId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('dispute-evidence').upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from('settlement_dispute_evidence' as any).insert({
        organization_id: orgId,
        dispute_id: disputeId,
        kind: 'attachment',
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute-evidence', orgId, disputeId] });
      toast.success('Evidence uploaded');
    },
    onError: (e: Error) => toast.error(`Upload failed: ${e.message}`),
  });

  const addNarrative = useMutation({
    mutationFn: async (narrative: string) => {
      if (!orgId || !disputeId) throw new Error('Missing context');
      const { error } = await supabase.from('settlement_dispute_evidence' as any).insert({
        organization_id: orgId,
        dispute_id: disputeId,
        kind: 'narrative',
        narrative,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute-evidence', orgId, disputeId] });
      toast.success('Narrative saved');
    },
  });

  return { evidence: query.data ?? [], isLoading: query.isLoading, uploadFile, addNarrative };
}

export function useReserves() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const query = useQuery({
    queryKey: ['settlement-reserves', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlement_reserves' as any)
        .select('*, processor_account:processor_account_id(display_name,processor)')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
  return { reserves: query.data ?? [], isLoading: query.isLoading };
}

export function useProcessorApiCredentials() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['processor-api-credentials', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processor_api_credentials' as any)
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (!orgId) throw new Error('No organization');
      const row = { ...payload, organization_id: orgId };
      const { data, error } = await supabase
        .from('processor_api_credentials' as any)
        .upsert(row, { onConflict: 'processor_account_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processor-api-credentials', orgId] });
      toast.success('Credentials saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const sync = useMutation({
    mutationFn: async (processor_account_id: string) => {
      const { data, error } = await supabase.functions.invoke('processor-sync', {
        body: { processor_account_id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['processor-api-credentials', orgId] });
      qc.invalidateQueries({ queryKey: ['settlements', orgId] });
      qc.invalidateQueries({ queryKey: ['settlement-disputes', orgId] });
      const synced = data?.synced;
      toast.success(synced ? `Synced ${synced.payouts} payouts, ${synced.disputes} disputes` : 'Sync complete');
    },
    onError: (e: Error) => toast.error(`Sync failed: ${e.message}`),
  });

  return { credentials: query.data ?? [], isLoading: query.isLoading, upsert, sync };
}
