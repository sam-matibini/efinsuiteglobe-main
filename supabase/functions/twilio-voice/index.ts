import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND_NAME = "efinsuite Globe";
const BRAND_CONTACT = "info@efintax.biz";

// ElevenLabs configuration
const ELEVENLABS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George - professional male voice
const ELEVENLABS_MODEL = "eleven_turbo_v2_5"; // Fast, high-quality for real-time

interface VoiceRequest {
  action: "health-check" | "initiate-call" | "handle-inbound" | "ivr-menu" | "voicemail" | "get-recordings" | "get-recording-audio" | "transcribe" | "tts" | "connect-call" | "call-status";
  to?: string;
  from?: string;
  callSid?: string;
  digits?: string;
  recordingUrl?: string;
  speechResult?: string;
  organizationId?: string;
  text?: string;
  voiceId?: string;
  recordingSid?: string;
}

// Generate audio using ElevenLabs TTS
async function generateElevenLabsAudio(text: string, voiceId?: string): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    console.log("ElevenLabs API key not configured, falling back to Polly");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("ElevenLabs TTS error:", response.status, await response.text());
      return null;
    }

    return await response.arrayBuffer();
  } catch (err) {
    console.error("ElevenLabs TTS exception:", err);
    return null;
  }
}

// Generate TwiML with ElevenLabs audio or Polly fallback
async function generateTwimlWithAudio(text: string, voiceId?: string): Promise<{ twiml: string; audioBase64?: string }> {
  const audioBuffer = await generateElevenLabsAudio(text, voiceId);
  
  if (audioBuffer) {
    // Use ElevenLabs audio via Play with base64 encoded audio URL
    const audioBase64 = base64Encode(audioBuffer);
    return {
      twiml: `<Play>data:audio/mpeg;base64,${audioBase64}</Play>`,
      audioBase64,
    };
  }
  
  // Fallback to Polly
  return {
    twiml: `<Say voice="Polly.Joanna">${text}</Say>`,
  };
}

