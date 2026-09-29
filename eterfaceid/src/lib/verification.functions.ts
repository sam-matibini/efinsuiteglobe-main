import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseMrz } from "@/lib/mrz";
import { validateDocument, documentResult, toIso2, type DocCheck } from "@/lib/document-rules";
import {
  assessPhone,
  combineRisk,
  deviceFactors,
  emailFactors,
  type RiskFactor,
} from "@/lib/risk-signals";

async function ensureWriter(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("can_write", { _user_id: context.userId });
  if (!data) throw new Error("You need analyst or administrator access to do this.");
}

async function getOrCreateSession(context: { supabase: any; userId: string }, caseId: string) {
  const { data: existing } = await context.supabase
    .from("verification_sessions")
    .select("id")
    .eq("case_id", caseId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await context.supabase
    .from("verification_sessions")
    .insert({ case_id: caseId, created_by: context.userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/* ------------------------------------------------------------- documents */

export const submitDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      docType: string;
      mrz?: string | undefined;
      issuingCountry?: string | undefined;
      issuingRegion?: string | undefined;
      documentNumber?: string | undefined;
      surname?: string | undefined;
      givenNames?: string | undefined;
      birthDate?: string | undefined;
      issueDate?: string | undefined;
      expiryDate?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);

    const { data: kase, error: caseError } = await context.supabase
      .from("cases")
      .select("id, subject_name, country")
      .eq("id", data.caseId)
      .single();
    if (caseError) throw new Error(caseError.message);

    const mrz = data.mrz?.trim() ? parseMrz(data.mrz) : null;

    const merged = {
      docType: data.docType,
      issuingCountry: toIso2(data.issuingCountry ?? mrz?.issuingCountry ?? null),
      issuingRegion: data.issuingRegion ?? null,
      documentNumber: data.documentNumber ?? mrz?.documentNumber ?? null,
      surname: data.surname ?? mrz?.surname ?? null,
      givenNames: data.givenNames ?? mrz?.givenNames ?? null,
      birthDate: data.birthDate ?? mrz?.birthDate ?? null,
      issueDate: data.issueDate ?? null,
      expiryDate: data.expiryDate ?? mrz?.expiryDate ?? null,
      mrzValid: mrz ? mrz.valid : null,
    };

    const mrzChecks: DocCheck[] = (mrz?.checks ?? []).map((c) => ({
      name: c.name,
      ok: c.ok,
      severity: c.ok ? ("info" as const) : ("fail" as const),
      ...(c.detail ? { detail: c.detail } : {}),
    }));

    const checks = [
      ...mrzChecks,
      ...validateDocument(merged, { fullName: kase.subject_name, country: kase.country }),
    ];
    const result = documentResult(checks);
    const sessionId = await getOrCreateSession(context, data.caseId);

    const { data: inserted, error } = await context.supabase
      .from("documents")
      .insert({
        case_id: data.caseId,
        session_id: sessionId,
        doc_type: merged.docType,
        issuing_country: merged.issuingCountry,
        issuing_region: merged.issuingRegion,
        document_number: merged.documentNumber,
        surname: merged.surname,
        given_names: merged.givenNames,
        birth_date: merged.birthDate,
        issue_date: merged.issueDate,
        expiry_date: merged.expiryDate,
        mrz_raw: data.mrz ?? null,
        mrz_valid: merged.mrzValid,
        checks,
        result,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("case_checks").insert({
      case_id: data.caseId,
      category: "document",
      name: `${data.docType} verification`,
      result,
      detail: checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || "All document checks passed",
      source: "eterfaceID document engine",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "document.verified",
      entity_type: "document",
      entity_id: inserted.id,
      detail: { case_id: data.caseId, result, mrz_valid: merged.mrzValid },
    });

    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, (kase as any)?.org_id, "verifications");

    return { documentId: inserted.id as string, result, checks, parsed: merged, mrz };
  });

/* ---------------------------------------------------- selfie and liveness */

export const submitSelfie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      documentId?: string | undefined;
      challenge: string;
      signals: {
        framesCaptured: number;
        challengePassed: boolean;
        motionVariance: number;
        brightnessRange: number;
        blurScore: number;
        faceStable: boolean;
      };
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const s = data.signals;

    // Passive liveness: reward natural variation, punish a static or replayed image.
    let liveness = 0;
    if (s.challengePassed) liveness += 0.45;
    if (s.framesCaptured >= 12) liveness += 0.15;
    if (s.motionVariance > 0.02 && s.motionVariance < 0.6) liveness += 0.2;
    if (s.brightnessRange > 0.03) liveness += 0.1;
    if (s.blurScore < 0.5) liveness += 0.1;
    if (s.faceStable) liveness += 0.05;
    liveness = Math.max(0, Math.min(1, liveness));

    const result = liveness >= 0.75 ? "pass" : liveness >= 0.5 ? "review" : "fail";
    const sessionId = await getOrCreateSession(context, data.caseId);

    const { data: inserted, error } = await context.supabase
      .from("selfies")
      .insert({
        case_id: data.caseId,
        session_id: sessionId,
        document_id: data.documentId ?? null,
        challenge: data.challenge,
        liveness_score: liveness,
        liveness_signals: s,
        face_match_status: "reviewer_required",
        quality: { blur: s.blurScore, brightness_range: s.brightnessRange },
        result,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("case_checks").insert({
      case_id: data.caseId,
      category: "biometrics",
      name: "Liveness check",
      result,
      detail: `Liveness score ${(liveness * 100).toFixed(0)} out of 100 (challenge: ${data.challenge})`,
      source: "eterfaceID liveness engine",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "selfie.captured",
      entity_type: "selfie",
      entity_id: inserted.id,
      detail: { case_id: data.caseId, liveness, result },
    });

    const { data: selfieCase } = await context.supabase
      .from("cases")
      .select("org_id")
      .eq("id", data.caseId)
      .maybeSingle();
    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, (selfieCase as any)?.org_id, "verifications");

    return { selfieId: inserted.id as string, liveness, result };
  });

/** A reviewer confirms or rejects that the selfie is the person on the document. */
export const decideFaceMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { selfieId: string; decision: "match" | "no_match" }) => input)
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const { data: updated, error } = await context.supabase
      .from("selfies")
      .update({
        face_match_status: data.decision,
        face_match_score: data.decision === "match" ? 1 : 0,
      })
      .eq("id", data.selfieId)
      .select("id, case_id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "selfie.face_match_decided",
      entity_type: "selfie",
      entity_id: data.selfieId,
      detail: { case_id: updated.case_id, decision: data.decision },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------- risk scoring */

export const runRiskAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseId: string;
      email?: string | undefined;
      phone?: string | undefined;
      ipAddress?: string | undefined;
      ipCountry?: string | undefined;
      timezone?: string | undefined;
      fingerprint?: string | undefined;
      userAgent?: string | undefined;
      languages?: string[] | undefined;
      isVpn?: boolean | undefined;
      isTor?: boolean | undefined;
      isDatacenter?: boolean | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);

    const { data: kase, error: caseError } = await context.supabase
      .from("cases")
      .select("id, country, risk_score")
      .eq("id", data.caseId)
      .single();
    if (caseError) throw new Error(caseError.message);

    const claimedCountry = toIso2(kase.country);
    const sessionId = await getOrCreateSession(context, data.caseId);

    // How often has this device been seen, and how busy has it been?
    let repeatDeviceCases = 0;
    let velocity24h = 0;
    if (data.fingerprint) {
      const { data: seen } = await context.supabase
        .from("device_signals")
        .select("case_id, created_at")
        .eq("fingerprint", data.fingerprint);
      const rows = seen ?? [];
      repeatDeviceCases = new Set(rows.map((r: { case_id: string }) => r.case_id).filter((id: string) => id !== data.caseId)).size;
      const cutoff = Date.now() - 86_400_000;
      velocity24h = rows.filter((r: { created_at: string }) => Date.parse(r.created_at) > cutoff).length;
    }

    const phone = assessPhone(data.phone ?? null, claimedCountry);
    const deviceInput = {
      fingerprint: data.fingerprint ?? null,
      userAgent: data.userAgent ?? null,
      timezone: data.timezone ?? null,
      languages: data.languages ?? null,
      ipAddress: data.ipAddress ?? null,
      ipCountry: toIso2(data.ipCountry),
      claimedCountry,
      repeatDeviceCases,
      velocity24h,
      isVpn: data.isVpn ?? false,
      isTor: data.isTor ?? false,
      isDatacenter: data.isDatacenter ?? false,
    };

    await context.supabase.from("device_signals").insert({
      case_id: data.caseId,
      session_id: sessionId,
      fingerprint: deviceInput.fingerprint,
      user_agent: deviceInput.userAgent,
      timezone: deviceInput.timezone,
      languages: deviceInput.languages,
      ip_address: deviceInput.ipAddress,
      ip_country: deviceInput.ipCountry,
      claimed_country: claimedCountry,
      is_vpn: deviceInput.isVpn,
      is_tor: deviceInput.isTor,
      is_datacenter: deviceInput.isDatacenter,
      repeat_device_cases: repeatDeviceCases,
      velocity_24h: velocity24h,
    });

    const factors: RiskFactor[] = [
      ...emailFactors(data.email ?? null),
      ...phone.factors,
      ...deviceFactors(deviceInput),
    ];

    // Documents and screening already recorded on the case feed into the score.
    const { data: docs } = await context.supabase
      .from("documents")
      .select("doc_type, result")
      .eq("case_id", data.caseId);
    for (const doc of docs ?? []) {
      if (doc.result === "fail") {
        factors.push({ category: "document", code: "document_failed", label: `${doc.doc_type} failed verification`, weight: 35 });
      } else if (doc.result === "review") {
        factors.push({ category: "document", code: "document_review", label: `${doc.doc_type} needs a reviewer`, weight: 12 });
      } else if (doc.result === "pass") {
        factors.push({ category: "document", code: "document_passed", label: `${doc.doc_type} verified`, weight: -8 });
      }
    }

    const { data: hits } = await context.supabase
      .from("screening_hits")
      .select("category, disposition")
      .eq("case_id", data.caseId);
    for (const hit of hits ?? []) {
      if (hit.disposition === "false_positive") continue;
      const weight = hit.category === "sanctions" ? 45 : hit.category === "pep" ? 20 : 12;
      factors.push({
        category: "screening",
        code: `hit_${hit.category}`,
        label: `Open ${hit.category} match on a watchlist`,
        weight,
      });
    }

    const { score, level } = combineRisk(factors);

    await context.supabase.from("risk_factors").delete().eq("case_id", data.caseId);
    if (factors.length) {
      await context.supabase.from("risk_factors").insert(
        factors.map((f) => ({
          case_id: data.caseId,
          category: f.category,
          code: f.code,
          label: f.label,
          weight: f.weight,
          detail: f.detail ?? null,
          source: f.source ?? "in-house",
        })),
      );
    }

    await context.supabase.from("cases").update({ risk_score: score, risk_level: level }).eq("id", data.caseId);

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "risk.assessed",
      entity_type: "case",
      entity_id: data.caseId,
      detail: { score, level, factor_count: factors.length },
    });

    const { data: riskCase } = await context.supabase
      .from("cases")
      .select("org_id")
      .eq("id", data.caseId)
      .maybeSingle();
    const { recordUsage } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, (riskCase as any)?.org_id, "verifications");

    return { score, level, factors, phone };
  });

