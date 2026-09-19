/** Shared authorisation for scheduled job endpoints. */
export async function cronRequestAllowed(request: Request) {
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!provided) return false;
  const envSecret = process.env["LOVABLE_CRON_SECRET"] ?? "";
  if (envSecret && provided === envSecret) return true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("cron_secret").limit(1).maybeSingle();
    const stored = (data as { cron_secret?: string } | null)?.cron_secret ?? "";
    return Boolean(stored) && provided === stored;
  } catch {
    return false;
  }
}
