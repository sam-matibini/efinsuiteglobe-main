import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function resolvePlatformSecret(secretName: string): Promise<string> {
  const fromEnv = Deno.env.get(secretName)?.trim() ?? "";
  if (fromEnv) return fromEnv;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return "";
  const supabase = createClient(url, serviceKey);
  const { data } = await supabase
    .from("platform_api_keys")
    .select("secret_value")
    .eq("secret_name", secretName)
    .eq("enabled", true)
    .maybeSingle();
  const platformKey = String(data?.secret_value ?? "").trim();
  if (platformKey) return platformKey;
  const organizationKey = await supabase
    .from("organization_api_credentials")
    .select("api_key")
    .eq("secret_name", secretName)
    .neq("status", "disabled")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const organizationSecret = String(organizationKey.data?.api_key ?? "").trim();
  if (organizationSecret) return organizationSecret;
  const stored = await supabase
    .from("integration_settings")
    .select("settings, is_enabled")
    .eq("integration_name", `platform_api:${secretName}`)
    .maybeSingle();
  if (stored.data?.is_enabled === false) return "";
  const settings = stored.data?.settings as { secretValue?: string } | null;
  return String(settings?.secretValue ?? "").trim();
}
