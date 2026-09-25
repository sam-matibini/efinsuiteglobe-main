import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_TO = "support@efin.money";
const FROM_NAME = Deno.env.get("RESEND_FROM_NAME") || "efinsuite Globe";
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "info@efinsuite.com";
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

const BodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0).optional(), // honeypot
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendEmail(apiKey: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Resend send failed [${res.status}]:`, text);
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return json(500, { error: "RESEND_API_KEY is not configured" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }

  // Honeypot: silently succeed to avoid feedback to bots
  if (parsed.data.website && parsed.data.website.length > 0) {
    return json(200, { success: true });
  }

  const { name, email, subject, message } = parsed.data;

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  const supportHtml = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">New contact form submission</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">Name</td><td style="padding: 6px 0;">${safeName}</td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #6b7280;">Subject</td><td style="padding: 6px 0;">${safeSubject}</td></tr>
      </table>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
        <p style="margin: 0 0 8px; color: #6b7280;">Message</p>
        <div style="white-space: pre-wrap; line-height: 1.55;">${safeMessage}</div>
      </div>
    </div>
  `;

  const ackHtml = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="margin: 0 0 12px;">Thanks for reaching out, ${safeName}!</h2>
      <p style="line-height: 1.55;">We received your message and will get back to you within one business day.</p>
      <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">Your message</p>
        <p style="margin: 0 0 6px;"><strong>Subject:</strong> ${safeSubject}</p>
        <div style="white-space: pre-wrap; line-height: 1.55;">${safeMessage}</div>
      </div>
      <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">— The ${escapeHtml(FROM_NAME)} team</p>
    </div>
  `;

  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [SUPPORT_TO],
      reply_to: email,
      subject: `[Contact] ${subject}`,
      html: supportHtml,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(502, { error: "Failed to deliver message", details: msg });
  }

  // Best-effort acknowledgement — don't fail the request if this send fails.
  try {
    await sendEmail(apiKey, {
      from: FROM,
      to: [email],
      subject: `We received your message — ${FROM_NAME}`,
      html: ackHtml,
    });
  } catch (e) {
    console.warn("Acknowledgement email failed:", e);
  }

  return json(200, { success: true });
});
