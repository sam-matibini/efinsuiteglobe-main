import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

/**
 * Resend Inbound Webhook (email.received)
 *
 * Setup:
 * 1. Resend → Domains → verify your receiving (sub)domain and add the MX record it shows.
 * 2. Resend → Webhooks (or Inbound) → add endpoint:
 *      URL: https://boskmqywofwekszhgryb.supabase.co/functions/v1/resend-inbound-webhook
 *      Subscribe to: email.received
 * 3. Copy the signing secret (whsec_...) into the RESEND_WEBHOOK_SECRET project secret.
 *
 * Signatures follow the Svix format used by Resend:
 *   signed_content = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   signature      = base64(hmac_sha256(secret_bytes, signed_content))
 *   header format  = "v1,<sig> v1,<sig2> ..."  (space-separated versioned signatures)
 */

function extractEmail(input: string): string {
  if (!input) return "";
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).toLowerCase().trim();
}
function extractName(input: string): string | null {
  if (!input) return null;
  const match = input.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/^"|"$/g, "") : null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  rawBody: string,
): Promise<boolean> {
  // Secret is provided as "whsec_<base64>"; strip prefix if present.
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(rawSecret);
  } catch {
    // Fallback: treat as UTF-8 if not valid base64.
    keyBytes = new TextEncoder().encode(rawSecret);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = bytesToBase64(sigBuf);

  // Header may contain multiple space-separated "v1,<sig>" tokens; accept if any match.
  const provided = svixSignature.split(" ").map((s) => {
    const [, sig] = s.split(",");
    return sig || "";
  }).filter(Boolean);

  return provided.some((sig) => timingSafeEqual(sig, expected));
}

interface ResendInboundEvent {
  type: string;
  data?: {
    from?: string | { email?: string; name?: string };
    to?: string | string[] | Array<{ email?: string; name?: string }>;
    subject?: string;
    text?: string;
    html?: string;
    headers?: unknown;
    attachments?: Array<{ url?: string; filename?: string; content_type?: string }>;
  };
}

function normalizeFrom(from: ResendInboundEvent["data"] extends infer D ? D extends { from?: infer F } ? F : never : never): string {
  if (!from) return "";
  if (typeof from === "string") return from;
  if (typeof from === "object" && from) {
    const f = from as { email?: string; name?: string };
    return f.name ? `${f.name} <${f.email ?? ""}>` : (f.email ?? "");
  }
  return "";
}
function normalizeTo(to: unknown): string {
  if (!to) return "";
  if (typeof to === "string") return to;
  if (Array.isArray(to)) {
    const first = to[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const f = first as { email?: string; name?: string };
      return f.email ?? "";
    }
  }
  if (typeof to === "object") {
    const f = to as { email?: string };
    return f.email ?? "";
  }
  return "";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const rawBody = await req.text();

  // --- Verify Svix signature (Resend inbound webhooks) ---
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTs = req.headers.get("svix-timestamp") ?? "";
  const svixSig = req.headers.get("svix-signature") ?? "";

  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!svixId || !svixTs || !svixSig) {
    return new Response(JSON.stringify({ error: "Missing signature headers" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Timestamp freshness: 5 minute window.
  const tsSec = Number(svixTs);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
    return new Response(JSON.stringify({ error: "Timestamp outside tolerance" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const valid = await verifySvixSignature(secret, svixId, svixTs, svixSig, rawBody);
  if (!valid) {
    console.error("Invalid Svix signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // --- Parse event ---
  let event: ResendInboundEvent;
  try {
    event = JSON.parse(rawBody) as ResendInboundEvent;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (event.type !== "email.received") {
    // Acknowledge other event types (e.g. email.delivered) without processing.
    return new Response(JSON.stringify({ success: true, ignored: event.type }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const data = event.data ?? {};
    const fromRaw = normalizeFrom(data.from);
    const toRaw = normalizeTo(data.to);
    const subject = (data.subject && data.subject.trim()) || "(No Subject)";
    const messageBody = data.text || data.html || "";

    if (!fromRaw || !toRaw) {
      console.error("Missing from or to in inbound payload");
      // Return 200 so Resend doesn't retry a malformed event.
      return new Response(JSON.stringify({ success: false, error: "Missing from/to" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const fromEmail = extractEmail(fromRaw);
    const fromName = extractName(fromRaw);
    const toEmail = extractEmail(toRaw);

    console.log(`Inbound email received from: ${fromEmail} to: ${toEmail} subject: ${subject}`);

    // --- Route to organization / conversation (mirrors previous SendGrid logic) ---
    const { data: existingConvo } = await supabase
      .from("conversations")
      .select("id, organization_id")
      .eq("contact_identifier", fromEmail)
      .eq("channel", "email")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let organizationId: string;
    let conversationId: string;

    if (existingConvo) {
      organizationId = existingConvo.organization_id;
      conversationId = existingConvo.id;
    } else {
      const { data: outboundMatch } = await supabase
        .from("messages")
        .select("organization_id, conversation_id")
        .eq("to_identifier", fromEmail)
        .eq("channel", "email")
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (outboundMatch) {
        organizationId = outboundMatch.organization_id;
        conversationId = outboundMatch.conversation_id;
      } else {
        const { data: defaultOrg } = await supabase
          .from("organizations")
          .select("id")
          .limit(1)
          .maybeSingle();

        if (!defaultOrg) {
          console.error("No organization found for routing inbound email");
          return new Response(JSON.stringify({ success: false, error: "No organization found" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        organizationId = defaultOrg.id;

        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({
            organization_id: organizationId,
            contact_identifier: fromEmail,
            contact_name: fromName,
            channel: "email",
          })
          .select("id")
          .single();

        if (convoError || !newConvo) {
          console.error("Error creating conversation:", convoError);
          throw convoError ?? new Error("Failed to create conversation");
        }
        conversationId = newConvo.id;
      }
    }

    // --- Attachments: store Resend-hosted URLs directly (parity with old function) ---
    const mediaUrls: string[] | null = Array.isArray(data.attachments) && data.attachments.length > 0
      ? data.attachments.map((a) => a?.url).filter((u): u is string => typeof u === "string" && u.length > 0)
      : null;

    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        channel: "email",
        direction: "inbound",
        from_identifier: fromEmail,
        to_identifier: toEmail,
        subject,
        body: messageBody,
        media_urls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : null,
        status: "received",
        is_read: false,
      })
      .select("id")
      .single();

    if (msgError || !newMessage) {
      console.error("Error inserting inbound message:", msgError);
      throw msgError ?? new Error("Failed to insert message");
    }

    if (fromName && !existingConvo) {
      await supabase.from("conversations").update({ contact_name: fromName }).eq("id", conversationId);
    }

    console.log(`Inbound email stored with ID: ${newMessage.id}`);

    return new Response(JSON.stringify({ success: true, messageId: newMessage.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Resend inbound webhook error:", error);
    // Return 200 to avoid retry storms on processing failures (behaviour parity).
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
