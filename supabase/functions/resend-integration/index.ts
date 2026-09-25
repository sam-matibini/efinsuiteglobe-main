import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brand configuration (overridable via secrets)
const BRAND_NAME = Deno.env.get("RESEND_FROM_NAME") || "efinsuite Globe";
const BRAND_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "info@efinsuite.com";

interface ResendEmailRequest {
  action: "health-check" | "test" | "send-email" | "send-test";
  to?: string;
  subject?: string;
  message?: string;
  html?: string;
  includeBranding?: boolean;
  attachmentUrl?: string;
  attachmentFilename?: string;
  attachmentMimeType?: string;
  attachments?: Array<{
    url?: string;
    content?: string; // base64
    filename?: string;
    mimeType?: string;
  }>;
  branding?: {
    logoUrl?: string;
    displayName?: string;
    signatureHtml?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function filenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? sanitizeFilename(last) : null;
  } catch {
    return null;
  }
}

interface BrandingData {
  logoUrl?: string;
  displayName?: string;
  signatureHtml?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

function getBrandedHeader(branding?: BrandingData): string {
  if (!branding?.logoUrl && !branding?.displayName) return "";
  return `
    <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.displayName || BRAND_NAME}" style="max-height: 50px; max-width: 200px; margin-bottom: 8px;">` : ""}
      ${branding.displayName ? `<p style="margin: 0; font-weight: 600; color: #1f2937;">${branding.displayName}</p>` : ""}
    </div>
  `;
}

function getBrandedSignature(branding?: BrandingData): string {
  if (branding?.signatureHtml) {
    return `<div style="margin-top: 24px;">${branding.signatureHtml}</div>`;
  }
  const parts: string[] = [];
  if (branding?.displayName) parts.push(`<strong>${branding.displayName}</strong>`);
  if (branding?.phone) parts.push(`📞 ${branding.phone}`);
  if (branding?.email) parts.push(`✉️ <a href="mailto:${branding.email}" style="color: #2563eb;">${branding.email}</a>`);
  if (branding?.website) parts.push(`🌐 <a href="${branding.website}" style="color: #2563eb;">${branding.website}</a>`);
  if (branding?.address) parts.push(`📍 ${branding.address}`);
  if (parts.length === 0) return "";
  return `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #4b5563;">
      ${parts.join("<br>")}
    </div>
  `;
}

function getBrandedFooter(branding?: BrandingData): string {
  const name = branding?.displayName || BRAND_NAME;
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center;">
      <p style="margin: 0;">Sent by ${name}</p>
      <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} ${name}. All rights reserved.</p>
    </div>
  `;
}

