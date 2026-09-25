import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base64URL encode helper
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Create HMAC-SHA256 signature
async function createHmacSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData.buffer as ArrayBuffer);
  const signatureArray = new Uint8Array(signature);
  let binaryString = "";
  for (let i = 0; i < signatureArray.length; i++) {
    binaryString += String.fromCharCode(signatureArray[i]);
  }
  return base64UrlEncode(binaryString);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
    const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    // Check for required credentials
    if (!accountSid || !apiKeySid || !apiKeySecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Twilio API Key credentials not configured. Please add TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET.",
          configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that API Key SID starts with "SK" (not "AC" which is Account SID)
    if (!apiKeySid.startsWith("SK")) {
      console.error(`Invalid TWILIO_API_KEY_SID: ${apiKeySid.substring(0, 4)}... - must start with "SK", not "${apiKeySid.substring(0, 2)}"`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "TWILIO_API_KEY_SID must be an API Key SID (starts with 'SK'), not an Account SID (starts with 'AC'). Please create an API Key at console.twilio.com → Account → API Keys.",
          configured: false,
          invalidCredential: "TWILIO_API_KEY_SID",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate TwiML App SID if provided
    if (twimlAppSid && !twimlAppSid.startsWith("AP")) {
      console.error(`Invalid TWILIO_TWIML_APP_SID: ${twimlAppSid.substring(0, 4)}... - must start with "AP"`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "TWILIO_TWIML_APP_SID must be a TwiML App SID (starts with 'AP'). Please verify the SID at console.twilio.com → Develop → Voice → TwiML Apps.",
          configured: false,
          invalidCredential: "TWILIO_TWIML_APP_SID",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, identity } = body;

    if (action === "health-check") {
      return new Response(
        JSON.stringify({
          success: true,
          configured: true,
          hasTwimlApp: !!twimlAppSid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-token") {
      if (!identity) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing identity parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the token header and payload for Twilio Access Token
      const header = {
        typ: "JWT",
        alg: "HS256",
        cty: "twilio-fpa;v=1",
      };

      const now = Math.floor(Date.now() / 1000);
      const ttl = 3600; // 1 hour

      // Voice grant with incoming and outgoing capabilities
      const voiceGrant: Record<string, unknown> = {
        incoming: { allow: true },
      };
      
      if (twimlAppSid) {
        voiceGrant.outgoing = { application_sid: twimlAppSid };
      }

      const payload = {
        jti: `${apiKeySid}-${now}`,
        iss: apiKeySid,
        sub: accountSid,
        exp: now + ttl,
        grants: {
          identity: identity,
          voice: voiceGrant,
        },
      };

      const encodedHeader = base64UrlEncode(JSON.stringify(header));
      const encodedPayload = base64UrlEncode(JSON.stringify(payload));
      const signatureInput = `${encodedHeader}.${encodedPayload}`;

      const signature = await createHmacSignature(apiKeySecret, signatureInput);
      const token = `${signatureInput}.${signature}`;

      return new Response(
        JSON.stringify({
          success: true,
          token,
          identity,
          expiresIn: ttl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Voice token error:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
