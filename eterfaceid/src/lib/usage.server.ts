import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Counts one billable action against the company's current month. Never throws. */
export async function recordUsage(
  supabase: Client,
  orgId: string | null | undefined,
  kind: "verifications" | "screenings" | "transactions",
  amount = 1,
) {
  if (!orgId) return;
  try {
    await (supabase as any).rpc("bump_usage", { _org: orgId, _kind: kind, _amount: amount });
  } catch {
    /* usage counting must never block the action */
  }
}

/** Sends an org-wide notification without ever failing the caller. */
export async function notifyOrg(
  orgId: string,
  event: "case.decision" | "alert.opened" | "screening.hit" | "report.filed",
  data: Record<string, string>,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendNotification, orgNotifyRecipients } = await import("@/lib/email.server");
    const recipients = await orgNotifyRecipients(supabaseAdmin, orgId);
    if (!recipients.length) return;
    await sendNotification(supabaseAdmin, { event, to: recipients, orgId, data });
  } catch {
    /* notifications never block the action */
  }
}
