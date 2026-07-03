/**
 * Settlement Reconciliation Matcher — Phase 2
 *
 * Level 1 — exact reference + amount        (100)
 * Level 2 — exact amount + date window      (95)
 * Level 3 — aggregate (N settlements → 1 bank deposit) via subset-sum (N≤8)
 * Level 4 — split     (1 settlement → N bank deposits) via greedy/subset-sum (N≤4)
 *
 * A weighted scoring engine assigns confidence (0–100) using
 * `settlement_scoring_rules`. Above `auto_approve_threshold` → auto-approved,
 * between thresholds → pending_review, below → exception (no link).
 */

import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';

export type MatchType = 'exact_ref' | 'exact_amount_date' | 'aggregate' | 'split' | 'fuzzy' | 'manual';

export interface SettlementRow {
  id: string;
  organization_id: string;
  processor_account_id: string;
  settlement_ref: string;
  payout_ref: string | null;
  net_amount: number;
  currency: string;
  normalized_ref: string | null;
  expected_deposit_date: string | null;
  settlement_date: string;
  bank_account_id: string | null;
  status: string;
}

export interface ProcessorAccountRow {
  id: string;
  organization_id: string;
  expected_bank_account_id: string | null;
  date_window_days: number;
  auto_approve_threshold?: number;
  review_threshold?: number;
  enable_aggregate?: boolean;
  enable_split?: boolean;
  enable_fuzzy_matching?: boolean;
  fuzzy_min_similarity?: number;
  require_dual_approval?: boolean;
  dual_approval_threshold?: number;
  currency?: string;
  processor?: string;
}

export interface BankTxRow {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  reference_number: string | null;
}

export interface ScoringRule {
  rule_key: string;
  weight: number;
  is_active: boolean;
}

export interface ScoreBreakdown {
  rule_key: string;
  contribution: number;
}

export interface MatchResult {
  settlement_id: string;
  bank_transaction_id: string;
  match_type: MatchType;
  confidence_score: number;
  matched_amount: number;
  score_breakdown: ScoreBreakdown[];
}

/* ---------- normalisation helpers ---------- */

