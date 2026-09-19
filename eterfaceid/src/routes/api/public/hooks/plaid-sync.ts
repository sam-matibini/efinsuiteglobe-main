import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily bank activity import. Pulls new transactions for every active linked
 * bank and runs them through the monitoring rules. Called by the scheduler
 * with the shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/plaid-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronRequestAllowed } = await import("@/lib/cron-secret.server");
        if (!(await cronRequestAllowed(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { plaidConfigured } = await import("@/lib/plaid.server");

        const { data: setting } = await supabaseAdmin
          .from("integration_settings")
          .select("enabled")
          .eq("provider", "plaid")
          .maybeSingle();
        if (!setting?.enabled || !plaidConfigured()) {
          return Response.json({ skipped: "plaid is off or not configured" });
        }

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);

        const { data: items } = await supabaseAdmin
          .from("plaid_items")
          .select("id")
          .eq("status", "active")
          .order("last_synced_at", { ascending: true, nullsFirst: true })
          .limit(limit);

        const { syncPlaidItem } = await import("@/lib/plaid-sync.server");
        const results: { id: string; imported?: number; flagged?: number; error?: string }[] = [];
        for (const item of items ?? []) {
          try {
            const outcome = await syncPlaidItem(supabaseAdmin, item.id as string);
            results.push({ id: item.id as string, ...outcome });
          } catch (err) {
            results.push({ id: item.id as string, error: (err as Error).message });
          }
        }

        return Response.json({ items: results.length, results });
      },
    },
  },
});
