import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

type Admin = SupabaseClient<Database>;

export type NotificationEvent =
  | "team.invite"
  | "team.welcome"
  | "case.decision"
  | "alert.opened"
  | "screening.hit"
  | "report.filed"
  | "test";

export const NOTIFICATION_EVENTS: { event: NotificationEvent; label: string; description: string }[] = [
  { event: "team.invite", label: "Team invitations", description: "Invitation link sent to the person you invite." },
  { event: "team.welcome", label: "Welcome message", description: "Sent when someone joins your workspace." },
  { event: "case.decision", label: "Case decisions", description: "When a case is approved or rejected." },
  { event: "alert.opened", label: "Monitoring alerts", description: "When a new monitoring alert opens." },
  { event: "screening.hit", label: "New screening matches", description: "When screening finds a possible match." },
  { event: "report.filed", label: "Report filed", description: "Confirmation once a report is marked as filed." },
];

function layout(title: string, bodyHtml: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:'Helvetica Neue',Arial,sans-serif;color:#15171a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e3e1dc">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e3e1dc;font-size:17px;font-weight:700;letter-spacing:-0.01em">
          eterface<span style="color:#d4462a">ID</span>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;font-size:19px;line-height:1.3">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e3e1dc;font-size:12px;color:#6b6f76">${footer}</td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#33383e">${text}</p>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#15171a;color:#ffffff;text-decoration:none;padding:11px 20px;font-size:14px;display:inline-block">${label}</a></p>`;
}

export function renderTemplate(
  event: NotificationEvent,
  data: Record<string, string>,
): { subject: string; html: string } {
  const org = data["org"] ?? "your team";
  const footer = data["footer"] ?? "Sent by eterfaceID because of activity in your workspace.";
  switch (event) {
    case "team.invite":
      return {
        subject: `You have been invited to ${org} on eterfaceID`,
        html: layout(
          `Join ${org} on eterfaceID`,
          p(`${data["inviter"] ?? "A colleague"} invited you to join <strong>${org}</strong> as ${data["role"] ?? "a team member"}.`) +
            button(data["link"] ?? "#", "Accept the invitation") +
            p("This invitation expires in 14 days."),
          footer,
        ),
      };
    case "team.welcome":
      return {
        subject: `Welcome to ${org} on eterfaceID`,
        html: layout(
          `Welcome to ${org}`,
          p(`Your account is active. You can sign in and start working on cases right away.`) +
            button(data["link"] ?? "#", "Open the console"),
          footer,
        ),
      };
    case "case.decision":
      return {
        subject: `Case ${data["reference"] ?? ""} ${data["decision"] ?? "updated"}`,
        html: layout(
          `Case ${data["reference"] ?? ""} was ${data["decision"] ?? "updated"}`,
          p(`Subject: <strong>${data["subject"] ?? ""}</strong>`) +
            (data["note"] ? p(`Reviewer note: ${data["note"]}`) : "") +
            button(data["link"] ?? "#", "Open the case"),
          footer,
        ),
      };
    case "alert.opened":
      return {
        subject: `New monitoring alert on ${data["reference"] ?? "a case"}`,
        html: layout(
          "A monitoring alert was opened",
          p(`${data["detail"] ?? "A change was detected on a monitored customer."}`) +
            button(data["link"] ?? "#", "Review the alert"),
          footer,
        ),
      };
    case "screening.hit":
      return {
        subject: `Possible screening match on ${data["reference"] ?? "a case"}`,
        html: layout(
          "Screening found a possible match",
          p(`${data["count"] ?? "1"} possible match(es) for <strong>${data["subject"] ?? ""}</strong> need a decision.`) +
            button(data["link"] ?? "#", "Review the matches"),
          footer,
        ),
      };
    case "report.filed":
      return {
        subject: `Report ${data["reportType"] ?? ""} marked as filed`,
        html: layout(
          "Report marked as filed",
          p(`${data["reportType"] ?? "The report"} for ${data["reference"] ?? "a case"} was filed with ${data["authority"] ?? "the authority"}.`) +
            (data["referenceNumber"] ? p(`Authority reference: <strong>${data["referenceNumber"]}</strong>`) : ""),
          footer,
        ),
      };
    default:
      return {
        subject: "eterfaceID test email",
        html: layout("Test email", p("Your email delivery is working."), footer),
      };
  }
}

async function senderIdentity(admin: Admin) {
  const { data } = await admin
    .from("app_settings")
    .select("email_from_name, email_from_address, legal_name")
    .limit(1)
    .maybeSingle();
  const name = data?.email_from_name || data?.legal_name || "eterfaceID";
  const address = data?.email_from_address || "onboarding@resend.dev";
  return `${name} <${address}>`;
}

async function notificationEnabled(admin: Admin, orgId: string | null, event: NotificationEvent) {
  if (!orgId) return true;
  const { data } = await admin
    .from("notification_preferences")
    .select("enabled")
    .eq("org_id", orgId)
    .eq("event", event)
    .maybeSingle();
  return data ? data.enabled : true;
}

/** Sends one notification through Resend and records the outcome. Never throws. */
export async function sendNotification(
  admin: Admin,
  opts: {
    event: NotificationEvent;
    to: string | string[];
    orgId?: string | null;
    data?: Record<string, string>;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "no_recipient" };

  const orgId = opts.orgId ?? null;
  if (!(await notificationEnabled(admin, orgId, opts.event))) {
    return { sent: false, reason: "disabled" };
  }

  const { data: integration } = await admin
    .from("integration_settings")
    .select("enabled")
    .eq("provider", "resend")
    .maybeSingle();
  if (integration && integration.enabled === false) return { sent: false, reason: "integration_off" };

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  const { subject, html } = renderTemplate(opts.event, opts.data ?? {});

  if (!lovableKey || !resendKey) {
    await admin.from("email_log").insert(
      recipients.map((r) => ({
        org_id: orgId,
        event: opts.event,
        recipient: r,
        subject,
        status: "failed",
        error_detail: "Email service is not connected",
      })),
    );
    return { sent: false, reason: "not_configured" };
  }

  const from = await senderIdentity(admin);
  let ok = true;

  for (const recipient of recipients) {
    let status = "sent";
    let providerId: string | null = null;
    let errorDetail: string | null = null;
    try {
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({ from, to: [recipient], subject, html }),
      });
      if (!res.ok) {
        status = "failed";
        ok = false;
        errorDetail = `[${res.status}] ${await res.text()}`;
      } else {
        const body = (await res.json()) as { id?: string };
        providerId = body.id ?? null;
      }
    } catch (err) {
      status = "failed";
      ok = false;
      errorDetail = err instanceof Error ? err.message : "send failed";
    }
    await admin.from("email_log").insert({
      org_id: orgId,
      event: opts.event,
      recipient,
      subject,
      status,
      provider_id: providerId,
      error_detail: errorDetail,
    });
  }

  await admin
    .from("integration_settings")
    .update({ last_checked_at: new Date().toISOString(), status: ok ? "connected" : "error" })
    .eq("provider", "resend");

  return ok ? { sent: true } : { sent: false, reason: "provider_error" };
}

/** Admin + analyst email addresses for an organization. */
export async function orgNotifyRecipients(admin: Admin, orgId: string) {
  const { data: members } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId)
    .in("role", ["admin", "analyst"]);
  const ids = (members ?? []).map((m) => m.user_id);
  if (!ids.length) return [] as string[];
  const { data: profiles } = await admin.from("profiles").select("email").in("id", ids);
  return (profiles ?? []).map((p) => p.email).filter((e): e is string => Boolean(e));
}
