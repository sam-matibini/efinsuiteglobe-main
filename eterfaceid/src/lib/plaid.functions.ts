import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreMatch } from "@/lib/name-match";
import { validateAddress, addressResult, type AddressCheck } from "@/lib/address-rules";

async function ensureWriter(context: { supabase: any; userId: string }) {
  const { data: allowed } = await context.supabase.rpc("can_write", { _user_id: context.userId });
  if (!allowed) throw new Error("You do not have permission to make this change");
}

async function ensureEnabled(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("enabled")
    .eq("provider", "plaid")
    .maybeSingle();
  if (!data?.enabled) throw new Error("Bank connections are switched off. Turn Plaid on in App admin.");
}

/** Reads the case's organisation, or refuses when the caller cannot see the case. */
async function caseContext(supabase: any, caseId: string) {
  const { data } = await supabase
    .from("cases")
    .select("id, org_id, subject_name, country, reference")
    .eq("id", caseId)
    .maybeSingle();
  if (!data) throw new Error("That case could not be found");
  return data as { id: string; org_id: string; subject_name: string; country: string | null; reference: string };
}

export const plaidStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { plaidConfigured, plaidEnvironment } = await import("@/lib/plaid.server");
    const { data } = await context.supabase
      .from("integration_settings")
      .select("enabled")
      .eq("provider", "plaid")
      .maybeSingle();
    return {
      enabled: Boolean(data?.enabled),
      configured: plaidConfigured(),
      environment: plaidEnvironment(),
    };
  });

export const createLinkToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);
    const { plaid } = await import("@/lib/plaid.server");
    const token = await plaid.createLinkToken(`case-${kase.id}`, ["identity", "transactions"]);
    return { linkToken: token.link_token, expiration: token.expiration };
  });

export const exchangePublicToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ caseId: z.string().uuid(), publicToken: z.string().min(10).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);

    const { plaid, plaidEnvironment } = await import("@/lib/plaid.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const exchanged = await plaid.exchangePublicToken(data.publicToken);

    let institutionId: string | null = null;
    let institutionName: string | null = null;
    try {
      const identity = await plaid.identity(exchanged.access_token);
      institutionId = identity.item.institution_id ?? null;
      if (institutionId) institutionName = (await plaid.institution(institutionId)).institution.name;
    } catch {
      /* institution naming is cosmetic */
    }

    const { data: row, error } = await supabaseAdmin
      .from("plaid_items")
      .insert({
        org_id: kase.org_id,
        case_id: kase.id,
        item_id: exchanged.item_id,
        access_token: exchanged.access_token,
        institution_id: institutionId,
        institution_name: institutionName,
        environment: plaidEnvironment(),
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "bank.linked",
      entity_type: "case",
      entity_id: kase.id,
      detail: { institution: institutionName, environment: plaidEnvironment() },
    });

    return { itemId: row.id as string, institution: institutionName };
  });

type Comparison = { field: string; claimed: string; bank: string; status: "match" | "close" | "different" };

