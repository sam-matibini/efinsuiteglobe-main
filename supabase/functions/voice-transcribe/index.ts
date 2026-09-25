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
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const action = formData.get("action") as string;
    const audioFile = formData.get("audio") as File | null;
    const languageCode = formData.get("language") as string || "eng";

    if (action === "transcribe") {
      if (!audioFile) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing audio file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Transcribing audio file:", audioFile.name, "Size:", audioFile.size);

      // Use ElevenLabs Scribe for transcription
      const apiFormData = new FormData();
      apiFormData.append("file", audioFile);
      apiFormData.append("model_id", "scribe_v2");
      apiFormData.append("tag_audio_events", "false");
      apiFormData.append("diarize", "false");
      apiFormData.append("language_code", languageCode);

      const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: apiFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs transcription error:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: `Transcription failed: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const transcription = await response.json();

      console.log("Transcription result:", transcription.text?.substring(0, 100));

      return new Response(
        JSON.stringify({ 
          success: true, 
          text: transcription.text,
          words: transcription.words || []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "transcribe-and-send") {
      // Transcribe and send as WhatsApp message
      const to = formData.get("to") as string;

      if (!audioFile || !to) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing audio file or recipient" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // First transcribe
      const apiFormData = new FormData();
      apiFormData.append("file", audioFile);
      apiFormData.append("model_id", "scribe_v2");
      apiFormData.append("language_code", languageCode);

      const transcribeResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: apiFormData,
      });

      if (!transcribeResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Transcription failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const transcription = await transcribeResponse.json();
      const transcribedText = transcription.text;

      if (!transcribedText || transcribedText.trim().length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No speech detected in audio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Now send via Twilio WhatsApp
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const whatsappNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

      if (!accountSid || !authToken || !whatsappNumber) {
        return new Response(
          JSON.stringify({ success: false, error: "Twilio not configured", transcribedText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedTo = normalizePhoneNumber(to);
      const normalizedFrom = normalizeWhatsAppSender(whatsappNumber);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = btoa(`${accountSid}:${authToken}`);

      const twilioFormData = new URLSearchParams();
      twilioFormData.append("To", `whatsapp:${normalizedTo}`);
      twilioFormData.append("From", `whatsapp:${normalizedFrom}`);
      twilioFormData.append("Body", `🎤 Voice Message:\n\n${transcribedText}`);

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
        return new Response(
          JSON.stringify({ success: false, error: twilioData.message, transcribedText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          sid: twilioData.sid, 
          transcribedText 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Voice transcribe error:", err);
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
