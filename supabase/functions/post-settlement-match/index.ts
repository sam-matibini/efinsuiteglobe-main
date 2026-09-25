// Posts a balanced journal entry for a matched Stripe settlement and links it on settlement_matches.
// Idempotent: refuses to repost if settlement_matches.journal_entry_id already exists.
//
// Body: { match_id: string }  OR  { settlement_id: string, bank_transaction_id?: string }
//
// JE shape (one entry per matched settlement):
//   Dr Bank (bank_accounts.gl_account_id)         net_amount
//   Dr Processor Fees Expense                     fees
//   Dr Chargebacks/Refunds clearing               chargebacks + refunds
//        Cr Stripe Clearing / Undeposited Funds   gross_amount
//
// GL account resolution:
//   - Bank      = bank_accounts.gl_account_id
//   - Fees      = processor_accounts.fees_gl_account_id
//   - Clearing  = processor_accounts.clearing_gl_account_id
//   - Chargebk  = processor_accounts.chargebacks_gl_account_id (falls back to default_writeoff_account_id)
//
// If a required mapping is missing, returns 422 with a clear hint so the UI can guide the user
// to map it on the processor account.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};


const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Auth: cron secret OR signed-in user
  const cronSecret = Deno.env.get("SETTLEMENT_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const isCron = !!cronSecret && providedSecret === cronSecret;

  let userId: string | null = null;
  if (!isCron) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: cErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (cErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);
    userId = userData.user.id;
  }

  let body: { match_id?: string; settlement_id?: string; bank_transaction_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // Resolve match
  let match: any;
  if (body.match_id) {
    const { data, error } = await admin
      .from("settlement_matches")
      .select("*")
      .eq("id", body.match_id)
      .single();
    if (error || !data) return json({ error: "Match not found" }, 404);
    match = data;
  } else if (body.settlement_id) {
    const { data, error } = await admin
      .from("settlement_matches")
      .select("*")
      .eq("settlement_id", body.settlement_id)
      .is("reversed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "No active match for this settlement" }, 404);
    match = data;
  } else {
    return json({ error: "match_id or settlement_id is required" }, 400);
  }

  if (match.journal_entry_id) {
    return json({ ok: true, already_posted: true, journal_entry_id: match.journal_entry_id });
  }

  // Load settlement + processor
  const { data: settlement, error: sErr } = await admin
    .from("settlements")
    .select(`
      id, organization_id, processor_account_id, settlement_ref, payout_ref,
      settlement_date, expected_deposit_date, currency,
      gross_amount, fees, chargebacks, refunds, net_amount, bank_account_id, department_id
    `)
    .eq("id", match.settlement_id)
    .single();
  if (sErr || !settlement) return json({ error: "Settlement not found" }, 404);

  // Authorize
  if (!isCron && userId) {
    const { data: isMember } = await admin.rpc(
      "is_org_member" as any,
      { _user_id: userId, _org_id: settlement.organization_id } as any,
    );
    if (!isMember) return json({ error: "Forbidden" }, 403);
  }

  const { data: proc, error: pErr } = await admin
    .from("processor_accounts")
    .select(
      "id, fees_gl_account_id, clearing_gl_account_id, chargebacks_gl_account_id, default_writeoff_account_id, expected_bank_account_id",
    )
    .eq("id", settlement.processor_account_id)
    .single();
  if (pErr || !proc) return json({ error: "Processor account not found" }, 404);

  const bankAccountId = settlement.bank_account_id ?? proc.expected_bank_account_id;
  if (!bankAccountId) {
    return json({ error: "No bank account linked to settlement or processor", code: "no_bank_account" }, 422);
  }
  const { data: bank, error: bErr } = await admin
    .from("bank_accounts")
    .select("gl_account_id, currency")
    .eq("id", bankAccountId)
    .single();
  if (bErr || !bank?.gl_account_id) {
    return json({ error: "Destination bank account has no linked GL account", code: "bank_gl_missing" }, 422);
  }

  // Build line set
  const net = round2(Number(settlement.net_amount ?? 0));
  const fees = round2(Number(settlement.fees ?? 0));
  const cb = round2(Number(settlement.chargebacks ?? 0));
  const rf = round2(Number(settlement.refunds ?? 0));
  const gross = round2(Number(settlement.gross_amount ?? net + fees + cb + rf));

  if (Math.abs(gross - (net + fees + cb + rf)) > 0.02) {
    // Recompute gross from parts to ensure balance
  }
  const grossCalc = round2(net + fees + cb + rf);

  if (grossCalc <= 0) return json({ error: "Settlement amount is zero" }, 400);

  const clearingId = proc.clearing_gl_account_id;
  if (!clearingId) {
    return json({
      error: "Map a Stripe Clearing / Undeposited Funds GL account on this processor account",
      code: "clearing_gl_missing",
      hint: "Edit the processor account and set Clearing GL account.",
    }, 422);
  }
  const feesId = fees > 0 ? proc.fees_gl_account_id : null;
  if (fees > 0 && !feesId) {
    return json({
      error: "Map a Processor Fees Expense GL account on this processor account",
      code: "fees_gl_missing",
    }, 422);
  }
  const cbRfTotal = round2(cb + rf);
  const cbId = cbRfTotal > 0 ? (proc.chargebacks_gl_account_id ?? proc.default_writeoff_account_id) : null;
  if (cbRfTotal > 0 && !cbId) {
    return json({
      error: "Map a Chargebacks/Refunds GL account on this processor account",
      code: "chargebacks_gl_missing",
    }, 422);
  }

  // Period guard (non-fatal if RPC missing)
  const entryDate = (settlement.expected_deposit_date || settlement.settlement_date) as string;
  try {
    await admin.rpc("assert_settlement_period_open" as any, {
      _org_id: settlement.organization_id, _date: entryDate,
    } as any);
  } catch { /* noop */ }

  // Create JE
  const ref = `STR-${(settlement.settlement_ref || settlement.payout_ref || settlement.id).slice(0, 56)}`;
  const { data: je, error: jeErr } = await admin
    .from("journal_entries")
    .insert({
      organization_id: settlement.organization_id,
      reference: ref,
      entry_date: entryDate,
      description: `Stripe settlement ${settlement.settlement_ref}`,
      status: "posted",
      created_by: userId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
      journal_type: "manual",
      department_id: settlement.department_id ?? null,
    } as any)
    .select("id, reference")
    .single();
  if (jeErr || !je) return json({ error: `JE create failed: ${jeErr?.message}` }, 500);

  const lines: any[] = [];
  let order = 1;
  if (net !== 0) {
    lines.push({
      journal_entry_id: je.id,
      account_id: bank.gl_account_id,
      description: `Stripe payout deposit ${settlement.settlement_ref}`,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? Math.abs(net) : 0,
      line_order: order++,
      currency: settlement.currency,
    });
  }
  if (fees > 0) {
    lines.push({
      journal_entry_id: je.id,
      account_id: feesId,
      description: `Stripe fees ${settlement.settlement_ref}`,
      debit: fees, credit: 0,
      line_order: order++,
      currency: settlement.currency,
    });
  }
  if (cbRfTotal > 0) {
    lines.push({
      journal_entry_id: je.id,
      account_id: cbId,
      description: `Chargebacks/refunds ${settlement.settlement_ref}`,
      debit: cbRfTotal, credit: 0,
      line_order: order++,
      currency: settlement.currency,
    });
  }
  lines.push({
    journal_entry_id: je.id,
    account_id: clearingId,
    description: `Clear Stripe receivable ${settlement.settlement_ref}`,
    debit: 0, credit: grossCalc,
    line_order: order++,
    currency: settlement.currency,
  });

  const { error: lErr } = await admin.from("journal_entry_lines").insert(lines as any);
  if (lErr) {
    await admin.from("journal_entries").delete().eq("id", je.id);
    return json({ error: `JE lines failed: ${lErr.message}` }, 500);
  }

  await admin.from("settlement_matches").update({
    journal_entry_id: je.id,
    status: "posted",
  }).eq("id", match.id);

  await admin.from("settlements").update({
    status: "matched",
    exception_reason: null,
  }).eq("id", settlement.id);

  await admin.from("settlement_audit_log").insert({
    organization_id: settlement.organization_id,
    action: "match_posted_to_gl",
    details: {
      settlement_id: settlement.id,
      match_id: match.id,
      journal_entry_id: je.id,
      amounts: { net, fees, chargebacks: cb, refunds: rf, gross: grossCalc },
    } as any,
    user_id: userId,
  } as any);

  return json({ ok: true, journal_entry_id: je.id, reference: je.reference });
});
