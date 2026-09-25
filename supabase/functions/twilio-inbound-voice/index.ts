import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const callStatus = formData.get("CallStatus") as string;
    const recordingUrl = formData.get("RecordingUrl") as string | null;
    const recordingSid = formData.get("RecordingSid") as string | null;
    const recordingDuration = formData.get("RecordingDuration") as string | null;

    console.log(`Inbound voice webhook - Path: ${path}, CallSid: ${callSid}, From: ${from}, Status: ${callStatus}`);

    // Handle recording callback
    if (path === "recording" && recordingUrl) {
      console.log(`Recording completed: ${recordingSid}, Duration: ${recordingDuration}s`);
      
      // Store recording in database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // You could store this in a call_recordings table if needed
      console.log(`Recording URL: ${recordingUrl}.mp3`);

      return new Response("OK", { 
        status: 200, 
        headers: { "Content-Type": "text/plain" } 
      });
    }

    // Handle call status updates
    if (path === "status") {
      console.log(`Call status update: ${callSid} -> ${callStatus}`);
      return new Response("OK", { 
        status: 200, 
        headers: { "Content-Type": "text/plain" } 
      });
    }

    // Main inbound call handler - generate TwiML
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // Get caller name if available
    const callerName = formData.get("CallerName") as string || from;

    // Build TwiML response
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>`;

    // Check if we have a connected browser client (WebRTC)
    // For now, we'll create a dial-to-browser setup
    if (twimlAppSid) {
      // Route to browser client via TwiML App
      twiml += `
  <Say voice="Polly.Joanna">Connecting your call to efinsuite Globe. Please hold.</Say>
  <Dial callerId="${from}" record="record-from-answer" recordingStatusCallback="${supabaseUrl}/functions/v1/twilio-inbound-voice/recording">
    <Client>browser-client</Client>
  </Dial>`;
    } else {
      // No browser client - take a voicemail
      twiml += `
  <Say voice="Polly.Joanna">Thank you for calling efinsuite Globe. We are unable to take your call right now. Please leave a message after the beep.</Say>
  <Record maxLength="120" playBeep="true" transcribe="true" recordingStatusCallback="${supabaseUrl}/functions/v1/twilio-inbound-voice/recording" />
  <Say voice="Polly.Joanna">Thank you for your message. Goodbye.</Say>`;
    }

    twiml += `
</Response>`;

    console.log("Generated TwiML:", twiml);

    return new Response(twiml, {
      status: 200,
      headers: { 
        "Content-Type": "application/xml",
        ...corsHeaders
      },
    });
  } catch (err: any) {
    console.error("Inbound voice error:", err);
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're sorry, but there was an error processing your call. Please try again later.</Say>
</Response>`;

    return new Response(errorTwiml, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  }
});