export const runIdentityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        itemId: z.string().uuid(),
        claimedEmail: z.string().trim().max(200).optional(),
        claimedPhone: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);

    const { plaid } = await import("@/lib/plaid.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: item } = await supabaseAdmin
      .from("plaid_items")
      .select("id, access_token, institution_name, org_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || (item as any).org_id !== kase.org_id) throw new Error("That bank connection could not be found");

    const identity = await plaid.identity((item as any).access_token as string);
    const owners = identity.accounts.flatMap((a) => a.owners ?? []);
    const names = Array.from(new Set(owners.flatMap((o) => o.names ?? [])));
    const emails = Array.from(new Set(owners.flatMap((o) => (o.emails ?? []).map((e) => e.data))));
    const phones = Array.from(new Set(owners.flatMap((o) => (o.phone_numbers ?? []).map((p) => p.data))));
    const addresses = owners.flatMap((o) => o.addresses ?? []);

    const comparisons: Comparison[] = [];

    // Name: reuse the in-house matching engine.
    let bestName = { name: "", score: 0 };
    for (const n of names) {
      const outcome = scoreMatch({ query: kase.subject_name, candidate: n });
      if (outcome.score > bestName.score) bestName = { name: n, score: outcome.score };
    }
    comparisons.push({
      field: "Name",
      claimed: kase.subject_name,
      bank: bestName.name || "not provided",
      status: bestName.score >= 0.9 ? "match" : bestName.score >= 0.7 ? "close" : "different",
    });

    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9@.]/g, "");
    const digits = (v: string) => v.replace(/\D/g, "").slice(-10);

    if (data.claimedEmail) {
      const hit = emails.some((e) => norm(e) === norm(data.claimedEmail!));
      const sameDomain = emails.some((e) => e.split("@")[1] === data.claimedEmail!.split("@")[1]);
      comparisons.push({
        field: "Email",
        claimed: data.claimedEmail,
        bank: emails[0] ?? "not provided",
        status: hit ? "match" : sameDomain ? "close" : "different",
      });
    }

    if (data.claimedPhone) {
      const hit = phones.some((p) => digits(p) === digits(data.claimedPhone!));
      comparisons.push({
        field: "Phone",
        claimed: data.claimedPhone,
        bank: phones[0] ?? "not provided",
        status: hit ? "match" : "different",
      });
    }

    // Address: validate what the bank holds and compare against the case address on file.
    let addressChecks: AddressCheck[] = [];
    const primary = addresses.find((a) => a.primary) ?? addresses[0];
    if (primary) {
      const { data: onFile } = await context.supabase
        .from("case_addresses")
        .select("line1, city, region, postal_code, country")
        .eq("case_id", kase.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const bankLine = [primary.data.street, primary.data.city, primary.data.region, primary.data.postal_code]
        .filter(Boolean)
        .join(", ");
      addressChecks = validateAddress(
        {
          line1: primary.data.street ?? "",
          city: primary.data.city ?? undefined,
          region: primary.data.region ?? undefined,
          postalCode: primary.data.postal_code ?? undefined,
          country: primary.data.country ?? kase.country ?? "CA",
        },
        onFile
          ? [onFile.line1, onFile.city, onFile.region, onFile.postal_code].filter(Boolean).join(", ")
          : undefined,
      );
      const claimed = onFile
        ? [onFile.line1, onFile.city, onFile.region, onFile.postal_code].filter(Boolean).join(", ")
        : "none on file";
      const outcome = onFile ? addressResult(addressChecks) : "review";
      comparisons.push({
        field: "Address",
        claimed,
        bank: bankLine || "not provided",
        status: outcome === "pass" ? "match" : outcome === "review" ? "close" : "different",
      });
    }

    const different = comparisons.filter((c) => c.status === "different").length;
    const close = comparisons.filter((c) => c.status === "close").length;
    const result: "pass" | "fail" | "review" = different ? "fail" : close ? "review" : "pass";

    const { data: saved, error } = await context.supabase
      .from("plaid_identity_results")
      .insert({
        case_id: kase.id,
        item_id: (item as any).id,
        institution_name: (item as any).institution_name,
        bank_names: names,
        bank_emails: emails,
        bank_phones: phones,
        bank_addresses: addresses as never,
        comparisons: comparisons as never,
        result,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("case_checks").insert({
      case_id: kase.id,
      category: "identity",
      name: `Bank-held identity (${(item as any).institution_name ?? "linked bank"})`,
      result,
      detail: comparisons.map((c) => `${c.field}: ${c.status}`).join("; "),
      source: "plaid",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "bank.identity_checked",
      entity_type: "case",
      entity_id: kase.id,
      detail: { result, comparisons },
    });

    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, kase.org_id, "verifications");

    return { id: saved.id as string, result, comparisons };
  });

export const syncTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncPlaidItem } = await import("@/lib/plaid-sync.server");
    const { data: item } = await supabaseAdmin
      .from("plaid_items")
      .select("id, org_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("That bank connection could not be found");
    const { data: member } = await context.supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", (item as any).org_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("That bank connection belongs to another company");
    return syncPlaidItem(supabaseAdmin, data.itemId);
  });
