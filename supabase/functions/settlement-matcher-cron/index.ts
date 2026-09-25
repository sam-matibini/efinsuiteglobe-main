// Settlement matcher cron — runs deterministic Levels 1 & 2 across processor accounts with
// auto_match_enabled=true, then triggers GL posting for any newly matched & auto-approved rows.
//
// Level 1 — exact normalized reference + amount  (confidence 100, auto)
// Level 2 — exact amount + date within window     (confidence 92, auto if >= auto_approve_threshold)
//
// For settlements that can't be matched, sets settlements.exception_reason to one of:
//   - 'no_bank_account'       (settlement has no bank_account_id and processor has no expected_bank_account_id)
//   - 'no_candidate_in_window'(no bank tx within date window)
//   - 'amount_mismatch'       (candidate(s) present but no amount match)
//
// Levels 3–5 (aggregate, split, fuzzy) remain UI-triggered via src/lib/settlementMatcher.ts.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};


const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const cents = (n: number) => Math.round((Number(n) || 0) * 100);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeReference(s: string | null | undefined): string {
  if (!s) return "";
  const noise = /\b(STRIPE|PAYOUT|PAYMENT|PAYSAFE|ADYEN|SETTLEMENT|TRANSFER|PYT|REF|ID|NO|NUM|#|\*)\b/gi;
  return String(s).toUpperCase().replace(noise, " ").replace(/[^A-Z0-9]/g, "").trim();
}

function dayDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: { organization_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Auth: scheduled jobs may use x-cron-secret; UI/manual runs must be a signed-in org member.
  const cronSecret = Deno.env.get("SETTLEMENT_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && provided === cronSecret;

  let userId: string | null = null;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!body.organization_id) return json({ error: "organization_id is required" }, 400);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: cErr } = await userClient.auth.getUser(token);
    if (cErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    userId = userData.user.id;

    const { data: isMember, error: mErr } = await supabase.rpc("is_org_member" as any, {
      _user_id: userId,
      _org_id: body.organization_id,
    } as any);
    if (mErr) return json({ error: `Organization check failed: ${mErr.message}` }, 500);
    if (!isMember) return json({ error: "Forbidden" }, 403);
  }

  // Refresh aging globally (best-effort)
  await supabase.rpc("refresh_settlement_aging" as any, { _org: body.organization_id ?? null } as any).then(
    () => {},
    () => {},
  );

  let accountsQuery = supabase
    .from("processor_accounts")
    .select(
      "id, organization_id, expected_bank_account_id, date_window_days, auto_approve_threshold, review_threshold, last_auto_match_at, auto_match_schedule",
    )
    .eq("auto_match_enabled", true);
  if (body.organization_id) accountsQuery = accountsQuery.eq("organization_id", body.organization_id);

  const { data: accounts, error: aErr } = await accountsQuery;
  if (aErr) {
    return json({ error: aErr.message }, 500);
  }

  const results: any[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const matchesToPost: { match_id: string; processor_account_id: string }[] = [];

  for (const acc of accounts ?? []) {
    const summary = {
      processor_account_id: acc.id,
      level1: 0, level2: 0, exceptions: 0, scanned: 0, errors: [] as any[],
    };

    try {
      const ninetyAgo = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const windowDays = Math.max(1, Number(acc.date_window_days ?? 3));
      const autoTh = Number(acc.auto_approve_threshold ?? 95);

      // Pull pending settlements (last 90d)
      const { data: settlements, error: sErr } = await supabase
        .from("settlements")
        .select(
          "id, organization_id, processor_account_id, settlement_ref, payout_ref, net_amount, currency, normalized_ref, expected_deposit_date, settlement_date, bank_account_id, status",
        )
        .eq("processor_account_id", acc.id)
        .eq("status", "pending")
        .gte("settlement_date", ninetyAgo)
        .order("settlement_date", { ascending: true })
        .limit(500);
      if (sErr) throw sErr;
      summary.scanned = settlements?.length ?? 0;

      if (!settlements?.length) {
        await supabase.from("processor_accounts").update({
          last_auto_match_at: new Date().toISOString(),
        }).eq("id", acc.id);
        results.push({ ...summary, ok: true });
        continue;
      }

      const bankId = acc.expected_bank_account_id;
      if (!bankId) {
        await supabase
          .from("settlements")
          .update({ exception_reason: "no_bank_account", last_match_attempt_at: new Date().toISOString() })
          .eq("processor_account_id", acc.id)
          .eq("status", "pending");
        summary.exceptions = settlements.length;
        results.push({ ...summary, ok: true, skipped: "no_expected_bank_account" });
        continue;
      }

      // Pull candidate bank transactions (last 100d) on the destination bank account
      const hundredAgo = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10);
      const { data: bankTxs, error: btErr } = await supabase
        .from("bank_transactions")
        .select("id, bank_account_id, transaction_date, amount, description, reference_number:reference")
        .eq("bank_account_id", bankId)
        .gte("transaction_date", hundredAgo)
        .limit(5000);
      if (btErr) throw btErr;

      if (!bankTxs?.length) {
        await supabase
          .from("settlements")
          .update({ exception_reason: "no_candidate_in_window", last_match_attempt_at: new Date().toISOString() })
          .eq("processor_account_id", acc.id)
          .eq("status", "pending");
        summary.exceptions = settlements.length;
        await supabase.from("processor_accounts").update({
          last_auto_match_at: new Date().toISOString(),
        }).eq("id", acc.id);
        results.push({ ...summary, ok: true, skipped: "no_bank_transactions" });
        continue;
      }

      // Exclude bank txs already matched
      const { data: usedMatches } = await supabase
        .from("settlement_matches")
        .select("bank_transaction_id")
        .is("reversed_at", null)
        .in("bank_transaction_id", (bankTxs ?? []).map((b) => b.id));
      const usedIds = new Set((usedMatches ?? []).map((u: any) => u.bank_transaction_id));
      const freeBank = (bankTxs ?? []).filter((b) => !usedIds.has(b.id));

      // Index bank tx by amount cents and by normalized reference
      const byAmount = new Map<number, any[]>();
      const byRef = new Map<string, any[]>();
      for (const b of freeBank) {
        const c = cents(Number(b.amount));
        (byAmount.get(c) ?? byAmount.set(c, []).get(c)!).push(b);
        const refs = [b.reference_number, b.description].filter(Boolean) as string[];
        for (const r of refs) {
          const n = normalizeReference(r);
          if (!n) continue;
          (byRef.get(n) ?? byRef.set(n, []).get(n)!).push(b);
        }
      }

      const consumed = new Set<string>();

      for (const s of settlements) {
        const sCents = cents(Number(s.net_amount));
        const expDate = s.expected_deposit_date || s.settlement_date;
        const sRef = normalizeReference(s.normalized_ref || s.settlement_ref || s.payout_ref || "");

        // Level 1 — exact ref + exact amount
        let chosen: any = null;
        let matchType: "exact_ref" | "exact_amount_date" | null = null;
        let confidence = 0;

        if (sRef) {
          const refCands = (byRef.get(sRef) ?? []).filter(
            (b) => !consumed.has(b.id) && cents(Number(b.amount)) === sCents,
          );
          if (refCands.length === 1) { chosen = refCands[0]; matchType = "exact_ref"; confidence = 100; }
        }

        // Level 2 — exact amount + date window (unique)
        if (!chosen) {
          const amtCands = (byAmount.get(sCents) ?? []).filter(
            (b) => !consumed.has(b.id) && dayDiff(b.transaction_date, expDate) <= windowDays,
          );
          if (amtCands.length === 1) {
            chosen = amtCands[0];
            matchType = "exact_amount_date";
            // Confidence decays with date distance
            const dd = dayDiff(amtCands[0].transaction_date, expDate);
            confidence = Math.max(80, 95 - Math.round(dd * 2));
          }
        }

        if (!chosen || !matchType) {
          // Classify exception
          const sameAmount = (byAmount.get(sCents) ?? []).filter((b) => !consumed.has(b.id));
          const reason = sameAmount.length === 0 ? "no_candidate_in_window" : "amount_mismatch";
          await supabase
            .from("settlements")
            .update({ exception_reason: reason, last_match_attempt_at: new Date().toISOString() })
            .eq("id", s.id);
          summary.exceptions++;
          continue;
        }

        consumed.add(chosen.id);
        const matchedAmount = round2(Number(s.net_amount));
        const autoApproved = confidence >= autoTh;
        const status = autoApproved ? "approved" : "pending_review";

        const { data: ins, error: insErr } = await supabase
          .from("settlement_matches")
          .insert({
            organization_id: s.organization_id,
            settlement_id: s.id,
            bank_transaction_id: chosen.id,
            match_type: matchType,
            confidence_score: confidence,
            auto_approved: autoApproved,
            matched_amount: matchedAmount,
            status,
            score_breakdown: [{ rule_key: matchType, contribution: confidence }] as any,
          } as any)
          .select("id")
          .single();
        if (insErr) { summary.errors.push({ settlement_id: s.id, message: insErr.message }); continue; }

        await supabase
          .from("settlements")
          .update({ status: "matched", exception_reason: null, last_match_attempt_at: new Date().toISOString() })
          .eq("id", s.id);

        if (matchType === "exact_ref") summary.level1++;
        else summary.level2++;

        if (autoApproved && ins?.id) {
          matchesToPost.push({ match_id: ins.id, processor_account_id: acc.id });
        }
      }

      await supabase
        .from("processor_accounts")
        .update({ last_auto_match_at: new Date().toISOString(), last_matched_at: new Date().toISOString() })
        .eq("id", acc.id);

      await supabase.from("settlement_audit_log").insert({
        organization_id: acc.organization_id,
        action: "auto_match_cron",
        details: {
          processor_account_id: acc.id,
          schedule: acc.auto_match_schedule,
          summary,
        } as any,
      } as any);

      results.push({ ...summary, ok: true });
    } catch (e: any) {
      results.push({ ...summary, ok: false, error: e?.message ?? String(e) });
    }
  }

  // Fire-and-forget GL posting for each auto-approved match.
  // We invoke the sibling function with the cron secret so it bypasses user auth.
  const fnUrl = `${url}/functions/v1/post-settlement-match`;
  const posted: any[] = [];
  for (const m of matchesToPost) {
    try {
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "x-cron-secret": cronSecret ?? "",
        },
        body: JSON.stringify({ match_id: m.match_id }),
      });
      const j = await res.json().catch(() => ({}));
      posted.push({ match_id: m.match_id, status: res.status, ...j });
    } catch (e: any) {
      posted.push({ match_id: m.match_id, error: e?.message ?? String(e) });
    }
  }

  return json({ ran: results.length, results, posted });
});
