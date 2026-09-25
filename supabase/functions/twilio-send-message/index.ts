import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND_NAME = "efinsuite Globe";
const BRAND_SLOGAN = "Global AI-Powered Accounting, Payroll & Financial Management";
const BRAND_WEBSITE = "globe.efinsuite.com"; // No https:// to prevent WhatsApp dark banner
const BRAND_WEBSITE_FULL = "https://globe.efinsuite.com";
const BRAND_LOGO_URL = "https://boskmqywofwekszhgryb.supabase.co/storage/v1/object/public/organization-logos/global/efinsuite-globe-logo-whatsapp.png";

type Channel = "sms" | "whatsapp";

interface SendMessageRequest {
  action: "send";
  channel: Channel;
  to: string; // E.164 phone number, e.g. +14155551234
  message: string;
  mediaUrls?: string[]; // Optional array of publicly accessible media URLs (MMS)
  includeBranding?: boolean; // Whether to append brand signature
  sendLogoFirst?: boolean; // For WhatsApp: send logo image before text message
}

interface HealthCheckRequest {
  action: "health-check" | "test";
}

type TwilioMessageRequest = SendMessageRequest | HealthCheckRequest;

// Clean signature only (WhatsApp creates its own link preview, so no header needed)
function addBrandSignature(message: string): string {
  return message;
}

// Add full brand header and signature (for SMS where no link preview exists)
function addBrandHeader(message: string): string {
  const header = `*${BRAND_NAME}*\n${BRAND_SLOGAN}\n${BRAND_WEBSITE_FULL}\n\n`;
  const signature = `\n\n— ${BRAND_NAME}`;
  return header + message + signature;
}

// Helper to send a single Twilio message
async function sendTwilioMessage(
  accountSid: string,
  authToken: string,
  to: string,
  from: string,
  body: string,
  mediaUrl?: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);

  const formData = new URLSearchParams();
  formData.append("To", to);
  formData.append("From", from);
  formData.append("Body", body);

  if (mediaUrl) {
    formData.append("MediaUrl", mediaUrl);
  }

  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.message || "Twilio send failed" };
  }

  return { success: true, sid: data.sid };
}

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If no + prefix and looks like a North American number, add +1
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
}

// Normalize WhatsApp sender value from env.
function normalizeWhatsAppSender(sender: string): string {
  const stripped = sender.trim().replace(/^whatsapp:/i, "");
  return normalizePhoneNumber(stripped);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const smsFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    const whatsappFromEnv = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
    
    console.log("WhatsApp number from env:", whatsappFromEnv);
    console.log("SMS number:", smsFrom);

    if (!accountSid || !authToken || !smsFrom) {
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: TwilioMessageRequest = await req.json();
    const { action } = body;

    // Health check
    if (action === "health-check" || action === "test") {
      return new Response(
        JSON.stringify({ 
          success: true, 
          configured: true, 
          message: `${BRAND_NAME} Messaging is ready`,
          brand: BRAND_NAME,
          smsNumber: smsFrom,
          whatsappConfigured: !!whatsappFromEnv,
          whatsappNote: "WhatsApp requires separate registration in Twilio Console"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message
    if (action === "send") {
      const { channel, to, message, mediaUrls, includeBranding = true, sendLogoFirst = false } = body as SendMessageRequest;

      if (!to || !message) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'to' or 'message'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize the recipient phone number
      const normalizedTo = normalizePhoneNumber(to);

      // Apply branding based on channel
      // WhatsApp: signature only (the frontend now handles URL breaking)
      // SMS: full header + signature (no link preview in SMS)
      let brandedMessage = message;
      if (includeBranding) {
        if (channel === "whatsapp") {
          brandedMessage = addBrandSignature(message);
        } else {
          brandedMessage = addBrandHeader(message);
        }
      }

      // Determine From/To depending on channel
      let fromField = smsFrom;
      let toField = normalizedTo;

      if (channel === "whatsapp") {
        const whatsappNumber = whatsappFromEnv;
        
        if (!whatsappNumber) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "WhatsApp is not configured. Please set TWILIO_WHATSAPP_NUMBER.",
              setupUrl: "https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders",
              sandboxUrl: "https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const normalizedWhatsAppFrom = normalizeWhatsAppSender(whatsappNumber);
        fromField = `whatsapp:${normalizedWhatsAppFrom}`;
        toField = `whatsapp:${normalizedTo}`;
        
        const isSandbox = normalizedWhatsAppFrom === "+14155238886";
        if (isSandbox) {
          console.log("Using Twilio WhatsApp Sandbox - recipient must opt-in first");
        }

        // For WhatsApp with sendLogoFirst: send logo image first, then text message
        if (sendLogoFirst) {
          console.log("WhatsApp: Sending logo first, then text message");
          
          // Step 1: Send logo image with brand name caption
          const logoResult = await sendTwilioMessage(
            accountSid,
            authToken,
            toField,
            fromField,
            BRAND_NAME, // Just brand name as caption
            BRAND_LOGO_URL
          );

          if (!logoResult.success) {
            console.error("Failed to send logo:", logoResult.error);
            // Continue with text message even if logo fails
          } else {
            console.log("Logo sent successfully:", logoResult.sid);
            // Small delay to ensure proper ordering
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Step 2: Send the text message (with media attachment if provided)
          const firstMediaUrl = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : undefined;
          if (firstMediaUrl) {
            console.log("WhatsApp sendLogoFirst: attaching media to text message:", firstMediaUrl);
          }
          const textResult = await sendTwilioMessage(
            accountSid,
            authToken,
            toField,
            fromField,
            brandedMessage,
            firstMediaUrl
          );

          if (!textResult.success) {
            let errorMessage = textResult.error || "Twilio send failed";
            if (errorMessage.includes("Channel with the specified From address")) {
              errorMessage = `WhatsApp is not enabled for this phone number. Please register your number for WhatsApp in the Twilio Console.`;
            }
            return new Response(
              JSON.stringify({ success: false, error: errorMessage }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              sid: textResult.sid, 
              logoSid: logoResult.sid,
              brand: BRAND_NAME,
              logoSent: logoResult.success
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Standard message sending (non-logo-first flow)
      const formData = new URLSearchParams();
      formData.append("To", toField);
      formData.append("From", fromField);
      formData.append("Body", brandedMessage);

      // Add media URLs for MMS/WhatsApp (only if user explicitly provides media)
      if (mediaUrls && mediaUrls.length > 0) {
        if (channel === "whatsapp") {
          formData.append("MediaUrl", mediaUrls[0]);
          console.log("Adding WhatsApp media:", mediaUrls[0]);
        } else if (channel === "sms") {
          mediaUrls.slice(0, 10).forEach((url) => {
            formData.append("MediaUrl", url);
          });
        }
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = btoa(`${accountSid}:${authToken}`);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        console.error("Twilio error", twilioData);
        
        let errorMessage = twilioData.message || "Twilio send failed";
        
        if (errorMessage.includes("Channel with the specified From address")) {
          errorMessage = `WhatsApp is not enabled for this phone number. Please register your number for WhatsApp in the Twilio Console at: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders`;
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, sid: twilioData.sid, brand: BRAND_NAME }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
