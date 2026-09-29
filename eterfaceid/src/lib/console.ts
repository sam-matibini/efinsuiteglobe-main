import { supabase } from "@/integrations/supabase/client";

export type CaseType = "person" | "business";
export type CaseStatus = "pending" | "in_review" | "approved" | "rejected";
export type RiskLevel = "low" | "medium" | "high";
export type AppRole = "admin" | "analyst" | "viewer";

export const statusLabel: Record<CaseStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const categoryLabel: Record<string, string> = {
  sanctions: "Sanctions",
  pep: "PEP",
  rca: "RCA",
  watchlist: "Watchlist",
  adverse_media: "Adverse media",
};

export async function fetchCases() {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchCase(id: string) {
  const [caseRow, checks, owners, hits, alerts] = await Promise.all([
    supabase.from("cases").select("*").eq("id", id).maybeSingle(),
    supabase.from("case_checks").select("*").eq("case_id", id).order("checked_at"),
    supabase.from("business_owners").select("*").eq("case_id", id).order("ownership_pct", { ascending: false }),
    supabase.from("screening_hits").select("*").eq("case_id", id).order("match_score", { ascending: false }),
    supabase.from("monitoring_alerts").select("*").eq("case_id", id).order("created_at", { ascending: false }),
  ]);
  const err = caseRow.error ?? checks.error ?? owners.error ?? hits.error ?? alerts.error;
  if (err) throw err;
  return {
    record: caseRow.data,
    checks: checks.data ?? [],
    owners: owners.data ?? [],
    hits: hits.data ?? [],
    alerts: alerts.data ?? [],
  };
}

export async function fetchAlerts() {
  const { data, error } = await supabase
    .from("monitoring_alerts")
    .select("*, cases(reference, subject_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAuditEvents() {
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function fetchTeam() {
  const [members, profiles, invites] = await Promise.all([
    supabase.from("organization_members").select("user_id, role, created_at"),
    supabase.from("profiles").select("*"),
    supabase
      .from("organization_invites")
      .select("*")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (members.error) throw members.error;
  if (profiles.error) throw profiles.error;
  if (invites.error) throw invites.error;
  return {
    members: (members.data ?? []).map((m) => {
      const profile = (profiles.data ?? []).find((p) => p.id === m.user_id);
      return {
        userId: m.user_id,
        role: m.role as AppRole,
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
      };
    }),
    invites: invites.data ?? [],
  };
}


export async function fetchApiKeys() {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchWatchlistSources() {
  const { data, error } = await supabase
    .from("watchlist_sources")
    .select("*")
    .order("category")
    .order("title");
  if (error) throw error;
  return data;
}

export async function fetchWatchlistVersions() {
  const { data, error } = await supabase
    .from("watchlist_versions")
    .select("*, watchlist_sources(title, code)")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function fetchScreeningRuns(caseId: string) {
  const { data, error } = await supabase
    .from("screening_runs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null,
  detail: Record<string, unknown> = {},
) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_events").insert({
    actor_id: data.user.id,
    actor_email: data.user.email ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail: detail as never,
  });
}

export async function fetchTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, cases(reference, subject_name), transaction_alerts(*)")
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function fetchReports() {
  const { data, error } = await supabase
    .from("regulatory_reports")
    .select("*, cases(reference, subject_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function fetchWebhookEndpoints() {
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchWebhookDeliveries() {
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
