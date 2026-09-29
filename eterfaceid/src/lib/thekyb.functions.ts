import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  mapAmlCategory,
  ownersFromTheKybProfile,
  registryCheckResult,
  summariseAmlHits,
} from "@/lib/thekyb";

async function ensureWriter(context: { supabase: any; userId: string }) {
  const { data: allowed } = await context.supabase.rpc("can_write", { _user_id: context.userId });
  if (!allowed) throw new Error("You do not have permission to make this change");
}

async function ensureEnabled(supabase: any) {
  const { data } = await supabase
    .from("integration_settings")
    .select("enabled")
    .eq("provider", "thekyb")
    .maybeSingle();
  if (!data?.enabled) throw new Error("The KYB is switched off. Turn it on in App admin.");
}

async function caseContext(supabase: any, caseId: string) {
  const { data } = await supabase
    .from("cases")
    .select("id, org_id, subject_name, country, reference, case_type")
    .eq("id", caseId)
    .maybeSingle();
  if (!data) throw new Error("That case could not be found");
  return data as {
    id: string;
    org_id: string;
    subject_name: string;
    country: string | null;
    reference: string;
    case_type: string;
  };
}

async function markUsed(supabase: any, error?: string | null) {
  await supabase
    .from("integration_settings")
    .update({
      last_checked_at: new Date().toISOString(),
      last_error: error ?? null,
      status: error ? "error" : "connected",
    })
    .eq("provider", "thekyb");
}

export const thekybStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { thekybConfigured } = await import("@/lib/thekyb.server");
    const { data } = await context.supabase
      .from("integration_settings")
      .select("enabled, last_checked_at, last_error")
      .eq("provider", "thekyb")
      .maybeSingle();
    return {
      enabled: Boolean(data?.enabled),
      configured: thekybConfigured(),
      lastCheckedAt: data?.last_checked_at ?? null,
      lastError: data?.last_error ?? null,
    };
  });

export const searchTheKyb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        name: z.string().trim().min(3).max(128).optional(),
        registrationNumber: z.string().trim().min(1).max(255).optional(),
        country: z.string().trim().max(40).optional(),
        searchType: z.enum(["contains", "start_with", "fuzzy"]).optional(),
      })
      .refine((v) => Boolean(v.name || v.registrationNumber), {
        message: "Provide a company name or a registration number",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);
    const { thekyb } = await import("@/lib/thekyb.server");
    try {
      const result = await thekyb.search({
        name: data.name ?? kase.subject_name,
        ...(data.registrationNumber ? { registrationNumber: data.registrationNumber } : {}),
        country: data.country ?? kase.country ?? "CA",
        ...(data.searchType ? { searchType: data.searchType } : {}),
      });
      await markUsed(context.supabase);
      await context.supabase.from("audit_events").insert({
        actor_id: context.userId,
        action: "thekyb.searched",
        entity_type: "case",
        entity_id: kase.id,
        detail: {
          kyb_request_id: result.kyb_request_id,
          hits: result.hits.length,
          country: data.country ?? kase.country,
        },
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "The KYB search failed";
      await markUsed(context.supabase, message);
      throw err;
    }
  });

async function importOwners(
  supabase: any,
  kase: { id: string; org_id: string },
  profile: Record<string, unknown>,
  userId: string,
) {
  const owners = ownersFromTheKybProfile(profile);
  if (!owners.length) return 0;
  const { data: existing } = await supabase
    .from("business_owners")
    .select("name")
    .eq("case_id", kase.id);
  const have = new Set(
    ((existing ?? []) as { name: string }[]).map((o) => o.name.trim().toLowerCase()),
  );
  const fresh = owners.filter((o) => !have.has(o.name.trim().toLowerCase()));
  if (!fresh.length) return 0;
  const { error } = await supabase.from("business_owners").insert(
    fresh.map((o) => ({
      case_id: kase.id,
      org_id: kase.org_id,
      name: o.name,
      entity_type: o.entity_type,
      ownership_pct: o.ownership_pct,
      control_role: o.control_role,
      country: o.country,
      is_ubo: o.is_ubo,
      control_basis: o.is_ubo ? "Imported from The KYB registry profile" : null,
    })) as never,
  );
  if (error) throw new Error(error.message);
  void userId;
  return fresh.length;
}

export const attachTheKybCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        kybResponseId: z.string().trim().min(2).max(80),
        kybRequestId: z.string().trim().max(80).optional(),
        name: z.string().trim().max(200).optional(),
        registrationNumber: z.string().trim().max(80).optional(),
        countryCode: z.string().trim().max(12).optional(),
        status: z.string().trim().max(80).optional(),
        type: z.string().trim().max(80).optional(),
        riskLevel: z.string().trim().max(40).optional(),
        verificationStatus: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);
    const { thekyb } = await import("@/lib/thekyb.server");

    let profile: Record<string, unknown> = {};
    try {
      const fetched = await thekyb.company(data.kybResponseId);
      profile = (fetched?.data ?? fetched ?? {}) as Record<string, unknown>;
      await markUsed(context.supabase);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The KYB profile fetch failed";
      await markUsed(context.supabase, message);
      throw err;
    }

    const companyName = String(profile["name"] ?? data.name ?? kase.subject_name);
    const status = String(profile["status"] ?? data.status ?? "");
    const verification = String(profile["verification_status"] ?? data.verificationStatus ?? "");
    const result = registryCheckResult(status, verification);

    const { data: saved, error } = await context.supabase
      .from("thekyb_profiles")
      .insert({
        case_id: kase.id,
        org_id: kase.org_id,
        kyb_request_id:
          data.kybRequestId ?? (profile["kyb_request_id"] as string | undefined) ?? null,
        kyb_response_id: data.kybResponseId,
        company_name: companyName,
        registration_number:
          (profile["registration_number"] as string | undefined) ?? data.registrationNumber ?? null,
        country_code:
          (profile["country_code"] as string | undefined) ?? data.countryCode ?? kase.country,
        company_status: status || null,
        company_type: (profile["type"] as string | undefined) ?? data.type ?? null,
        risk_level: (profile["risk_level"] as string | undefined) ?? data.riskLevel ?? null,
        verification_status: verification || null,
        fetch_status: (profile["fetch_status"] as string | undefined) ?? "resolved",
        profile: profile as never,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const imported = await importOwners(context.supabase, kase, profile, context.userId);

    await context.supabase.from("case_checks").insert({
      case_id: kase.id,
      category: "identity",
      name: `Registry KYB (${companyName})`,
      result,
      detail:
        [
          status && `Status: ${status}`,
          verification && `Verification: ${verification}`,
          imported ? `${imported} officer/owner record(s) imported` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Official registry profile attached",
      source: "thekyb",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "thekyb.attached",
      entity_type: "case",
      entity_id: kase.id,
      detail: { profile_id: saved.id, company: companyName, imported_owners: imported, result },
    });

    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, kase.org_id, "verifications");

    return { id: saved.id as string, result, imported, companyName };
  });

