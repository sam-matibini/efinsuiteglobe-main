import { supabase } from "@/integrations/supabase/client";

export type Plan = {
  id: string;
  code: string;
  name: string;
  blurb: string | null;
  price_amount: number | null;
  price_currency: string;
  price_unit: string;
  included_volume: number;
  overage_amount: number | null;
  features: string[];
  featured: boolean;
  public_visible: boolean;
  custom_pricing: boolean;
  sort_order: number;
};

export async function fetchPlans() {
  const { data, error } = await supabase.from("plans").select("*").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function fetchAppSettings() {
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchIntegrations() {
  const { data, error } = await supabase.from("integration_settings").select("*").order("category").order("label");
  if (error) throw error;
  return data ?? [];
}

export type ApiNotepadEntry = {
  id: string;
  title: string;
  purpose: string | null;
  status: "idea" | "keys_needed" | "connecting" | "live";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchApiNotepad() {
  const { data, error } = await supabase.from("api_notepad").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiNotepadEntry[];
}

export async function fetchEmailLog() {
  const { data, error } = await supabase
    .from("email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchCompanies() {
  const [orgs, subs, usage, members] = await Promise.all([
    supabase.from("organizations").select("id, name, slug, created_at").order("created_at"),
    supabase.from("org_subscriptions").select("*, plans(name, code, price_amount, included_volume)"),
    supabase.from("usage_counters").select("*"),
    supabase.from("organization_members").select("org_id, user_id"),
  ]);
  const err = orgs.error ?? subs.error ?? usage.error ?? members.error;
  if (err) throw err;
  const period = new Date().toISOString().slice(0, 7);
  return (orgs.data ?? []).map((org) => {
    const sub = (subs.data ?? []).find((s) => s.org_id === org.id) ?? null;
    const current = (usage.data ?? []).find((u) => u.org_id === org.id && u.period === period) ?? null;
    return {
      ...org,
      subscription: sub,
      usage: current,
      people: (members.data ?? []).filter((m) => m.org_id === org.id).length,
    };
  });
}

export async function fetchCompany(orgId: string) {
  const [org, sub, usage, members, invoices, cases] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabase.from("org_subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("usage_counters").select("*").eq("org_id", orgId).order("period", { ascending: false }),
    supabase.from("organization_members").select("org_id, user_id, role").eq("org_id", orgId),
    supabase.from("invoices").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);
  const err = org.error ?? sub.error ?? usage.error ?? invoices.error;
  if (err) throw err;
  return {
    organization: org.data,
    subscription: sub.data,
    usage: usage.data ?? [],
    people: (members.data ?? []).filter((m) => m.org_id === orgId).length,
    invoices: invoices.data ?? [],
    caseCount: cases.count ?? 0,
  };
}

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchInvoice(id: string) {
  const [invoice, lines] = await Promise.all([
    supabase.from("invoices").select("*, organizations(name)").eq("id", id).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("created_at"),
  ]);
  if (invoice.error) throw invoice.error;
  if (lines.error) throw lines.error;
  return { invoice: invoice.data, lines: lines.data ?? [] };
}

export async function fetchNotificationPreferences(orgId: string) {
  const { data, error } = await supabase.from("notification_preferences").select("*").eq("org_id", orgId);
  if (error) throw error;
  return data ?? [];
}

export function money(amount: number | null | undefined, currency = "CAD") {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(amount));
}