// Generate TwiML for IVR menu with branding (uses Polly for interactive menus for reliability)
function generateIvrTwiml(level: string = "main"): string {
  if (level === "main") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf speech" timeout="5" numDigits="1" action="/twilio-voice?action=ivr-menu&amp;level=route">
    <Say voice="Polly.Joanna">
      Thank you for calling ${BRAND_NAME}. 
      Press 1 or say Sales for our sales team.
      Press 2 or say Support for customer support.
      Press 3 or say Billing for billing inquiries.
      Press 0 or say Operator to speak with an operator.
      Or stay on the line to leave a voicemail.
    </Say>
  </Gather>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Invalid selection. Please try again.</Say>
  <Redirect>/twilio-voice?action=handle-inbound</Redirect>
</Response>`;
}

// Generate TwiML for voicemail with branding
function generateVoicemailTwiml(organizationId?: string): string {
  const recordingCallback = organizationId 
    ? `/twilio-voice?action=voicemail-complete&organizationId=${organizationId}`
    : `/twilio-voice?action=voicemail-complete`;
    
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    You've reached ${BRAND_NAME}. Please leave your message after the beep. Press pound when finished.
  </Say>
  <Record 
    maxLength="120" 
    finishOnKey="#" 
    transcribe="true"
    transcribeCallback="${recordingCallback}"
    recordingStatusCallback="${recordingCallback}"
  />
  <Say voice="Polly.Joanna">Thank you for contacting ${BRAND_NAME}. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

// Route based on IVR input with branding
function routeIvrInput(digits?: string, speechResult?: string): string {
  const input = digits || "";
  const speech = (speechResult || "").toLowerCase();
  
  // Sales
  if (input === "1" || speech.includes("sales")) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to the ${BRAND_NAME} sales team. Please hold.</Say>
  <Dial timeout="30">
    <Queue>sales</Queue>
  </Dial>
  <Say voice="Polly.Joanna">All sales representatives are busy. Please leave a message.</Say>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
  }
  
  // Support
  if (input === "2" || speech.includes("support")) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to ${BRAND_NAME} customer support. Please hold.</Say>
  <Dial timeout="30">
    <Queue>support</Queue>
  </Dial>
  <Say voice="Polly.Joanna">All support agents are busy. Please leave a message.</Say>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
  }
  
  // Billing
  if (input === "3" || speech.includes("billing")) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting you to the ${BRAND_NAME} billing department. Please hold.</Say>
  <Dial timeout="30">
    <Queue>billing</Queue>
  </Dial>
  <Say voice="Polly.Joanna">Our billing team is currently unavailable. Please leave a message.</Say>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
  }
  
  // Operator
  if (input === "0" || speech.includes("operator")) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while we connect you to a ${BRAND_NAME} operator.</Say>
  <Dial timeout="45">
    <Queue>operator</Queue>
  </Dial>
  <Say voice="Polly.Joanna">No operators are available. Please leave a message.</Say>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
  }
  
  // Invalid or no input - go to voicemail
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We didn't receive a valid selection.</Say>
  <Redirect>/twilio-voice?action=voicemail</Redirect>
</Response>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request - handle both JSON and form-urlencoded (Twilio webhooks)
    let body: VoiceRequest;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio webhook callback
      const formData = await req.formData();
      const url = new URL(req.url);
      body = {
        action: (url.searchParams.get("action") || "handle-inbound") as VoiceRequest["action"],
        callSid: formData.get("CallSid")?.toString(),
        from: formData.get("From")?.toString(),
        to: formData.get("To")?.toString(),
        digits: formData.get("Digits")?.toString(),
        speechResult: formData.get("SpeechResult")?.toString(),
        recordingUrl: formData.get("RecordingUrl")?.toString(),
        organizationId: url.searchParams.get("organizationId") || undefined,
      };
    } else {
      body = await req.json();
    }

    const { action } = body;

    // Health check
    if (action === "health-check") {
      const elevenLabsKey = Deno.env.get("ELEVENLABS_API_KEY");
      return new Response(
        JSON.stringify({ 
          success: true, 
          configured: true, 
          message: `${BRAND_NAME} Voice is ready`, 
          brand: BRAND_NAME,
          elevenLabsEnabled: !!elevenLabsKey,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Text-to-Speech endpoint using ElevenLabs
    if (action === "tts") {
      const { text, voiceId } = body;
      
      if (!text) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'text' parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const audioBuffer = await generateElevenLabsAudio(text, voiceId);
      
      if (audioBuffer) {
        return new Response(audioBuffer, {
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "audio/mpeg",
            "Content-Length": audioBuffer.byteLength.toString(),
          },
        });
      }

      return new Response(
        JSON.stringify({ success: false, error: "ElevenLabs TTS not available" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle inbound call - return IVR menu
    if (action === "handle-inbound") {
      const twiml = generateIvrTwiml("main");
      return new Response(twiml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Handle IVR menu navigation
    if (action === "ivr-menu") {
      const twiml = routeIvrInput(body.digits, body.speechResult);
      return new Response(twiml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Handle voicemail
    if (action === "voicemail") {
      const twiml = generateVoicemailTwiml(body.organizationId);
      return new Response(twiml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Initiate outbound call (Click-to-Call)
    if (action === "initiate-call") {
      const { to } = body;
      
      if (!to) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'to' phone number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
      const auth = btoa(`${accountSid}:${authToken}`);
      
      // TwiML for the call - connects to the destination after announcement
      const twimlUrl = `https://boskmqywofwekszhgryb.supabase.co/functions/v1/twilio-voice?action=connect-call&to=${encodeURIComponent(to)}`;

      const formData = new URLSearchParams();
      formData.append("To", to);
      formData.append("From", twilioPhone);
      formData.append("Url", twimlUrl);
      formData.append("Method", "POST");

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
        console.error("Twilio call error:", twilioData);
        return new Response(
          JSON.stringify({ success: false, error: twilioData.message || "Failed to initiate call" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, callSid: twilioData.sid, status: twilioData.status, brand: BRAND_NAME }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get call recordings
    if (action === "get-recordings") {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings.json?PageSize=50`;
      const auth = btoa(`${accountSid}:${authToken}`);

      const twilioRes = await fetch(twilioUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: twilioData.message || "Failed to fetch recordings" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, recordings: twilioData.recordings, brand: BRAND_NAME }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Proxy recording audio (avoids browser auth popup)
    if (action === "get-recording-audio") {
      const { recordingSid } = body;
      
      if (!recordingSid) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing recordingSid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
      const auth = btoa(`${accountSid}:${authToken}`);

      const audioRes = await fetch(recordingUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!audioRes.ok) {
        console.error("Failed to fetch recording audio:", audioRes.status);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch recording" }),
          { status: audioRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const audioBuffer = await audioRes.arrayBuffer();
      
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Content-Length": audioBuffer.byteLength.toString(),
        },
      });
    }

    // Handle connect-call TwiML (used by outbound click-to-call)
    if (action === "connect-call") {
      const url = new URL(req.url);
      const destinationNumber = url.searchParams.get("to") || body.to;
      
      if (!destinationNumber) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, no destination number was provided.</Say>
  <Hangup/>
</Response>`;
        return new Response(twiml, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }

      // TwiML to announce and connect the call
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting your call from ${BRAND_NAME}. Please hold.</Say>
  <Dial callerId="${twilioPhone}" timeout="30">
    <Number>${destinationNumber}</Number>
  </Dial>
  <Say voice="Polly.Joanna">The call could not be completed. Goodbye.</Say>
  <Hangup/>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // Handle call status callbacks (for logging)
    if (action === "call-status") {
      console.log("Call status callback received:", body);
      // Could store call logs in database here
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Voice function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