function wrapWithBranding(html: string, branding?: BrandingData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${getBrandedHeader(branding)}
        ${html}
        ${getBrandedSignature(branding)}
        ${getBrandedFooter(branding)}
      </body>
    </html>
  `;
}

function friendlyResendError(status: number, raw: string, fromEmail: string): { friendly: string; parsed: unknown } {
  let parsed: unknown = null;
  let friendly = raw;
  try {
    parsed = JSON.parse(raw);
    const p = parsed as { message?: string; name?: string; error?: string };
    friendly = p?.message || p?.error || raw;
  } catch { /* keep raw */ }

  if (
    (status === 403 || status === 422 || status === 401) &&
    /domain|from|verify|not verified|not allowed|sender/i.test(friendly)
  ) {
    friendly = `Resend rejected the sender "${fromEmail}". Verify this address's domain at resend.com/domains, or set the RESEND_FROM_EMAIL secret to a verified sender.`;
  }
  return { friendly, parsed };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const {
      action,
      to,
      subject,
      message,
      html,
      includeBranding = true,
      attachmentUrl,
      attachmentFilename,
      attachmentMimeType,
      attachments: multipleAttachments,
      branding,
    }: ResendEmailRequest = await req.json();

    console.log(`Resend integration action: ${action}`);

    if (action === "health-check") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Resend API key not configured" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, configured: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "test") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Resend API key not configured" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const testResponse = await fetch("https://api.resend.com/domains", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!testResponse.ok) {
        const errorData = await testResponse.text();
        console.error("Resend test failed:", errorData);
        return new Response(
          JSON.stringify({ success: false, error: "Invalid API key or connection failed" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const domains = await testResponse.json();
      console.log("Resend test successful. Domain count:", Array.isArray(domains?.data) ? domains.data.length : 0);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Resend connection verified",
          domains: Array.isArray(domains?.data) ? domains.data.length : 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "send-email") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Resend API key not configured" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (!to || !subject) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields: to, subject" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const emailHtml = html || `<p>${message || ""}</p>`;
      const finalHtml = includeBranding ? wrapWithBranding(emailHtml, branding) : emailHtml;

      // Resend attachment shape: { filename, content (base64 string) }
      const attachmentsList: Array<{ filename: string; content: string; content_type?: string }> = [];

      const fetchAttachment = async (url: string, filename?: string, mimeType?: string) => {
        console.log(`Fetching attachment from: ${url}`);
        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error(`Failed to fetch attachment: ${fileRes.status}`);
        const fileContentType = fileRes.headers.get("content-type") || undefined;
        const fileSizeHeader = fileRes.headers.get("content-length");
        const declaredSize = fileSizeHeader ? Number(fileSizeHeader) : null;
        if (declaredSize !== null && Number.isFinite(declaredSize) && declaredSize > MAX_ATTACHMENT_BYTES) {
          throw new Error(`Attachment too large (${declaredSize} bytes). Max is ${MAX_ATTACHMENT_BYTES} bytes.`);
        }
        const buffer = await fileRes.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
          throw new Error(`Attachment too large (${bytes.byteLength} bytes). Max is ${MAX_ATTACHMENT_BYTES} bytes.`);
        }
        const resolvedFilename = sanitizeFilename(filename || filenameFromUrl(url) || "document.pdf");
        const resolvedMimeType = mimeType || fileContentType || "application/octet-stream";
        console.log(`Attachment prepared: ${resolvedFilename} (${bytes.byteLength} bytes)`);
        return {
          filename: resolvedFilename,
          content: encode(buffer),
          content_type: resolvedMimeType,
        };
      };

      try {
        if (multipleAttachments && multipleAttachments.length > 0) {
          for (const att of multipleAttachments) {
            if (att.content) {
              attachmentsList.push({
                filename: sanitizeFilename(att.filename || "document.pdf"),
                content: att.content,
                content_type: att.mimeType || "application/pdf",
              });
            } else if (att.url) {
              attachmentsList.push(await fetchAttachment(att.url, att.filename, att.mimeType));
            }
          }
        } else if (attachmentUrl) {
          attachmentsList.push(await fetchAttachment(attachmentUrl, attachmentFilename, attachmentMimeType));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("Attachment handling error:", e);
        return new Response(
          JSON.stringify({ success: false, error: `Attachment error: ${msg}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Sender priority: env secret > org branding > fallback.
      const envFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
      const envFromName = Deno.env.get("RESEND_FROM_NAME");
      const fromEmail = envFromEmail || branding?.email || BRAND_EMAIL;
      const fromName = envFromName || branding?.displayName || BRAND_NAME;
      const replyToEmail = !envFromEmail && branding?.email ? branding.email : undefined;

      const emailData: Record<string, unknown> = {
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: finalHtml,
        text: message || subject,
        ...(attachmentsList.length > 0 ? { attachments: attachmentsList } : {}),
      };
      if (replyToEmail && replyToEmail !== fromEmail) {
        emailData.reply_to = replyToEmail;
      }

      console.log(`Sending email from <${fromEmail}> to <${to}> subject: ${subject}`);

      const sendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const respText = await sendResponse.text();

      if (!sendResponse.ok) {
        const { friendly, parsed } = friendlyResendError(sendResponse.status, respText, fromEmail);
        console.error("Resend send failed:", { status: sendResponse.status, body: parsed ?? respText, from: fromEmail });
        return new Response(
          JSON.stringify({
            success: false,
            error: friendly,
            status: sendResponse.status,
            details: parsed ?? respText,
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      let messageId = "sent";
      try {
        const parsed = JSON.parse(respText);
        if (parsed?.id) messageId = parsed.id;
      } catch { /* ignore */ }
      console.log("Email sent successfully, message ID:", messageId);

      return new Response(
        JSON.stringify({ success: true, messageId, from: fromEmail }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "send-test") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Resend API key not configured" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (!to) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'to' address" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || branding?.email || BRAND_EMAIL;
      const fromName = Deno.env.get("RESEND_FROM_NAME") || branding?.displayName || BRAND_NAME;
      const testHtml = `<p>This is a test email from <strong>${fromName}</strong> via Resend.</p><p>If you received this, your sender (<code>${fromEmail}</code>) and API key are working correctly.</p>`;

      const sendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject: "Resend test email — efinsuite",
          html: testHtml,
          text: "Resend test email. Your configuration is working.",
        }),
      });

      const respText = await sendResponse.text();

      if (!sendResponse.ok) {
        const { friendly } = friendlyResendError(sendResponse.status, respText, fromEmail);
        console.error("Resend test send failed:", { status: sendResponse.status, from: fromEmail, body: respText });
        return new Response(
          JSON.stringify({ success: false, error: friendly, status: sendResponse.status, from: fromEmail }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      let messageId = "sent";
      try {
        const parsed = JSON.parse(respText);
        if (parsed?.id) messageId = parsed.id;
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ success: true, messageId, from: fromEmail, to }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Resend integration error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
