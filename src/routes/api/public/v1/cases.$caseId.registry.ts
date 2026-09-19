import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
  readJson,
} from "@/lib/api-gateway.server";
import {
  mapAmlCategory,
  ownersFromTheKybProfile,
  registryCheckResult,
  summariseAmlHits,
} from "@/lib/thekyb";

const schema = z
  .object({
    action: z.enum(["search", "attach", "aml"]).default("search"),
    name: z.string().trim().min(2).max(128).optional(),
    registration_number: z.string().trim().min(1).max(255).optional(),
    country: z.string().trim().max(40).optional(),
    kyb_response_id: z.string().trim().min(2).max(80).optional(),
    kyb_request_id: z.string().trim().max(80).optional(),
    profile_id: z.string().uuid().optional(),
  })
  .default({ action: "search" });

async function thekybEnabled(auth: { admin: any }) {
  const { data } = await auth.admin
    .from("integration_settings")
    .select("enabled")
    .eq("provider", "thekyb")
    .maybeSingle();
  return Boolean(data?.enabled);
}

export const Route = createFileRoute("/api/public/v1/cases/$caseId/registry")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data: profiles } = await auth.admin
          .from("thekyb_profiles")
          .select(
            "id, company_name, registration_number, country_code, company_status, company_type, risk_level, verification_status, aml_match_status, aml_hits, created_at",
          )
          .eq("case_id", params.caseId)
          .eq("org_id", auth.orgId)
          .order("created_at", { ascending: false });
        return jsonResponse({ data: { profiles: profiles ?? [] } });
      },
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;
        const record = await loadCase(auth, params.caseId, "id, subject_name, country, case_type");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);
        const kase = record as {
          id: string;
          subject_name: string;
          country: string | null;
          case_type: string;
        };

        if (auth.sandbox) {
          const { sandboxRegistrySearch, sandboxRegistryProfile, sandboxTheKybAml } =
            await import("@/lib/sandbox.server");
          if (parsed.data.action === "aml") {
            const aml = sandboxTheKybAml(parsed.data.name ?? kase.subject_name);
            await apiAudit(auth, "thekyb.aml", "case", params.caseId, { sandbox: true });
            return jsonResponse({ data: { sandbox: true, ...aml } });
          }
          if (parsed.data.action === "attach") {
            const profile = sandboxRegistryProfile(
              parsed.data.name ?? kase.subject_name,
              kase.country ?? "CA",
            );
            await apiAudit(auth, "thekyb.attached", "case", params.caseId, { sandbox: true });
            return jsonResponse({
              data: {
                sandbox: true,
                profile,
                owners: ownersFromTheKybProfile(profile),
                result: "pass",
              },
            });
          }
          await apiAudit(auth, "thekyb.searched", "case", params.caseId, { sandbox: true });
          return jsonResponse({
            data: {
              sandbox: true,
              ...sandboxRegistrySearch(
                parsed.data.name ?? kase.subject_name,
                parsed.data.country ?? kase.country ?? "CA",
              ),
            },
          });
        }

        if (!(await thekybEnabled(auth))) {
          return jsonResponse(
            {
              error: "integration_disabled",
              message: "The KYB add-on is switched off for this platform.",
            },
            409,
          );
        }

        const { thekyb, thekybConfigured } = await import("@/lib/thekyb.server");
        if (!thekybConfigured()) {
          return jsonResponse(
            {
              error: "integration_not_configured",
              message: "The KYB credentials have not been added yet.",
            },
            409,
          );
        }

        try {
          if (parsed.data.action === "search") {
            const result = await thekyb.search({
              name: parsed.data.name ?? kase.subject_name,
              ...(parsed.data.registration_number
                ? { registrationNumber: parsed.data.registration_number }
                : {}),
              country: parsed.data.country ?? kase.country ?? "CA",
            });
            await apiAudit(auth, "thekyb.searched", "case", params.caseId, {
              kyb_request_id: result.kyb_request_id,
              hits: result.hits.length,
            });
            return jsonResponse({ data: result });
          }

          if (parsed.data.action === "attach") {
            if (!parsed.data.kyb_response_id) {
              return jsonResponse(
                {
                  error: "invalid_request",
                  message: "kyb_response_id is required to attach a company.",
                },
                422,
              );
            }
            const fetched = await thekyb.company(parsed.data.kyb_response_id);
            const profile = (fetched?.data ?? fetched ?? {}) as Record<string, unknown>;
            const companyName = String(profile["name"] ?? parsed.data.name ?? kase.subject_name);
            const status = String(profile["status"] ?? "");
            const verification = String(profile["verification_status"] ?? "");
            const result = registryCheckResult(status, verification);

            const { data: saved, error } = await auth.admin
              .from("thekyb_profiles")
              .insert({
                org_id: auth.orgId,
                case_id: params.caseId,
                kyb_request_id:
                  parsed.data.kyb_request_id ??
                  (profile["kyb_request_id"] as string | undefined) ??
                  null,
                kyb_response_id: parsed.data.kyb_response_id,
                company_name: companyName,
                registration_number:
                  (profile["registration_number"] as string | undefined) ??
                  parsed.data.registration_number ??
                  null,
                country_code: (profile["country_code"] as string | undefined) ?? kase.country,
                company_status: status || null,
                company_type: (profile["type"] as string | undefined) ?? null,
                risk_level: (profile["risk_level"] as string | undefined) ?? null,
                verification_status: verification || null,
                fetch_status: (profile["fetch_status"] as string | undefined) ?? "resolved",
                profile: profile as never,
              } as never)
              .select("id")
              .single();
            if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

            const owners = ownersFromTheKybProfile(profile);
            if (owners.length) {
              await auth.admin.from("business_owners").insert(
                owners.map((o) => ({
                  case_id: params.caseId,
                  org_id: auth.orgId,
                  name: o.name,
                  entity_type: o.entity_type,
                  ownership_pct: o.ownership_pct,
                  control_role: o.control_role,
                  country: o.country,
                  is_ubo: o.is_ubo,
                  control_basis: o.is_ubo ? "Imported from The KYB registry profile" : null,
                })) as never,
              );
            }

            await auth.admin.from("case_checks").insert({
              case_id: params.caseId,
              org_id: auth.orgId,
              category: "identity",
              name: `Registry KYB (${companyName})`,
              result,
              detail: status ? `Status: ${status}` : "Official registry profile attached",
              source: "thekyb",
            } as never);

            await apiAudit(auth, "thekyb.attached", "case", params.caseId, {
              profile_id: (saved as any).id,
              company: companyName,
            });
            return jsonResponse(
              { data: { id: (saved as any).id, result, owners, company_name: companyName } },
              201,
            );
          }

          const subject = parsed.data.name ?? kase.subject_name;
          const aml = await thekyb.amlSearch({
            name: subject,
            country: parsed.data.country ?? kase.country ?? "CA",
            entityType: kase.case_type === "person" ? "Person" : "Company",
          });
          const hits = summariseAmlHits(aml.rows, aml.match_status);
          const result =
            aml.match_status === "potential match" || hits.length
              ? hits.some((h) => h.categories.some((c) => mapAmlCategory(c) === "sanctions"))
                ? "fail"
                : "review"
              : "pass";

          if (parsed.data.profile_id) {
            await auth.admin
              .from("thekyb_profiles")
              .update({
                aml_request_id: aml.aml_request_id,
                aml_match_status: aml.match_status,
                aml_hits: hits as never,
              })
              .eq("id", parsed.data.profile_id)
              .eq("org_id", auth.orgId);
          }

          await auth.admin.from("case_checks").insert({
            case_id: params.caseId,
            org_id: auth.orgId,
            category: "sanctions",
            name: `The KYB AML (${subject})`,
            result,
            detail:
              hits.length === 0
                ? "No match on The KYB AML lists"
                : `${hits.length} potential match(es) · ${aml.match_status ?? "review"}`,
            source: "thekyb",
          } as never);

          await apiAudit(auth, "thekyb.aml", "case", params.caseId, {
            aml_request_id: aml.aml_request_id,
            match_status: aml.match_status,
          });
          return jsonResponse({
            data: {
              aml_request_id: aml.aml_request_id,
              match_status: aml.match_status,
              hits,
              result,
            },
          });
        } catch (err) {
          return jsonResponse(
            {
              error: "registry_failed",
              message: err instanceof Error ? err.message : "The KYB request failed",
            },
            502,
          );
        }
      },
    },
  },
});
