import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const whatsappNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!accountSid || !authToken || !whatsappNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const action = formData.get("action") as string;
    const to = formData.get("to") as string;
    const audioFile = formData.get("audio") as File | null;
    const audioUrl = formData.get("audioUrl") as string | null;

    if (action === "send-audio") {
      if (!to) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'to' phone number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!audioFile && !audioUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing audio file or URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize phone numbers
      const normalizedTo = normalizePhoneNumber(to);
      const normalizedFrom = normalizeWhatsAppSender(whatsappNumber);

      let mediaUrl = audioUrl;

      // If audioFile provided, we need to upload it somewhere publicly accessible
      // For now, we'll require a pre-uploaded URL
      if (audioFile && !audioUrl) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Audio must be uploaded to storage first. Use Supabase Storage to upload the audio and provide the public URL." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send WhatsApp audio message
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = btoa(`${accountSid}:${authToken}`);

      const twilioFormData = new URLSearchParams();
      twilioFormData.append("To", `whatsapp:${normalizedTo}`);
      twilioFormData.append("From", `whatsapp:${normalizedFrom}`);
      twilioFormData.append("MediaUrl", mediaUrl!);

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: twilioFormData.toString(),
      });

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        console.error("Twilio error:", twilioData);
        return new Response(
          JSON.stringify({ success: false, error: twilioData.message || "Failed to send audio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, sid: twilioData.sid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("WhatsApp audio error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
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

function normalizeWhatsAppSender(sender: string): string {
  const stripped = sender.trim().replace(/^whatsapp:/i, "");
  return normalizePhoneNumber(stripped);
}
