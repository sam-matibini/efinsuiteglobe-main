import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "analyst" | "viewer";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "team"}-${Math.random().toString(36).slice(2, 7)}`;
}

async function currentMembership(supabase: any, userId: string) {
  const { data } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data as { org_id: string; role: AppRole } | null;
}

async function requireAdmin(supabase: any, userId: string) {
  const membership = await currentMembership(supabase, userId);
  if (!membership) throw new Error("You are not part of a team yet");
  if (membership.role !== "admin") throw new Error("Only team administrators can do that");
  return membership;
}

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(2, "Enter your company name").max(80),
        origin: z.string().trim().url().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const existing = await currentMembership(context.supabase, context.userId);
    if (existing) return { orgId: existing.org_id, existing: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.name, slug: slugify(data.name), created_by: context.userId })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ org_id: org.id, user_id: context.userId, role: "admin" });
    if (memberError) throw new Error(memberError.message);

    await supabaseAdmin.from("audit_events").insert({
      org_id: org.id,
      actor_id: context.userId,
      action: "team.created",
      entity_type: "organization",
      entity_id: org.id,
      detail: { name: data.name } as never,
    });

    try {
      const email = context.claims?.email as string | undefined;
      if (email) {
        const { sendNotification } = await import("@/lib/email.server");
        await sendNotification(supabaseAdmin, {
          event: "team.welcome",
          to: [email],
          orgId: org.id as string,
          data: {
            org: org.name as string,
            link: `${data.origin ?? "https://eterfaceid.lovable.app"}/console`,
          },
        });
      }
    } catch {
      /* the welcome email must never block sign-up */
    }

    return { orgId: org.id as string, existing: false };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email("Enter a valid email address").max(255),
        role: z.enum(["admin", "analyst", "viewer"]),
        origin: z.string().trim().url().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const membership = await requireAdmin(context.supabase, context.userId);
    const token = randomToken();
    const tokenHash = await sha256Hex(token);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("organization_invites")
      .insert({
        org_id: membership.org_id,
        email: data.email.toLowerCase(),
        role: data.role,
        token_hash: tokenHash,
        invited_by: context.userId,
      })
      .select("id, email, role, expires_at")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_events").insert({
      org_id: membership.org_id,
      actor_id: context.userId,
      action: "team.invited",
      entity_type: "organization_invite",
      entity_id: invite.id,
      detail: { email: data.email, role: data.role } as never,
    });

    const { sendNotification } = await import("@/lib/email.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", membership.org_id)
      .maybeSingle();
    const { data: inviter } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const link = `${data.origin ?? "https://eterfaceid.lovable.app"}/invite/${token}`;
    const emailed = await sendNotification(supabaseAdmin, {
      event: "team.invite",
      to: data.email,
      orgId: membership.org_id,
      data: {
        org: org?.name ?? "your team",
        inviter: inviter?.full_name ?? inviter?.email ?? "A colleague",
        role: data.role,
        link,
      },
    });

    return { invite, token, emailed };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const membership = await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("organization_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", membership.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().trim().min(10).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const tokenHash = await sha256Hex(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("organization_invites")
      .select("id, org_id, role, expires_at, accepted_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!invite) throw new Error("This invitation link is not valid");
    if (invite.revoked_at) throw new Error("This invitation was cancelled");
    if (invite.accepted_at) throw new Error("This invitation has already been used");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("This invitation has expired");

    const existing = await currentMembership(context.supabase, context.userId);
    if (existing && existing.org_id !== invite.org_id) {
      throw new Error("You already belong to another team");
    }

    if (!existing) {
      const { error: memberError } = await supabaseAdmin
        .from("organization_members")
        .insert({ org_id: invite.org_id, user_id: context.userId, role: invite.role });
      if (memberError) throw new Error(memberError.message);
    }

    await supabaseAdmin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", invite.id);

    await supabaseAdmin.from("audit_events").insert({
      org_id: invite.org_id,
      actor_id: context.userId,
      action: "team.joined",
      entity_type: "organization",
      entity_id: invite.org_id,
      detail: { role: invite.role } as never,
    });

    const { sendNotification } = await import("@/lib/email.server");
    const [{ data: joiner }, { data: org }] = await Promise.all([
      supabaseAdmin.from("profiles").select("email, full_name").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("organizations").select("name").eq("id", invite.org_id).maybeSingle(),
    ]);
    if (joiner?.email) {
      await sendNotification(supabaseAdmin, {
        event: "team.welcome",
        to: joiner.email,
        orgId: invite.org_id,
        data: {
          org: org?.name ?? "your team",
          name: joiner.full_name ?? joiner.email,
          role: invite.role,
        },
      });
    }

    return { orgId: invite.org_id as string };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), role: z.enum(["admin", "analyst", "viewer"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const membership = await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      const { count } = await context.supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", membership.org_id)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Your team needs at least one administrator");
    }
    const { error } = await context.supabase
      .from("organization_members")
      .update({ role: data.role })
      .eq("org_id", membership.org_id)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      org_id: membership.org_id,
      actor_id: context.userId,
      action: "team.role_changed",
      entity_type: "user",
      entity_id: data.userId,
      detail: { role: data.role } as never,
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const membership = await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot remove yourself");

    const { error } = await context.supabase
      .from("organization_members")
      .delete()
      .eq("org_id", membership.org_id)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      org_id: membership.org_id,
      actor_id: context.userId,
      action: "team.member_removed",
      entity_type: "user",
      entity_id: data.userId,
      detail: {} as never,
    });
    return { ok: true };
  });