export const screenTheKybAml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        profileId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(128).optional(),
        entityType: z.enum(["Person", "Company", "Organization"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    await ensureEnabled(context.supabase);
    const kase = await caseContext(context.supabase, data.caseId);
    const { thekyb } = await import("@/lib/thekyb.server");

    let profile: any = null;
    if (data.profileId) {
      const { data: row } = await context.supabase
        .from("thekyb_profiles")
        .select("*")
        .eq("id", data.profileId)
        .maybeSingle();
      profile = row;
    }

    const subject = data.name ?? profile?.company_name ?? kase.subject_name;
    const entityType = data.entityType ?? (kase.case_type === "person" ? "Person" : "Company");

    let aml;
    try {
      aml = await thekyb.amlSearch({
        name: subject,
        country: profile?.country_code ?? kase.country ?? "CA",
        entityType,
      });
      await markUsed(context.supabase);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The KYB AML search failed";
      await markUsed(context.supabase, message);
      throw err;
    }

    const hits = summariseAmlHits(aml.rows, aml.match_status);
    const result =
      aml.match_status === "potential match" || hits.length
        ? hits.some((h) => h.categories.some((c) => mapAmlCategory(c) === "sanctions"))
          ? "fail"
          : "review"
        : "pass";

    if (profile) {
      await context.supabase
        .from("thekyb_profiles")
        .update({
          aml_request_id: aml.aml_request_id,
          aml_match_status: aml.match_status,
          aml_hits: hits as never,
        })
        .eq("id", profile.id);
    }

    const { data: run } = await context.supabase
      .from("screening_runs")
      .insert({
        case_id: kase.id,
        org_id: kase.org_id,
        subject_name: subject,
        subject_type: kase.case_type,
        country: kase.country,
        engine_version: "thekyb-aml",
        candidates_examined: aml.rows.length,
        hit_count: hits.length,
        threshold: 0.5,
      } as never)
      .select("id")
      .maybeSingle();

    if (hits.length) {
      await context.supabase.from("screening_hits").insert(
        hits.slice(0, 50).map((hit) => ({
          case_id: kase.id,
          org_id: kase.org_id,
          run_id: run?.id ?? null,
          list_name: "The KYB AML",
          matched_name: hit.name || subject,
          match_score: hit.match_score,
          category: mapAmlCategory(hit.categories[0] ?? ""),
          detail: hit.detail,
          reasons: hit.categories as never,
        })) as never,
      );
    }

    await context.supabase.from("case_checks").insert({
      case_id: kase.id,
      category: "sanctions",
      name: `The KYB AML (${subject})`,
      result,
      detail:
        aml.match_status === "no match" || !hits.length
          ? "No match on The KYB AML lists"
          : `${hits.length} potential match(es) · ${aml.match_status ?? "review"}`,
      source: "thekyb",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "thekyb.aml",
      entity_type: "case",
      entity_id: kase.id,
      detail: {
        aml_request_id: aml.aml_request_id,
        match_status: aml.match_status,
        hits: hits.length,
        result,
      },
    });

    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, kase.org_id, "screenings");

    return { amlRequestId: aml.aml_request_id, matchStatus: aml.match_status, hits, result };
  });
