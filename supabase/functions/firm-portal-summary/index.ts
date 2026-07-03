import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: ud } = await supabase.auth.getUser();
    if (!ud?.user) return j({ error: "Unauthorized" }, 401);

    const { workspace_id } = await req.json();
    if (!workspace_id) return j({ error: "Missing workspace_id" }, 400);

    // Verify user is a member of this firm workspace
    const { data: ws } = await supabase
      .from("firm_workspaces")
      .select("id, owner_user_id, name")
      .eq("id", workspace_id)
      .maybeSingle();
    if (!ws) return j({ error: "Workspace not found" }, 404);
    if (ws.owner_user_id !== ud.user.id) {
      const { data: m } = await supabase
        .from("firm_workspace_members")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", ud.user.id)
        .maybeSingle();
      if (!m) return j({ error: "Not a member of this workspace" }, 403);
    }

    const { data: links } = await supabase
      .from("firm_client_links")
      .select("organization_id, linked_at")
      .eq("workspace_id", workspace_id);

    const orgIds = (links ?? []).map((l: { organization_id: string }) => l.organization_id);
    if (orgIds.length === 0) return j({ ok: true, workspace: ws, clients: [] });

    const [{ data: orgs }, { data: alerts }, { data: closes }, { data: consol }, { data: exports }] = await Promise.all([
      supabase.from("organizations").select("id, name").in("id", orgIds),
      supabase.from("treasury_alerts").select("organization_id, severity, acknowledged_at").in("organization_id", orgIds),
      supabase.from("treasury_period_close").select("organization_id, due_date, status").in("organization_id", orgIds).neq("status", "closed"),
      supabase.from("consolidation_runs").select("organization_id, created_at").in("organization_id", orgIds).order("created_at", { ascending: false }),
      supabase.from("auditor_export_runs").select("organization_id, created_at").in("organization_id", orgIds).order("created_at", { ascending: false }),
    ]);

    const summary = orgIds.map((id: string) => {
      const orgName = (orgs ?? []).find((o: { id: string }) => o.id === id)?.name ?? "—";
      const openAlerts = (alerts ?? []).filter((a: any) => a.organization_id === id && !a.acknowledged_at).length;
      const criticalAlerts = (alerts ?? []).filter((a: any) => a.organization_id === id && !a.acknowledged_at && (a.severity === "critical" || a.severity === "high")).length;
      const upcoming = (closes ?? []).filter((c: any) => c.organization_id === id).sort((a: any, b: any) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0]?.due_date ?? null;
      const lastConsol = (consol ?? []).find((c: any) => c.organization_id === id)?.created_at ?? null;
      const lastExport = (exports ?? []).find((e: any) => e.organization_id === id)?.created_at ?? null;
      return { organization_id: id, name: orgName, open_alerts: openAlerts, critical_alerts: criticalAlerts, next_due_date: upcoming, last_consolidation_at: lastConsol, last_export_at: lastExport };
    });

    return j({ ok: true, workspace: ws, clients: summary });
  } catch (e) {
    console.error("firm-portal-summary", e);
    return j({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
