// Stripe Payouts importer — Phase 1 of Settlement Reconciliation
// Pulls payouts from Stripe and upserts them into public.settlements.
// Uses STRIPE_SECRET_KEY workspace secret (caller-supplied).
//
// Body: { organization_id: string, processor_account_id: string, since?: number (unix seconds) }

// @ts-nocheck
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import Stripe from "npm:stripe@17.5.0";

function normalizeReference(input: string | null | undefined): string {
  if (!input) return "";
  const noise = /\b(STRIPE|PAYOUT|PAYMENT|PAYSAFE|ADYEN|SETTLEMENT|TRANSFER|PYT|REF|ID|NO|NUM|#|\*)\b/gi;
  return String(input).toUpperCase().replace(noise, " ").replace(/[^A-Z0-9]/g, "").trim();
}

function toDateOnly(unix: number | null | undefined): string | null {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY is not configured for this project." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const { organization_id, processor_account_id, since } = body ?? {};
    if (!organization_id || !processor_account_id) {
      return new Response(JSON.stringify({ error: "organization_id and processor_account_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch processor account to read last cursor
    const { data: proc, error: pErr } = await supabase
      .from("processor_accounts")
      .select("id, last_sync_cursor, currency, expected_bank_account_id")
      .eq("id", processor_account_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (pErr || !proc) {
      return new Response(JSON.stringify({ error: "Processor account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" });

    // Create batch
    const { data: batch } = await supabase
      .from("settlement_import_batches")
      .insert({
        organization_id,
        processor_account_id,
        source: "stripe_api",
        status: "running",
      })
      .select()
      .single();

    let imported = 0;
    let skipped = 0;
    const errors: any[] = [];
    let newestCursor: string | null = null;

    // Default to last 30 days if no cursor
    const created_gte = since ?? (proc.last_sync_cursor ? Number(proc.last_sync_cursor) : Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30);

    let starting_after: string | undefined = undefined;
    // Limit to 200 payouts per sync
    for (let page = 0; page < 4; page++) {
      const list: any = await stripe.payouts.list({
        limit: 50,
        starting_after,
        created: { gte: created_gte },
      });
      if (!list.data?.length) break;

      for (const payout of list.data) {
        try {
          if (!newestCursor || payout.created > Number(newestCursor)) newestCursor = String(payout.created);

          // Aggregate balance transaction breakdown
          let fees = 0;
          let chargebacks = 0;
          let refunds = 0;
          let gross = 0;
          try {
            const txs: any = await stripe.balanceTransactions.list({ payout: payout.id, limit: 100 });
            for (const t of txs.data) {
              const amt = (t.amount ?? 0) / 100;
              const fee = (t.fee ?? 0) / 100;
              fees += fee;
              if (t.type === "charge" || t.type === "payment") gross += amt + fee;
              else if (t.type === "refund" || t.type === "payment_refund") refunds += Math.abs(amt);
              else if (t.type === "adjustment" || t.type === "dispute") chargebacks += Math.abs(amt);
            }
          } catch (e) {
            // Non-fatal — keep going with gross unknown
          }

          const net_amount = (payout.amount ?? 0) / 100;
          const settlement_ref = payout.id;

          const row = {
            organization_id,
            processor_account_id,
            settlement_ref,
            payout_ref: payout.id,
            settlement_date: toDateOnly(payout.created) ?? new Date().toISOString().slice(0, 10),
            expected_deposit_date: toDateOnly(payout.arrival_date),
            currency: (payout.currency ?? proc.currency ?? "USD").toUpperCase(),
            gross_amount: gross || net_amount + fees,
            fees,
            chargebacks,
            refunds,
            reserves: 0,
            net_amount,
            normalized_ref: normalizeReference(settlement_ref),
            source: "stripe_api" as const,
            import_batch_id: batch?.id,
            raw_payload: payout,
            bank_account_id: proc.expected_bank_account_id ?? null,
          };

          const { error: upErr } = await supabase
            .from("settlements")
            .upsert(row, { onConflict: "organization_id,processor_account_id,settlement_ref" });
          if (upErr) {
            errors.push({ payout: payout.id, message: upErr.message });
          } else {
            imported++;
          }
        } catch (e: any) {
          errors.push({ payout: payout?.id, message: e?.message ?? String(e) });
        }
      }

      if (!list.has_more) break;
      starting_after = list.data[list.data.length - 1].id;
    }

    // Persist cursor + finalize batch
    if (newestCursor) {
      await supabase
        .from("processor_accounts")
        .update({ last_sync_cursor: newestCursor, last_sync_at: new Date().toISOString() })
        .eq("id", processor_account_id);
    }
    if (batch?.id) {
      await supabase
        .from("settlement_import_batches")
        .update({
          imported_count: imported,
          skipped_count: skipped,
          error_count: errors.length,
          errors: errors.length ? errors : null,
          status: errors.length ? "completed_with_errors" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
    }

    return new Response(JSON.stringify({ imported, skipped, errors: errors.length, batch_id: batch?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("import-stripe-payouts error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
