import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeEffectiveOwnership, fiftyPercentRule, type OwnerRow } from "@/lib/ownership";
import { validateAddress } from "@/lib/address-rules";
import { normalizeName, scoreMatch } from "@/lib/name-match";

export const CONTRACT_VERSION = "v1";

async function callerOrg(supabase: any, userId: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not part of a team yet");
  return data as { org_id: string; role: string };
}

async function requireOrgAdmin(supabase: any, userId: string) {
  const membership = await callerOrg(supabase, userId);
  if (membership.role !== "admin") throw new Error("Only administrators can do this");
  return membership;
}

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("platform_staff").select("id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("This area is for eterfaceID staff only");
  return true;
}

const ownerInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(160),
  entity_type: z.enum(["person", "business"]).default("person"),
  ownership_pct: z.number().min(0).max(100).nullable().optional(),
  parent_owner_id: z.string().nullable().optional(),
  control_role: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(2).nullable().optional(),
  birth_date: z.string().trim().max(10).nullable().optional(),
});

const applicationInput = z.object({
  legal_name: z.string().trim().min(2).max(200),
  registration_number: z.string().trim().max(60).nullish(),
  country: z.string().trim().max(2).nullish(),
  address_line1: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(80).nullish(),
  region: z.string().trim().max(80).nullish(),
  postal_code: z.string().trim().max(20).nullish(),
  website: z.string().trim().max(200).nullish(),
  contact_name: z.string().trim().max(120).nullish(),
  contact_email: z.string().trim().email().max(160).nullish(),
  contact_phone: z.string().trim().max(40).nullish(),
  use_case: z.string().trim().max(1000).nullish(),
  expected_volume: z.number().int().nonnegative().nullish(),
  owners: z.array(ownerInput).max(40).default([]),
});

/**
 * Runs eterfaceID's own business verification over what the applicant submitted:
 * registered details, address quality, ownership chain (25% UBO rule) and
 * screening of every owner against the sanctions and PEP lists (50% rule).
 */
async function verifyApplicant(admin: any, input: z.infer<typeof applicationInput>) {
  const checks: Array<{ name: string; ok: boolean; severity: "info" | "warn" | "fail"; detail?: string | undefined }> = [];

  checks.push({
    name: "Registered business name",
    ok: input.legal_name.trim().length >= 2,
    severity: "fail",
    detail: input.legal_name,
  });
  checks.push({
    name: "Business registration number",
    ok: Boolean(input.registration_number && input.registration_number.trim().length >= 4),
    severity: "fail",
    detail: input.registration_number ?? "missing",
  });

  const addressChecks = validateAddress({
    line1: input.address_line1 ?? "",
    city: input.city ?? "",
    region: input.region ?? "",
    postalCode: input.postal_code ?? "",
    country: input.country ?? "",
  });
  for (const c of addressChecks) checks.push(c);

  checks.push({
    name: "Contact email",
    ok: Boolean(input.contact_email),
    severity: "fail",
    detail: input.contact_email ?? "missing",
  });

  // Ownership chain
  const owners: OwnerRow[] = input.owners.map((o, i) => ({
    id: o.id ?? `o${i}`,
    name: o.name,
    entity_type: o.entity_type,
    ownership_pct: o.ownership_pct ?? null,
    parent_owner_id: o.parent_owner_id ?? null,
    control_role: o.control_role ?? null,
    screening_status: "pending",
  }));
  const computed = computeEffectiveOwnership(owners);
  const ubos = computed.filter((o) => o.isUbo);
  checks.push({
    name: "Beneficial owners identified",
    ok: ubos.length > 0,
    severity: "fail",
    detail: ubos.length ? `${ubos.length} owner(s) at or above 25%` : "No owner at or above 25% was declared",
  });

  // Screen every owner
  const sanctionedNames: string[] = [];
  const ownerHits: Array<{ name: string; matched: string; score: number; list: string }> = [];
  for (const owner of input.owners) {
    try {
      const { data: matches } = await admin.rpc("match_watchlist_names", {
        _q: normalizeName(owner.name),
        _threshold: 0.45,
        _limit: 50,
      });
      let best: { name: string; score: number } | null = null;
      for (const m of (matches ?? []) as any[]) {
        const outcome = scoreMatch({
          query: owner.name,
          candidate: m.matched_name,
          kind: owner.entity_type === "business" ? "business" : "person",
        });
        if (!best || outcome.score > best.score) best = { name: m.matched_name, score: outcome.score };
      }
      if (best && best.score >= 0.85) {
        sanctionedNames.push(owner.name);
        ownerHits.push({ name: owner.name, matched: best.name, score: best.score, list: "watchlist" });
      }
    } catch {
      /* screening failure must not silently pass the applicant */
      checks.push({ name: `Owner screening: ${owner.name}`, ok: false, severity: "warn", detail: "Could not be run" });
    }
  }
  checks.push({
    name: "Owners screened against sanctions and PEP lists",
    ok: ownerHits.length === 0,
    severity: "fail",
    detail: ownerHits.length ? ownerHits.map((h) => `${h.name} ~ ${h.matched}`).join("; ") : "No matches",
  });

  const ownerWithFlags = owners.map((o) => ({
    ...o,
    screening_status: sanctionedNames.includes(o.name) ? "hit" : "clear",
  }));
  const rule = fiftyPercentRule(ownerWithFlags, computed);
  if (rule.blocked) {
    checks.push({
      name: "OFAC 50 percent rule",
      ok: false,
      severity: "fail",
      detail: `Sanctioned owners hold ${rule.sanctionedOwnership}% — the business is treated as sanctioned.`,
    });
  }

  const failed = checks.filter((c) => !c.ok && c.severity === "fail");
  const warned = checks.filter((c) => !c.ok && c.severity === "warn");
  const result: "pass" | "review" | "fail" = rule.blocked || failed.length > 2 ? "fail" : failed.length || warned.length ? "review" : "pass";

  return { checks, ownership: computed, rule, result };
}