export function normalizeReference(input: string | null | undefined): string {
  if (!input) return '';
  const noise = /\b(STRIPE|PAYOUT|PAYMENT|PAYSAFE|ADYEN|SETTLEMENT|TRANSFER|PYT|REF|ID|NO|NUM|#|\*)\b/gi;
  return String(input)
    .toUpperCase()
    .replace(noise, ' ')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

export function normalizeAmount(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function toCents(n: number): number {
  return Math.round((Number(n) || 0) * 100);
}

function dayDiff(a: string, b: string): number {
  return Math.abs(parseLocalDate(a).getTime() - parseLocalDate(b).getTime()) / 86_400_000;
}

function withinWindow(bankDate: string, expected: string | null, windowDays: number): boolean {
  if (!expected) return true;
  return dayDiff(bankDate, expected) <= windowDays;
}

function shiftDate(yyyyMmDd: string, days: number): string {
  if (!yyyyMmDd) return yyyyMmDd;
  const d = parseLocalDate(yyyyMmDd);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- fuzzy helpers (Level 5) ---------- */

export function jaroWinkler(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aLen = a.length, bLen = b.length;
  const matchDist = Math.max(0, Math.floor(Math.max(aLen, bLen) / 2) - 1);
  const aMatches: boolean[] = new Array(aLen).fill(false);
  const bMatches: boolean[] = new Array(bLen).fill(false);
  let matches = 0;
  for (let i = 0; i < aLen; i++) {
    const lo = Math.max(0, i - matchDist), hi = Math.min(i + matchDist + 1, bLen);
    for (let j = lo; j < hi; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true; bMatches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < aLen; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t = t / 2;
  const jaro = (matches / aLen + matches / bLen + (matches - t) / matches) / 3;
  // Winkler prefix bonus (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, aLen, bLen); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function tokenize(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 3);
}

function sharedTokenCount(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(tokenize(a));
  const tb = tokenize(b);
  let n = 0;
  for (const t of tb) if (ta.has(t)) n++;
  return n;
}

/* ---------- scoring ---------- */


function ruleWeight(rules: Map<string, ScoringRule>, key: string): number {
  const r = rules.get(key);
  return r && r.is_active ? Number(r.weight) : 0;
}

interface ScoreContext {
  refHit: boolean;
  amountMatch: boolean;
  inWindow: boolean;
  processorAccountMatch: boolean;
  currencyMatch: boolean;
  keywordHit: boolean;
  isAggregate: boolean;
  isSplit: boolean;
  daysBeyondWindow: number;
}

function scoreMatch(rules: Map<string, ScoringRule>, ctx: ScoreContext): { score: number; breakdown: ScoreBreakdown[] } {
  const breakdown: ScoreBreakdown[] = [];
  const add = (key: string, predicate: boolean) => {
    if (!predicate) return;
    const w = ruleWeight(rules, key);
    if (w !== 0) breakdown.push({ rule_key: key, contribution: w });
  };
  add('exact_ref', ctx.refHit);
  add('amount_match', ctx.amountMatch);
  add('date_within_window', ctx.inWindow);
  add('processor_account_match', ctx.processorAccountMatch);
  add('currency_match', ctx.currencyMatch);
  add('description_keyword', ctx.keywordHit);
  add('aggregate_solved', ctx.isAggregate);
  add('split_solved', ctx.isSplit);
  if (ctx.daysBeyondWindow > 0) {
    const penalty = Math.max(-20, ruleWeight(rules, 'date_gap_penalty') * Math.min(10, ctx.daysBeyondWindow));
    if (penalty !== 0) breakdown.push({ rule_key: 'date_gap_penalty', contribution: penalty });
  }
  const score = Math.max(0, Math.min(100, breakdown.reduce((s, b) => s + b.contribution, 0)));
  return { score, breakdown };
}

const PROCESSOR_KEYWORDS = ['stripe', 'paypal', 'adyen', 'paysafe', 'square'];

function descriptionKeywordHit(processor: string | undefined, desc: string | null | undefined): boolean {
  if (!desc) return false;
  const lower = desc.toLowerCase();
  if (processor && lower.includes(processor.toLowerCase())) return true;
  return PROCESSOR_KEYWORDS.some((k) => lower.includes(k));
}

/* ---------- Level 1 / 2 single match ---------- */

export function matchSettlement(
  settlement: SettlementRow,
  processor: ProcessorAccountRow,
  candidates: BankTxRow[],
  rules: Map<string, ScoringRule>,
): MatchResult | null {
  const net = Math.abs(normalizeAmount(settlement.net_amount));
  if (net <= 0) return null;

  const expectedBank = processor.expected_bank_account_id;
  const windowDays = processor.date_window_days ?? 3;
  const ref = settlement.normalized_ref || normalizeReference(settlement.settlement_ref);
  const expectedDate = settlement.expected_deposit_date ?? settlement.settlement_date;

  const sameAmount = candidates.filter((c) => {
    const amt = Math.abs(normalizeAmount(c.amount));
    return Math.abs(amt - net) < 0.01;
  });
  if (sameAmount.length === 0) return null;

  // Level 1 — exact reference
  if (ref) {
    for (const c of sameAmount) {
      const haystack = normalizeReference(`${c.description ?? ''} ${c.reference_number ?? ''}`);
      if (haystack && haystack.includes(ref)) {
        const days = dayDiff(c.transaction_date, expectedDate);
        const { score, breakdown } = scoreMatch(rules, {
          refHit: true,
          amountMatch: true,
          inWindow: days <= windowDays,
          processorAccountMatch: !!expectedBank && c.bank_account_id === expectedBank,
          currencyMatch: true,
          keywordHit: descriptionKeywordHit(processor.processor, c.description),
          isAggregate: false,
          isSplit: false,
          daysBeyondWindow: Math.max(0, days - windowDays),
        });
        return {
          settlement_id: settlement.id,
          bank_transaction_id: c.id,
          match_type: 'exact_ref',
          confidence_score: Math.max(score, 95),
          matched_amount: net,
          score_breakdown: breakdown,
        };
      }
    }
  }

  // Level 2 — amount + window
  const inWindow = sameAmount.filter((c) => withinWindow(c.transaction_date, expectedDate, windowDays));
  if (inWindow.length === 0) return null;
  inWindow.sort((a, b) => dayDiff(a.transaction_date, expectedDate) - dayDiff(b.transaction_date, expectedDate));
  const best = inWindow[0];
  const days = dayDiff(best.transaction_date, expectedDate);
  const { score, breakdown } = scoreMatch(rules, {
    refHit: false,
    amountMatch: true,
    inWindow: true,
    processorAccountMatch: !!expectedBank && best.bank_account_id === expectedBank,
    currencyMatch: true,
    keywordHit: descriptionKeywordHit(processor.processor, best.description),
    isAggregate: false,
    isSplit: false,
    daysBeyondWindow: Math.max(0, days - windowDays),
  });
  return {
    settlement_id: settlement.id,
    bank_transaction_id: best.id,
    match_type: 'exact_amount_date',
    confidence_score: score,
    matched_amount: net,
    score_breakdown: breakdown,
  };
}

/* ---------- subset-sum solver (integer cents, N<=8) ---------- */

function findSubset(targetCents: number, items: { id: string; cents: number }[], maxN: number): string[] | null {
  // Sort descending; basic recursion bounded
  const sorted = [...items].sort((a, b) => b.cents - a.cents).slice(0, 50);
  const chosen: string[] = [];
  function recurse(idx: number, remaining: number): boolean {
    if (remaining === 0 && chosen.length >= 2) return true;
    if (idx >= sorted.length || chosen.length >= maxN || remaining < 0) return false;
    const item = sorted[idx];
    if (item.cents <= remaining) {
      chosen.push(item.id);
      if (recurse(idx + 1, remaining - item.cents)) return true;
      chosen.pop();
    }
    return recurse(idx + 1, remaining);
  }
  return recurse(0, targetCents) ? chosen : null;
}

/* ---------- main runner ---------- */

export async function runSettlementMatching(
  organizationId: string,
  opts: { levels?: number[] } = {},
): Promise<{
  scanned: number;
  matched: number;
  aggregated: number;
  split: number;
  queued: number;
  exceptions: number;
  errors: number;
  fuzzyCached: number;
}> {
  const levels = new Set(opts.levels ?? [1, 2, 3, 4, 5]);
  let scanned = 0, matched = 0, aggregated = 0, splitCount = 0, queued = 0, exceptions = 0, errors = 0;
  let fuzzyCached = 0;


  // Load scoring rules: prefer org overrides, fallback to global
  const { data: ruleRows } = await supabase
    .from('settlement_scoring_rules' as any)
    .select('rule_key, weight, is_active, organization_id')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);
  const rulesMap = new Map<string, ScoringRule>();
  for (const r of (ruleRows || []) as any[]) {
    const existing = rulesMap.get(r.rule_key);
    // Org-specific wins over global
    if (!existing || (r.organization_id && !existing)) {
      rulesMap.set(r.rule_key, { rule_key: r.rule_key, weight: Number(r.weight), is_active: r.is_active });
    } else if (r.organization_id) {
      rulesMap.set(r.rule_key, { rule_key: r.rule_key, weight: Number(r.weight), is_active: r.is_active });
    }
  }

  // Load pending settlements
  const settlements: SettlementRow[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from('settlements')
      .select('id, organization_id, processor_account_id, settlement_ref, payout_ref, net_amount, currency, normalized_ref, expected_deposit_date, settlement_date, bank_account_id, status')
      .eq('organization_id', organizationId)
      .in('status', ['pending', 'exception'])
      .range(from, from + 499);
    if (error) throw error;
    if (!data || data.length === 0) break;
    settlements.push(...(data as SettlementRow[]));
    if (data.length < 500) break;
  }
  if (settlements.length === 0) {
    return { scanned: 0, matched: 0, aggregated: 0, split: 0, queued: 0, exceptions: 0, errors: 0, fuzzyCached: 0 };
  }


  // Load processor accounts
  const procIds = Array.from(new Set(settlements.map((s) => s.processor_account_id)));
  const { data: procs, error: procErr } = await supabase
    .from('processor_accounts')
    .select('id, organization_id, expected_bank_account_id, date_window_days, auto_approve_threshold, review_threshold, enable_aggregate, enable_split, enable_fuzzy_matching, fuzzy_min_similarity, require_dual_approval, dual_approval_threshold, currency, processor')
    .in('id', procIds);
  if (procErr) throw procErr;
  const procMap = new Map<string, ProcessorAccountRow>((procs || []).map((p: any) => [p.id, p]));

  // Date window
  const minDate = settlements.reduce<string>((acc, s) => {
    const d = s.expected_deposit_date ?? s.settlement_date;
    return !acc || d < acc ? d : acc;
  }, '');
  const maxDate = settlements.reduce<string>((acc, s) => {
    const d = s.expected_deposit_date ?? s.settlement_date;
    return !acc || d > acc ? d : acc;
  }, '');
  const widest = Math.min(14, Math.max(3, ...Array.from(procMap.values()).map((p) => p.date_window_days || 3)));
  const lo = shiftDate(minDate, -widest);
  const hi = shiftDate(maxDate, widest);

  // Used bank tx (already linked, non-reversed)
  const { data: usedRows } = await supabase
    .from('settlement_matches')
    .select('bank_transaction_id')
    .eq('organization_id', organizationId)
    .is('reversed_at', null);
  const usedSet = new Set<string>((usedRows || []).map((r: any) => r.bank_transaction_id).filter(Boolean));

  // Load candidate bank deposits
  const candidates: BankTxRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, bank_account_id, transaction_date, amount, description, reference_number:reference, transaction_type')
      .gte('transaction_date', lo)
      .lte('transaction_date', hi)
      .eq('transaction_type', 'deposit')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (!usedSet.has(r.id)) {
        candidates.push({
          id: r.id,
          bank_account_id: r.bank_account_id,
          transaction_date: r.transaction_date,
          amount: Number(r.amount),
          description: r.description,
          reference_number: r.reference_number,
        });
      }
    }
    if (data.length < 1000) break;
  }

  const matchedSettlementIds = new Set<string>();

  /* ---- Levels 1 & 2 ---- */
  if (levels.has(1) || levels.has(2)) {
    for (const s of settlements) {
      scanned++;
      const proc = procMap.get(s.processor_account_id);
      if (!proc) { errors++; continue; }
      const result = matchSettlement(s, proc, candidates, rulesMap);
      if (!result) continue;

      const outcome = await persistMatch(organizationId, s, proc, result);
      if (outcome === 'error') { errors++; continue; }
      if (outcome === 'matched') matched++;
      else if (outcome === 'queued') queued++;
      else if (outcome === 'exception') exceptions++;

      matchedSettlementIds.add(s.id);
      const idx = candidates.findIndex((c) => c.id === result.bank_transaction_id);
      if (idx >= 0) candidates.splice(idx, 1);
    }
  }

  /* ---- Level 3 — Aggregate: many settlements to one bank deposit ---- */
  if (levels.has(3)) {
    const unmatched = settlements.filter((s) => !matchedSettlementIds.has(s.id));
    // Group by processor + currency
    const groups = new Map<string, SettlementRow[]>();
    for (const s of unmatched) {
      const proc = procMap.get(s.processor_account_id);
      if (!proc || proc.enable_aggregate === false) continue;
      const key = `${s.processor_account_id}|${s.currency}`;
      const list = groups.get(key) || [];
      list.push(s);
      groups.set(key, list);
    }

    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const proc = procMap.get(list[0].processor_account_id)!;
      const windowDays = proc.date_window_days ?? 3;
      const expectedBank = proc.expected_bank_account_id;

      // Bank candidates: same account, within widest window of any settlement in list
      const bankPool = candidates.filter((c) => (expectedBank ? c.bank_account_id === expectedBank : true));

      for (const bank of bankPool) {
        const targetCents = toCents(Math.abs(bank.amount));
        // Filter settlements within date window of this bank deposit
        const eligible = list
          .filter((s) => !matchedSettlementIds.has(s.id))
          .filter((s) => dayDiff(bank.transaction_date, s.expected_deposit_date ?? s.settlement_date) <= windowDays);
        if (eligible.length < 2) continue;

        const items = eligible.map((s) => ({ id: s.id, cents: toCents(Math.abs(s.net_amount)) }));
        const subset = findSubset(targetCents, items, 8);
        if (!subset || subset.length < 2) continue;

        // Build group + matches
        const memberSettlements = eligible.filter((s) => subset.includes(s.id));
        const totalAmt = memberSettlements.reduce((sum, s) => sum + Math.abs(Number(s.net_amount)), 0);

        const { score, breakdown } = scoreMatch(rulesMap, {
          refHit: false,
          amountMatch: true,
          inWindow: true,
          processorAccountMatch: !!expectedBank && bank.bank_account_id === expectedBank,
          currencyMatch: true,
          keywordHit: descriptionKeywordHit(proc.processor, bank.description),
          isAggregate: true,
          isSplit: false,
          daysBeyondWindow: 0,
        });

        const autoThreshold = proc.auto_approve_threshold ?? 95;
        const reviewThreshold = proc.review_threshold ?? 80;
        const autoApprove = score >= autoThreshold;
        const groupStatus = autoApprove ? 'approved' : score >= reviewThreshold ? 'pending_review' : 'exception';

        if (score < reviewThreshold) continue; // skip very low confidence aggregates

        const insertGroup: any = await supabase
          .from('settlement_match_groups' as any)
          .insert({
            organization_id: organizationId,
            group_type: 'aggregate',
            bank_transaction_id: bank.id,
            total_amount: totalAmt,
            member_count: memberSettlements.length,
            confidence_score: score,
            auto_approved: autoApprove,
            status: groupStatus,
          } as any)
          .select('id')
          .single();
        const group: any = insertGroup.data;
        const gErr = insertGroup.error;
        if (gErr) { errors++; continue; }

        await (supabase.from('settlement_match_group_members' as any).insert as any)(
          memberSettlements.map((s, i) => ({
            organization_id: organizationId,
            group_id: group.id,
            settlement_id: s.id,
            bank_transaction_id: bank.id,
            amount: Math.abs(Number(s.net_amount)),
            sequence: i,
          })),
        );

        const matchRows = memberSettlements.map((s) => ({
          organization_id: organizationId,
          settlement_id: s.id,
          bank_transaction_id: bank.id,
          match_type: 'aggregate' as const,
          confidence_score: score,
          auto_approved: autoApprove,
          matched_amount: Math.abs(Number(s.net_amount)),
          match_group_id: group.id,
          score_breakdown: breakdown,
          status: autoApprove ? 'auto_matched' : 'pending_review',
        }));
        await supabase.from('settlement_matches').insert(matchRows as any);

        if (autoApprove) {
          await supabase.from('settlements')
            .update({ status: 'matched', bank_account_id: expectedBank })
            .in('id', memberSettlements.map((s) => s.id));
          await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', bank.id);
          matched += memberSettlements.length;
        } else {
          queued += memberSettlements.length;
        }
        aggregated++;
        memberSettlements.forEach((s) => matchedSettlementIds.add(s.id));
        const ci = candidates.findIndex((c) => c.id === bank.id);
        if (ci >= 0) candidates.splice(ci, 1);
      }
    }
  }

  /* ---- Level 4 — Split: one settlement → many bank deposits ---- */
  if (levels.has(4)) {
    const unmatched = settlements.filter((s) => !matchedSettlementIds.has(s.id));
    for (const s of unmatched) {
      const proc = procMap.get(s.processor_account_id);
      if (!proc || proc.enable_split === false) continue;
      const expectedBank = proc.expected_bank_account_id;
      const windowDays = proc.date_window_days ?? 3;
      const expectedDate = s.expected_deposit_date ?? s.settlement_date;
      const targetCents = toCents(Math.abs(s.net_amount));

      const eligible = candidates
        .filter((c) => (expectedBank ? c.bank_account_id === expectedBank : true))
        .filter((c) => dayDiff(c.transaction_date, expectedDate) <= windowDays);
      if (eligible.length < 2) continue;

      const items = eligible.map((c) => ({ id: c.id, cents: toCents(Math.abs(c.amount)) }));
      const subset = findSubset(targetCents, items, 4);
      if (!subset || subset.length < 2) continue;

      const memberBanks = eligible.filter((c) => subset.includes(c.id));
      const { score, breakdown } = scoreMatch(rulesMap, {
        refHit: false,
        amountMatch: true,
        inWindow: true,
        processorAccountMatch: !!expectedBank && memberBanks.every((b) => b.bank_account_id === expectedBank),
        currencyMatch: true,
        keywordHit: memberBanks.some((b) => descriptionKeywordHit(proc.processor, b.description)),
        isAggregate: false,
        isSplit: true,
        daysBeyondWindow: 0,
      });

      const autoThreshold = proc.auto_approve_threshold ?? 95;
      const reviewThreshold = proc.review_threshold ?? 80;
      const autoApprove = score >= autoThreshold;
      if (score < reviewThreshold) continue;
      const groupStatus = autoApprove ? 'approved' : 'pending_review';

      const insertSplit: any = await supabase
        .from('settlement_match_groups' as any)
        .insert({
          organization_id: organizationId,
          group_type: 'split',
          settlement_id: s.id,
          total_amount: Math.abs(Number(s.net_amount)),
          member_count: memberBanks.length,
          confidence_score: score,
          auto_approved: autoApprove,
          status: groupStatus,
        } as any)
        .select('id')
        .single();
      const group: any = insertSplit.data;
      const gErr = insertSplit.error;
      if (gErr) { errors++; continue; }

      await (supabase.from('settlement_match_group_members' as any).insert as any)(
        memberBanks.map((b, i) => ({
          organization_id: organizationId,
          group_id: group.id,
          settlement_id: s.id,
          bank_transaction_id: b.id,
          amount: Math.abs(Number(b.amount)),
          sequence: i,
        })),
      );

      const matchRows = memberBanks.map((b) => ({
        organization_id: organizationId,
        settlement_id: s.id,
        bank_transaction_id: b.id,
        match_type: 'split' as const,
        confidence_score: score,
        auto_approved: autoApprove,
        matched_amount: Math.abs(Number(b.amount)),
        match_group_id: group.id,
        score_breakdown: breakdown,
        status: autoApprove ? 'auto_matched' : 'pending_review',
      }));
      await supabase.from('settlement_matches').insert(matchRows as any);

      if (autoApprove) {
        await supabase.from('settlements').update({ status: 'matched', bank_account_id: expectedBank }).eq('id', s.id);
        await supabase.from('bank_transactions').update({ status: 'matched' }).in('id', memberBanks.map((b) => b.id));
        matched++;
      } else {
        queued++;
      }
      splitCount++;
      matchedSettlementIds.add(s.id);
      for (const b of memberBanks) {
        const ci = candidates.findIndex((c) => c.id === b.id);
        if (ci >= 0) candidates.splice(ci, 1);
      }
    }
  }

  /* ---- Level 5 — Fuzzy: cache top candidates per unmatched settlement ---- */
  if (levels.has(5)) {
    const unmatched = settlements.filter((s) => !matchedSettlementIds.has(s.id));
    const fuzzyRows: any[] = [];
    const exceptionUpdates: { id: string; reason: string }[] = [];
    for (const s of unmatched) {
      const proc = procMap.get(s.processor_account_id);
      if (!proc || proc.enable_fuzzy_matching === false) continue;
      const windowDays = (proc.date_window_days ?? 3) + 2;
      const minSim = Number(proc.fuzzy_min_similarity ?? 0.75);
      const expectedDate = s.expected_deposit_date ?? s.settlement_date;
      const sNet = Math.abs(Number(s.net_amount));
      const sRef = s.normalized_ref || normalizeReference(s.settlement_ref);

      const pool = candidates.filter((c) => {
        if (proc.expected_bank_account_id && c.bank_account_id !== proc.expected_bank_account_id) return false;
        if (dayDiff(c.transaction_date, expectedDate) > windowDays) return false;
        const amtDelta = Math.abs(Math.abs(Number(c.amount)) - sNet);
        return amtDelta <= Math.max(0.5, sNet * 0.05);
      });

      type Cand = { c: BankTxRow; similarity: number; amtDelta: number; daysDelta: number; total: number; bd: ScoreBreakdown[] };
      const scored: Cand[] = pool.map((c) => {
        const cRef = normalizeReference(`${c.description ?? ''} ${c.reference_number ?? ''}`);
        const similarity = sRef && cRef ? jaroWinkler(sRef, cRef) : 0;
        const amtDelta = Math.abs(Math.abs(Number(c.amount)) - sNet);
        const daysDelta = Math.round(dayDiff(c.transaction_date, expectedDate));
        const amtScore = Math.max(0, 30 * (1 - Math.min(1, amtDelta / Math.max(0.5, sNet * 0.05))));
        const dateScore = Math.max(0, 15 * (1 - Math.min(1, daysDelta / Math.max(1, windowDays))));
        const fuzzyW = ruleWeight(rulesMap, 'fuzzy_ref_similarity');
        const tokenW = ruleWeight(rulesMap, 'merchant_token_match');
        const refScore = similarity >= minSim ? fuzzyW * similarity : 0;
        const tokens = sharedTokenCount(`${s.settlement_ref} ${s.payout_ref ?? ''}`, `${c.description ?? ''} ${c.reference_number ?? ''}`);
        const tokenScore = tokens > 0 ? Math.min(tokenW, tokens * (tokenW / 3)) : 0;
        const total = Math.min(100, refScore + amtScore + dateScore + tokenScore);
        const bd: ScoreBreakdown[] = [];
        if (refScore > 0) bd.push({ rule_key: 'fuzzy_ref_similarity', contribution: Math.round(refScore * 10) / 10 });
        if (amtScore > 0) bd.push({ rule_key: 'amount_proximity', contribution: Math.round(amtScore * 10) / 10 });
        if (dateScore > 0) bd.push({ rule_key: 'date_proximity', contribution: Math.round(dateScore * 10) / 10 });
        if (tokenScore > 0) bd.push({ rule_key: 'merchant_token_match', contribution: Math.round(tokenScore * 10) / 10 });
        return { c, similarity, amtDelta, daysDelta, total, bd };
      }).sort((a, b) => b.total - a.total).slice(0, 5);

      // Clear stale cache for this settlement
      await supabase.from('settlement_fuzzy_candidates' as any).delete().eq('settlement_id', s.id);

      if (scored.length === 0) {
        exceptionUpdates.push({ id: s.id, reason: 'no_candidates' });
        continue;
      }

      for (const k of scored) {
        fuzzyRows.push({
          organization_id: organizationId,
          settlement_id: s.id,
          bank_transaction_id: k.c.id,
          similarity_score: Math.round(k.similarity * 1000) / 1000,
          amount_delta: Math.round(k.amtDelta * 100) / 100,
          date_delta_days: k.daysDelta,
          total_score: Math.round(k.total * 10) / 10,
          breakdown: k.bd,
        });
      }
      fuzzyCached += scored.length;

      // Best fuzzy candidate: route by thresholds
      const best = scored[0];
      const autoThreshold = proc.auto_approve_threshold ?? 95;
      const reviewThreshold = proc.review_threshold ?? 80;
      if (best.total >= reviewThreshold) {
        const result: MatchResult = {
          settlement_id: s.id,
          bank_transaction_id: best.c.id,
          match_type: 'fuzzy',
          confidence_score: Math.round(best.total),
          matched_amount: sNet,
          score_breakdown: best.bd,
        };
        const outcome = await persistMatch(organizationId, s, proc, result);
        if (outcome === 'matched') matched++;
        else if (outcome === 'queued') queued++;
        else if (outcome === 'exception') exceptions++;
        else errors++;
        matchedSettlementIds.add(s.id);
        const ci = candidates.findIndex((c) => c.id === best.c.id);
        if (ci >= 0) candidates.splice(ci, 1);
      } else {
        exceptionUpdates.push({ id: s.id, reason: 'fuzzy_below_threshold' });
      }
    }

    if (fuzzyRows.length > 0) {
      await (supabase.from('settlement_fuzzy_candidates' as any).insert as any)(fuzzyRows);
    }
    for (const u of exceptionUpdates) {
      await supabase.from('settlements').update({ status: 'exception', exception_reason: u.reason, last_match_attempt_at: new Date().toISOString() }).eq('id', u.id);
      exceptions++;
    }
  }

  // Refresh aging buckets for this org
  await (supabase.rpc as any)('refresh_settlement_aging', { _org: organizationId });

  // Update processor accounts last_matched_at
  await supabase
    .from('processor_accounts')
    .update({ last_matched_at: new Date().toISOString() })
    .in('id', procIds);

  return { scanned, matched, aggregated, split: splitCount, queued, exceptions, errors, fuzzyCached };
}

async function persistMatch(
  organizationId: string,
  s: SettlementRow,
  proc: ProcessorAccountRow,
  result: MatchResult,
): Promise<'matched' | 'queued' | 'exception' | 'error'> {
  const autoThreshold = proc.auto_approve_threshold ?? 95;
  const reviewThreshold = proc.review_threshold ?? 80;
  const requiresDual = !!proc.require_dual_approval && result.matched_amount >= (proc.dual_approval_threshold ?? 1000);
  let autoApprove = result.confidence_score >= autoThreshold;
  if (requiresDual) autoApprove = false; // force dual approval
  const pendingReview = !autoApprove && result.confidence_score >= reviewThreshold;

  if (!autoApprove && !pendingReview && !requiresDual) {
    await supabase
      .from('settlements')
      .update({ status: 'exception' })
      .eq('id', s.id);
    return 'exception';
  }

  try {
    const { error: insErr } = await (supabase.from('settlement_matches').insert as any)({
      organization_id: organizationId,
      settlement_id: result.settlement_id,
      bank_transaction_id: result.bank_transaction_id,
      match_type: result.match_type,
      confidence_score: result.confidence_score,
      auto_approved: autoApprove,
      matched_amount: result.matched_amount,
      score_breakdown: result.score_breakdown,
      status: autoApprove ? 'auto_matched' : 'pending_review',
      requires_second_approval: requiresDual,
    });
    if (insErr) {
      if ((insErr as any).message?.includes('PERIOD_LOCKED')) {
        await supabase.from('settlements').update({ status: 'exception', exception_reason: 'period_locked' }).eq('id', s.id);
        return 'exception';
      }
      return 'error';
    }
  } catch (e: any) {
    if (String(e?.message ?? '').includes('PERIOD_LOCKED')) {
      await supabase.from('settlements').update({ status: 'exception', exception_reason: 'period_locked' }).eq('id', s.id);
      return 'exception';
    }
    return 'error';
  }

  if (autoApprove) {
    await supabase
      .from('settlements')
      .update({ status: 'matched', bank_account_id: proc.expected_bank_account_id })
      .eq('id', s.id);
    await supabase.from('bank_transactions').update({ status: 'matched' }).eq('id', result.bank_transaction_id);
    return 'matched';
  }
  return 'queued';
}
