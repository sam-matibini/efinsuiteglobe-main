/**
 * Verification work that runs without a signed-in reviewer: the public API
 * and the hosted verification link both come through here. The rules are the
 * same ones the console uses — only the caller differs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { parseMrz } from "@/lib/mrz";
import { validateDocument, documentResult, toIso2, type DocCheck } from "@/lib/document-rules";

type Client = SupabaseClient<Database>;

export type DocumentInput = {
  docType: string;
  mrz?: string | null;
  issuingCountry?: string | null;
  issuingRegion?: string | null;
  documentNumber?: string | null;
  surname?: string | null;
  givenNames?: string | null;
  birthDate?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
};

export type SelfieSignals = {
  framesCaptured: number;
  challengePassed: boolean;
  motionVariance: number;
  brightnessRange: number;
  blurScore: number;
  faceStable: boolean;
};

/** Finds the open session for a case, or opens one. */
export async function openSession(admin: Client, caseId: string, orgId: string) {
  const { data: existing } = await admin
    .from("verification_sessions")
    .select("id")
    .eq("case_id", caseId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await admin
    .from("verification_sessions")
    .insert({ case_id: caseId, org_id: orgId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function processDocument(
  admin: Client,
  args: { caseId: string; orgId: string; sessionId?: string; input: DocumentInput },
) {
  const { data: kase } = await admin
    .from("cases")
    .select("id, subject_name, country")
    .eq("id", args.caseId)
    .maybeSingle();
  if (!kase) throw new Error("Case not found");

  const input = args.input;
  const mrz = input.mrz?.trim() ? parseMrz(input.mrz) : null;

  const merged = {
    docType: input.docType,
    issuingCountry: toIso2(input.issuingCountry ?? mrz?.issuingCountry ?? null),
    issuingRegion: input.issuingRegion ?? null,
    documentNumber: input.documentNumber ?? mrz?.documentNumber ?? null,
    surname: input.surname ?? mrz?.surname ?? null,
    givenNames: input.givenNames ?? mrz?.givenNames ?? null,
    birthDate: input.birthDate ?? mrz?.birthDate ?? null,
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate ?? mrz?.expiryDate ?? null,
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
    ...validateDocument(merged, { fullName: (kase as any).subject_name, country: (kase as any).country }),
  ];
  const result = documentResult(checks);
  const sessionId = args.sessionId ?? (await openSession(admin, args.caseId, args.orgId));

  const { data: inserted, error } = await admin
    .from("documents")
    .insert({
      case_id: args.caseId,
      org_id: args.orgId,
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
      mrz_raw: input.mrz ?? null,
      mrz_valid: merged.mrzValid,
      checks: checks as never,
      result,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("case_checks").insert({
    case_id: args.caseId,
    org_id: args.orgId,
    category: "document",
    name: `${merged.docType} verification`,
    result,
    detail: checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || "All document checks passed",
    source: "eterfaceID document engine",
  } as never);

  return { documentId: (inserted as any).id as string, sessionId, result, checks, parsed: merged };
}

export function livenessScore(s: SelfieSignals) {
  let liveness = 0;
  if (s.challengePassed) liveness += 0.45;
  if (s.framesCaptured >= 12) liveness += 0.15;
  if (s.motionVariance > 0.02 && s.motionVariance < 0.6) liveness += 0.2;
  if (s.brightnessRange > 0.03) liveness += 0.1;
  if (s.blurScore < 0.5) liveness += 0.1;
  if (s.faceStable) liveness += 0.05;
  return Math.max(0, Math.min(1, liveness));
}

export async function processSelfie(
  admin: Client,
  args: {
    caseId: string;
    orgId: string;
    sessionId?: string;
    documentId?: string | null;
    challenge: string;
    signals: SelfieSignals;
  },
) {
  const liveness = livenessScore(args.signals);
  const result = liveness >= 0.75 ? "pass" : liveness >= 0.5 ? "review" : "fail";
  const sessionId = args.sessionId ?? (await openSession(admin, args.caseId, args.orgId));

  const { data: inserted, error } = await admin
    .from("selfies")
    .insert({
      case_id: args.caseId,
      org_id: args.orgId,
      session_id: sessionId,
      document_id: args.documentId ?? null,
      challenge: args.challenge,
      liveness_score: liveness,
      liveness_signals: args.signals as never,
      face_match_status: "reviewer_required",
      quality: { blur: args.signals.blurScore, brightness_range: args.signals.brightnessRange } as never,
      result,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await admin.from("case_checks").insert({
    case_id: args.caseId,
    org_id: args.orgId,
    category: "biometrics",
    name: "Liveness check",
    result,
    detail: `Liveness score ${(liveness * 100).toFixed(0)} out of 100 (challenge: ${args.challenge})`,
    source: "eterfaceID liveness engine",
  } as never);

  return { selfieId: (inserted as any).id as string, sessionId, liveness, result };
}