/* ------------------------------------------------------- case decisions */

/**
 * Approve or reject a case. Runs server-side so the decision, the audit
 * entry and the notification always happen together.
 */
export const decideCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { caseId: string; status: "pending" | "in_review" | "approved" | "rejected"; note?: string | undefined }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const note = (data.note ?? "").trim().slice(0, 1000);

    const { data: updated, error } = await context.supabase
      .from("cases")
      .update({ status: data.status, decision_note: note || null })
      .eq("id", data.caseId)
      .select("id, org_id, reference, subject_name, assigned_to, created_by")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "case.decision",
      entity_type: "case",
      entity_id: data.caseId,
      detail: { status: data.status, note },
    });

    if (data.status === "approved" || data.status === "rejected") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendNotification } = await import("@/lib/email.server");
        const ids = [updated.assigned_to, updated.created_by].filter(
          (id): id is string => Boolean(id),
        );
        const unique = [...new Set(ids)];
        if (unique.length) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .in("id", unique);
          const to = (profiles ?? []).map((p) => p.email).filter((e): e is string => Boolean(e));
          if (to.length) {
            await sendNotification(supabaseAdmin, {
              event: "case.decision",
              to,
              orgId: updated.org_id as string,
              data: {
                reference: updated.reference ?? "",
                subject: updated.subject_name ?? "",
                decision: data.status,
                note,
                link: `/console/cases/${data.caseId}`,
              },
            });
          }
        }
      } catch {
        /* notifications never block a decision */
      }
    }

    return { ok: true, status: data.status };
  });
