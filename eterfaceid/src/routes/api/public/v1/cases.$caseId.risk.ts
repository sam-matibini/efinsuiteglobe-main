import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  countUsage,
  jsonResponse,
  loadCase,
  readJson,
} from "@/lib/api-gateway.server";
import { toIso2 } from "@/lib/document-rules";
import { assessPhone, combineRisk, deviceFactors, emailFactors, type RiskFactor } from "@/lib/risk-signals";
import { openSession } from "@/lib/verification-core.server";

const schema = z.object({
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  ip_address: z.string().trim().max(60).optional(),
  ip_country: z.string().trim().max(3).optional(),
  timezone: z.string().trim().max(80).optional(),
  fingerprint: z.string().trim().max(200).optional(),
  user_agent: z.string().trim().max(400).optional(),
  languages: z.array(z.string().max(20)).max(20).optional(),
  is_vpn: z.boolean().optional(),
  is_tor: z.boolean().optional(),
  is_datacenter: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/risk")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const record = await loadCase(auth, params.caseId, "id, risk_score, risk_level");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);
        const { data: factors } = await auth.admin
          .from("risk_factors")
          .select("category, code, label, weight, detail, source")
          .eq("case_id", params.caseId);
        return jsonResponse({
          data: { score: (record as any).risk_score, level: (record as any).risk_level, factors: factors ?? [] },
        });
      },
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;
        const record = await loadCase(auth, params.caseId, "id, country");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);
        const body = parsed.data;

        const claimedCountry = toIso2((record as any).country);
        const sessionId = await openSession(auth.admin, params.caseId, auth.orgId);

        let repeatDeviceCases = 0;
        let velocity24h = 0;
        if (body.fingerprint) {
          const { data: seen } = await auth.admin
            .from("device_signals")
            .select("case_id, created_at")
            .eq("fingerprint", body.fingerprint)
            .eq("org_id", auth.orgId);
          const rows = (seen ?? []) as any[];
          repeatDeviceCases = new Set(rows.map((r) => r.case_id).filter((id) => id !== params.caseId)).size;
          const cutoff = Date.now() - 86_400_000;
          velocity24h = rows.filter((r) => Date.parse(r.created_at) > cutoff).length;
        }

        const phone = assessPhone(body.phone ?? null, claimedCountry);
        const deviceInput = {
          fingerprint: body.fingerprint ?? null,
          userAgent: body.user_agent ?? null,
          timezone: body.timezone ?? null,
          languages: body.languages ?? null,
          ipAddress: body.ip_address ?? null,
          ipCountry: toIso2(body.ip_country),
          claimedCountry,
          repeatDeviceCases,
          velocity24h,
          isVpn: body.is_vpn ?? false,
          isTor: body.is_tor ?? false,
          isDatacenter: body.is_datacenter ?? false,
        };

        await auth.admin.from("device_signals").insert({
          case_id: params.caseId,
          org_id: auth.orgId,
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
        } as never);

        const factors: RiskFactor[] = [
          ...emailFactors(body.email ?? null),
          ...phone.factors,
          ...deviceFactors(deviceInput),
        ];

        const { data: docs } = await auth.admin
          .from("documents")
          .select("doc_type, result")
          .eq("case_id", params.caseId);
        for (const doc of (docs ?? []) as any[]) {
          if (doc.result === "fail") {
            factors.push({ category: "document", code: "document_failed", label: `${doc.doc_type} failed verification`, weight: 35 });
          } else if (doc.result === "review") {
            factors.push({ category: "document", code: "document_review", label: `${doc.doc_type} needs a reviewer`, weight: 12 });
          } else if (doc.result === "pass") {
            factors.push({ category: "document", code: "document_passed", label: `${doc.doc_type} verified`, weight: -8 });
          }
        }

        const { data: hits } = await auth.admin
          .from("screening_hits")
          .select("category, disposition")
          .eq("case_id", params.caseId);
        for (const hit of (hits ?? []) as any[]) {
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
        await auth.admin.from("risk_factors").delete().eq("case_id", params.caseId);
        if (factors.length) {
          await auth.admin.from("risk_factors").insert(
            factors.map((f) => ({
              case_id: params.caseId,
              org_id: auth.orgId,
              category: f.category,
              code: f.code,
              label: f.label,
              weight: f.weight,
              detail: f.detail ?? null,
              source: f.source ?? "in-house",
            })) as never,
          );
        }
        await auth.admin
          .from("cases")
          .update({ risk_score: score, risk_level: level as never } as never)
          .eq("id", params.caseId);

        await apiAudit(auth, "risk.assessed", "case", params.caseId, { score, level, factor_count: factors.length });
        await countUsage(auth, "verifications");

        return jsonResponse({ data: { score, level, factors, phone } });
      },
    },
  },
});
