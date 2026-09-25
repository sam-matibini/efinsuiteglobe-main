import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND_NAME = "efinsuite Globe";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // Parse form data from Twilio webhook
    const contentType = req.headers.get("content-type") || "";
    let to = "";
    let from = "";
    let callSid = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      to = formData.get("To")?.toString() || "";
      from = formData.get("From")?.toString() || "";
      callSid = formData.get("CallSid")?.toString() || "";
      
      console.log(`TwiML App request - From: ${from}, To: ${to}, CallSid: ${callSid}`);
    }

    // Determine if this is an outbound call from browser
    // The 'To' parameter will contain the destination phone number
    // The 'From' will be the browser client identity
    
    if (to && !to.startsWith("client:")) {
      // Outbound call from browser to phone number
      // Dial the destination phone number
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting your call from ${BRAND_NAME}.</Say>
  <Dial callerId="${twilioPhone}" timeout="30" record="record-from-answer" recordingStatusCallback="${supabaseUrl}/functions/v1/twilio-inbound-voice/recording">
    <Number>${to}</Number>
  </Dial>
  <Say voice="Polly.Joanna">The call could not be completed. Goodbye.</Say>
</Response>`;

      console.log("Generating outbound TwiML to:", to);
      
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "application/xml", ...corsHeaders },
      });
    }

    // If To starts with "client:", it's a call to another browser client
    if (to && to.startsWith("client:")) {
      const clientIdentity = to.replace("client:", "");
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Connecting to ${clientIdentity}.</Say>
  <Dial timeout="30">
    <Client>${clientIdentity}</Client>
  </Dial>
  <Say voice="Polly.Joanna">The person is unavailable. Please try again later.</Say>
</Response>`;

      console.log("Generating client-to-client TwiML to:", clientIdentity);
      
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "application/xml", ...corsHeaders },
      });
    }

    // Default response if no destination
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Welcome to ${BRAND_NAME}. No destination was specified.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "application/xml", ...corsHeaders },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("TwiML App error:", err);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 200,
      headers: { "Content-Type": "application/xml", ...corsHeaders },
    });
  }
});