export const submitLiveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(applicationInput.parse)
  .handler(async ({ data, context }) => {
    const membership = await requireOrgAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const verification = await verifyApplicant(supabaseAdmin, data);

    const payload = {
      org_id: membership.org_id,
      legal_name: data.legal_name,
      registration_number: data.registration_number ?? null,
      country: data.country ?? null,
      address_line1: data.address_line1 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      postal_code: data.postal_code ?? null,
      website: data.website ?? null,
      contact_name: data.contact_name ?? null,
      contact_email: data.contact_email ?? null,
      contact_phone: data.contact_phone ?? null,
      use_case: data.use_case ?? null,
      expected_volume: data.expected_volume ?? null,
      owners: data.owners as never,
      verification: verification as never,
      verification_result: verification.result,
      status: "pending",
      submitted_by: context.userId,
      reviewed_at: null,
      reviewer_id: null,
      reviewer_note: null,
    };

    const { data: existing } = await supabaseAdmin
      .from("org_applications")
      .select("id, status")
      .eq("org_id", membership.org_id)
      .in("status", ["draft", "pending"])
      .maybeSingle();

    let id: string;
    if (existing) {
      const { error } = await supabaseAdmin.from("org_applications").update(payload as never).eq("id", (existing as any).id);
      if (error) throw new Error(error.message);
      id = (existing as any).id;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("org_applications")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (row as any).id;
    }

    await supabaseAdmin.from("audit_events").insert({
      org_id: membership.org_id,
      actor_id: context.userId,
      action: "live_access.applied",
      entity_type: "organization",
      entity_id: membership.org_id,
      detail: { result: verification.result } as never,
    } as never);

    return { id, verification };
  });

export const acceptContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ full_name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(160) }).parse,
  )
  .handler(async ({ data, context }) => {
    const membership = await requireOrgAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("org_contracts")
      .update({ status: "superseded" } as never)
      .eq("org_id", membership.org_id)
      .eq("status", "accepted");

    const { data: row, error } = await supabaseAdmin
      .from("org_contracts")
      .insert({
        org_id: membership.org_id,
        version: CONTRACT_VERSION,
        method: "click",
        status: "accepted",
        accepted_by: context.userId,
        accepted_name: data.full_name,
        accepted_email: data.email,
      } as never)
      .select("id, version, accepted_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_events").insert({
      org_id: membership.org_id,
      actor_id: context.userId,
      action: "contract.accepted",
      entity_type: "organization",
      entity_id: membership.org_id,
      detail: { version: CONTRACT_VERSION, method: "click", name: data.full_name } as never,
    } as never);

    return row;
  });

/** Staff: records that a signed copy of the agreement was received. */
export const recordSignedContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        org_id: z.string().uuid(),
        version: z.string().trim().max(20).optional(),
        document_path: z.string().trim().max(400).nullish(),
        note: z.string().trim().max(500).nullish(),
      }).parse,
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("org_contracts")
      .update({ status: "superseded" } as never)
      .eq("org_id", data.org_id)
      .eq("status", "accepted");

    const { data: row, error } = await supabaseAdmin
      .from("org_contracts")
      .insert({
        org_id: data.org_id,
        version: data.version ?? CONTRACT_VERSION,
        method: "signed_copy",
        status: "accepted",
        document_path: data.document_path ?? null,
        note: data.note ?? null,
        recorded_by: context.userId,
      } as never)
      .select("id, version, accepted_at, method")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Staff: approves, declines, suspends or restores live access for a company. */
export const decideLiveAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        org_id: z.string().uuid(),
        decision: z.enum(["approve", "decline", "suspend", "restore"]),
        note: z.string().trim().max(500).nullish(),
      }).parse,
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const liveAccess =
      data.decision === "approve" || data.decision === "restore"
        ? "approved"
        : data.decision === "suspend"
          ? "suspended"
          : "locked";

    const { error: orgError } = await supabaseAdmin
      .from("organizations")
      .update({
        live_access: liveAccess,
        live_approved_at: liveAccess === "approved" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.org_id);
    if (orgError) throw new Error(orgError.message);

    if (data.decision === "approve" || data.decision === "decline") {
      await supabaseAdmin
        .from("org_applications")
        .update({
          status: data.decision === "approve" ? "approved" : "declined",
          reviewer_id: context.userId,
          reviewer_note: data.note ?? null,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("org_id", data.org_id)
        .in("status", ["draft", "pending"]);
    }

    await supabaseAdmin.from("audit_events").insert({
      org_id: data.org_id,
      actor_id: context.userId,
      action: `live_access.${data.decision}d`,
      entity_type: "organization",
      entity_id: data.org_id,
      detail: { note: data.note ?? null } as never,
    } as never);

    try {
      const { notifyOrg } = await import("@/lib/usage.server");
      await notifyOrg(data.org_id, "case.decision", {
        subject: "Live API access",
        reference: liveAccess,
        note: data.note ?? "",
        link: "/console/settings",
      });
    } catch {
      /* notifications never block the decision */
    }

    return { live_access: liveAccess };
  });
