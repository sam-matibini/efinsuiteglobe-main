import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("platform_staff").select("id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("This area is for eterfaceID staff only");
  return true;
}

const planInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(60),
  blurb: z.string().trim().max(400).optional(),
  price_amount: z.number().nonnegative().nullable().optional(),
  price_currency: z.string().trim().length(3).optional(),
  price_unit: z.string().trim().max(60).optional(),
  included_volume: z.number().int().nonnegative().optional(),
  overage_amount: z.number().nonnegative().nullable().optional(),
  features: z.array(z.string().trim().max(160)).max(20).optional(),
  featured: z.boolean().optional(),
  public_visible: z.boolean().optional(),
  custom_pricing: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { id, ...fields } = data;
    const payload = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (id) {
      const { error } = await context.supabase.from("plans").update(payload as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("plans")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legal_name: z.string().trim().max(160).nullish(),
        trading_name: z.string().trim().max(160).nullish(),
        address_line1: z.string().trim().max(160).nullish(),
        address_line2: z.string().trim().max(160).nullish(),
        city: z.string().trim().max(80).nullish(),
        region: z.string().trim().max(80).nullish(),
        postal_code: z.string().trim().max(20).nullish(),
        country: z.string().trim().max(60).nullish(),
        contact_email: z.string().trim().max(160).nullish(),
        support_email: z.string().trim().max(160).nullish(),
        billing_email: z.string().trim().max(160).nullish(),
        phone: z.string().trim().max(40).nullish(),
        registration_number: z.string().trim().max(60).nullish(),
        tax_number: z.string().trim().max(60).nullish(),
        tax_rate: z.number().min(0).max(100).optional(),
        invoice_footer: z.string().trim().max(600).nullish(),
        email_from_name: z.string().trim().max(80).nullish(),
        email_from_address: z.string().trim().max(160).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    const { data: existing } = await context.supabase.from("app_settings").select("id").limit(1).maybeSingle();
    if (existing) {
      const { error } = await context.supabase.from("app_settings").update(payload as never).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }
    const { data: row, error } = await context.supabase
      .from("app_settings")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orgId: z.string().uuid(),
        planId: z.string().uuid().nullable().optional(),
        priceOverride: z.number().nonnegative().nullable().optional(),
        includedVolumeOverride: z.number().int().nonnegative().nullable().optional(),
        status: z.enum(["trial", "active", "suspended", "cancelled"]),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const payload = {
      org_id: data.orgId,
      plan_id: data.planId ?? null,
      price_override: data.priceOverride ?? null,
      included_volume_override: data.includedVolumeOverride ?? null,
      status: data.status,
      notes: data.notes ?? null,
    };
    const { error } = await context.supabase
      .from("org_subscriptions")
      .upsert(payload as never, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orgId: z.string().uuid(),
        period: z.string().regex(/^\d{4}-\d{2}$/, "Use a month like 2026-09"),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub } = await supabaseAdmin
      .from("org_subscriptions")
      .select("*, plans(name, price_amount, price_currency, included_volume, overage_amount)")
      .eq("org_id", data.orgId)
      .maybeSingle();
    const plan = (sub as any)?.plans ?? null;
    const { data: usage } = await supabaseAdmin
      .from("usage_counters")
      .select("*")
      .eq("org_id", data.orgId)
      .eq("period", data.period)
      .maybeSingle();

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("tax_rate")
      .limit(1)
      .maybeSingle();

    const unit = Number((sub as any)?.price_override ?? plan?.price_amount ?? 0);
    const included = Number((sub as any)?.included_volume_override ?? plan?.included_volume ?? 0);
    const verifications = usage?.verifications ?? 0;
    const screenings = usage?.screenings ?? 0;
    const transactions = usage?.transactions ?? 0;
    const billable = Math.max(0, verifications - included);
    const overageUnit = Number(plan?.overage_amount ?? unit);

    const lines = [
      {
        description: `${plan?.name ?? "Platform"} — ${data.period}${included ? ` (includes ${included} verifications)` : ""}`,
        quantity: 1,
        unit_amount: included ? unit * included : 0,
        amount: included ? unit * included : 0,
      },
      {
        description: `Verifications beyond the included volume (${billable})`,
        quantity: billable,
        unit_amount: overageUnit,
        amount: billable * overageUnit,
      },
      {
        description: `Screening runs (${screenings}) and transactions monitored (${transactions})`,
        quantity: 1,
        unit_amount: 0,
        amount: 0,
      },
    ];
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const taxRate = Number(settings?.tax_rate ?? 0);
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    const year = data.period.slice(0, 4);
    const { count } = await supabaseAdmin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .like("number", `EID-${year}-%`);
    const number = `EID-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        org_id: data.orgId,
        number,
        period: data.period,
        currency: plan?.price_currency ?? "CAD",
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        status: "draft",
        notes: data.notes ?? null,
        created_by: context.userId,
      })
      .select("id, number")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("invoice_lines")
      .insert(lines.map((l) => ({ ...l, invoice_id: invoice.id })) as never);

    return { id: invoice.id as string, number: invoice.number as string };
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "sent", "paid", "void"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "sent") patch["issued_at"] = now;
    if (data.status === "paid") patch["paid_at"] = now;
    const { error } = await context.supabase.from("invoices").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setIntegrationEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ provider: z.string().trim().max(40), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("integration_settings")
      .update({ enabled: data.enabled })
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const notepadInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  purpose: z.string().trim().max(500).nullish(),
  status: z.enum(["idea", "keys_needed", "connecting", "live"]),
  notes: z.string().trim().max(2000).nullish(),
});

export const saveApiNotepadEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => notepadInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { id, ...fields } = data;
    const payload = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (id) {
      const { error } = await context.supabase.from("api_notepad").update(payload as never).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("api_notepad")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteApiNotepadEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("api_notepad").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ to: z.string().trim().email().max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendNotification } = await import("@/lib/email.server");
    const result = await sendNotification(supabaseAdmin, { event: "test", to: data.to });
    return result;
  });

export const setNotificationPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ event: z.string().trim().max(40), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", context.userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!membership || membership.role !== "admin") throw new Error("Only team administrators can do that");
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(
        { org_id: membership.org_id, event: data.event, enabled: data.enabled, updated_at: new Date().toISOString() } as never,
        { onConflict: "org_id,event" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
