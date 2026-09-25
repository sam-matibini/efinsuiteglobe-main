import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND_NAME = "efinsuite Globe";
const BRAND_EMAIL = "noreply@efintax.biz";

interface MandrillRequest {
  action: "health-check" | "test" | "send-email";
  to?: string;
  toName?: string;
  subject?: string;
  message?: string;
  html?: string;
  includeBranding?: boolean;
  tags?: string[];
}

function getBrandedFooter(): string {
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
      <p style="margin: 0;">Sent by ${BRAND_NAME}</p>
      <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
      <p style="margin: 4px 0 0 0;">Efintax Advisors Ltd · Winnipeg, MB, Canada</p>
    </div>
  `;
}

function wrapWithBranding(html: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${html}
        ${getBrandedFooter()}
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("MAILCHIMP_TRANSACTIONAL_API_KEY");
    const { action, to, toName, subject, message, html, includeBranding = true, tags = [] }: MandrillRequest = await req.json();

    console.log(`Mailchimp Transactional action: ${action}`);

    // Health check - just verify API key is configured
    if (action === "health-check") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Mailchimp Transactional API key not configured", configured: false }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, configured: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Test connection - verify API key works with Mandrill ping
    if (action === "test") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Mailchimp Transactional API key not configured" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Test API key by pinging Mandrill
      const testResponse = await fetch("https://mandrillapp.com/api/1.0/users/ping.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });

      const testData = await testResponse.json();

      if (testData === "PONG!" || testResponse.ok) {
        console.log("Mailchimp Transactional test successful");
        return new Response(
          JSON.stringify({ success: true, message: "Mailchimp Transactional connection verified" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        console.error("Mailchimp Transactional test failed:", testData);
        return new Response(
          JSON.stringify({ success: false, error: testData?.message || "Invalid API key or connection failed" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Send email via Mandrill
    if (action === "send-email") {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Mailchimp Transactional API key not configured" }),
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
      const finalHtml = includeBranding ? wrapWithBranding(emailHtml) : emailHtml;

      const mandrillPayload = {
        key: apiKey,
        message: {
          html: finalHtml,
          text: message || subject,
          subject: subject,
          from_email: BRAND_EMAIL,
          from_name: BRAND_NAME,
          to: [
            {
              email: to,
              name: toName || to,
              type: "to",
            },
          ],
          headers: {
            "Reply-To": BRAND_EMAIL,
          },
          tags: ["efinsuite", ...tags],
          track_opens: true,
          track_clicks: true,
        },
      };

      console.log(`Sending email to ${to} with subject: ${subject}`);

      const sendResponse = await fetch("https://mandrillapp.com/api/1.0/messages/send.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mandrillPayload),
      });

      const sendData = await sendResponse.json();

      if (!sendResponse.ok || (Array.isArray(sendData) && sendData[0]?.status === "rejected")) {
        console.error("Mandrill send failed:", sendData);
        const errorMessage = Array.isArray(sendData) 
          ? sendData[0]?.reject_reason || "Failed to send email"
          : sendData?.message || "Failed to send email";
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: sendResponse.ok ? 400 : sendResponse.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mandrill returns an array with message info
      const messageInfo = Array.isArray(sendData) ? sendData[0] : sendData;
      console.log("Email sent successfully via Mandrill:", messageInfo);

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: messageInfo?._id || "sent",
          status: messageInfo?.status || "sent"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Mailchimp Transactional error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
