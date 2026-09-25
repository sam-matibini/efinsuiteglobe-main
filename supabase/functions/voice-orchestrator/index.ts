import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND_NAME = "efinsuite Globe";

// Provider configuration
interface ProviderConfig {
  code: string;
  name: string;
  initiateCall: (params: CallParams) => Promise<ProviderCallResult>;
  getCallStatus?: (callSid: string) => Promise<string>;
}

interface CallParams {
  from: string;
  to: string;
  callbackUrl: string;
  statusCallbackUrl: string;
  sessionId: string;
}

interface ProviderCallResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

interface VoiceSession {
  id: string;
  organization_id: string;
  user_id: string;
  source_number: string;
  destination_number: string;
  source_country_code: string;
  destination_country_code: string;
  estimated_cost: number;
  rate_applied: number;
  currency: string;
}

// ============ PROVIDER IMPLEMENTATIONS ============

// Twilio Provider
async function twilioInitiateCall(params: CallParams): Promise<ProviderCallResult> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !twilioPhone) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", params.to);
    formData.append("From", twilioPhone);
    formData.append("Url", params.callbackUrl);
    formData.append("StatusCallback", params.statusCallbackUrl);
    formData.append("StatusCallbackEvent", "initiated ringing answered completed");
    formData.append("Method", "POST");

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", data);
      return { success: false, error: data.message || "Twilio call failed" };
    }

    return { success: true, callSid: data.sid };
  } catch (err: any) {
    console.error("Twilio exception:", err);
    return { success: false, error: err.message };
  }
}

// Africa's Talking Provider
async function africasTalkingInitiateCall(params: CallParams): Promise<ProviderCallResult> {
  const apiKey = Deno.env.get("AFRICAS_TALKING_API_KEY");
  const username = Deno.env.get("AFRICAS_TALKING_USERNAME");
  const callerId = Deno.env.get("AFRICAS_TALKING_CALLER_ID");

  if (!apiKey || !username) {
    return { success: false, error: "Africa's Talking credentials not configured" };
  }

  try {
    const response = await fetch("https://voice.africastalking.com/call", {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        username,
        from: callerId || params.from,
        to: params.to,
        callbackUrl: params.callbackUrl,
      }).toString(),
    });

    const data = await response.json();

    if (data.errorMessage) {
      return { success: false, error: data.errorMessage };
    }

    // Africa's Talking returns entries array
    if (data.entries && data.entries.length > 0) {
      return { success: true, callSid: data.entries[0].sessionId };
    }

    return { success: false, error: "No call entry returned" };
  } catch (err: any) {
    console.error("Africa's Talking exception:", err);
    return { success: false, error: err.message };
  }
}

// Infobip Provider
async function infobipInitiateCall(params: CallParams): Promise<ProviderCallResult> {
  const apiKey = Deno.env.get("INFOBIP_API_KEY");
  const baseUrl = Deno.env.get("INFOBIP_BASE_URL");
  const callerId = Deno.env.get("INFOBIP_CALLER_ID");

  if (!apiKey || !baseUrl) {
    return { success: false, error: "Infobip credentials not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}/calls/1/calls`, {
      method: "POST",
      headers: {
        "Authorization": `App ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: {
          type: "PHONE",
          phoneNumber: params.to,
        },
        from: callerId || params.from,
        callbackData: params.sessionId,
        notifyUrl: params.statusCallbackUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.requestError?.serviceException?.text || "Infobip call failed" };
    }

    return { success: true, callSid: data.id };
  } catch (err: any) {
    console.error("Infobip exception:", err);
    return { success: false, error: err.message };
  }
}

// Provider registry
const PROVIDERS: Record<string, ProviderConfig> = {
  twilio: {
    code: "twilio",
    name: "Twilio",
    initiateCall: twilioInitiateCall,
  },
  africas_talking: {
    code: "africas_talking",
    name: "Africa's Talking",
    initiateCall: africasTalkingInitiateCall,
  },
  infobip: {
    code: "infobip",
    name: "Infobip",
    initiateCall: infobipInitiateCall,
  },
  // Plivo, Telnyx, etc. can be added similarly
};

// ============ UTILITY FUNCTIONS ============

function extractCountryCode(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, "");
  
  // Common country codes
  if (cleaned.startsWith("1")) return cleaned.length === 11 ? "US" : "CA"; // Assume US/CA for +1
  if (cleaned.startsWith("44")) return "GB";
  if (cleaned.startsWith("49")) return "DE";
  if (cleaned.startsWith("234")) return "NG";
  if (cleaned.startsWith("254")) return "KE";
  if (cleaned.startsWith("27")) return "ZA";
  if (cleaned.startsWith("33")) return "FR";
  if (cleaned.startsWith("39")) return "IT";
  if (cleaned.startsWith("91")) return "IN";
  if (cleaned.startsWith("86")) return "CN";
  if (cleaned.startsWith("81")) return "JP";
  
  return "US"; // Default fallback
}

function normalizePhoneE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  if (!cleaned.startsWith("+")) {
    // Assume US/Canada if 10 digits
    if (cleaned.length === 10) {
      cleaned = "+1" + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      cleaned = "+" + cleaned;
    } else {
      cleaned = "+" + cleaned;
    }
  }
  
  return cleaned;
}

function calculateEstimatedCost(ratePerMinute: number, estimatedMinutes: number = 5): number {
  return Math.ceil(ratePerMinute * estimatedMinutes * 100) / 100;
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Webhook callback from provider
      const formData = await req.formData();
      const url = new URL(req.url);
      body = {
        action: url.searchParams.get("action") || "callback",
        sessionId: url.searchParams.get("sessionId"),
        leg: url.searchParams.get("leg"),
        callSid: formData.get("CallSid")?.toString(),
        callStatus: formData.get("CallStatus")?.toString(),
        duration: formData.get("CallDuration")?.toString(),
      };
    } else {
      body = await req.json();
    }

    const { action } = body;

    // ========== HEALTH CHECK ==========
    if (action === "health") {
      const providersConfigured: string[] = [];
      
      if (Deno.env.get("TWILIO_ACCOUNT_SID")) providersConfigured.push("twilio");
      if (Deno.env.get("AFRICAS_TALKING_API_KEY")) providersConfigured.push("africas_talking");
      if (Deno.env.get("INFOBIP_API_KEY")) providersConfigured.push("infobip");

      return new Response(
        JSON.stringify({
          success: true,
          brand: BRAND_NAME,
          providersConfigured,
          message: "Voice orchestrator is ready",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INITIATE HYBRID CALL ==========
    if (action === "initiate-hybrid-call") {
      const { organizationId, userId, sourceNumber, destinationNumber, enableRecording } = body;

      if (!organizationId || !sourceNumber || !destinationNumber) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedSource = normalizePhoneE164(sourceNumber);
      const normalizedDest = normalizePhoneE164(destinationNumber);
      const destCountry = extractCountryCode(normalizedDest);
      const sourceCountry = extractCountryCode(normalizedSource);

      console.log(`Initiating hybrid call: ${normalizedSource} → ${normalizedDest} (${destCountry})`);

      // 1. Get best rate and provider for destination
      const { data: rateData, error: rateError } = await supabase
        .rpc("get_best_voice_rate", { p_destination_country: destCountry, p_routing_strategy: "cost" });

      if (rateError || !rateData || rateData.length === 0) {
        // Fallback to Twilio with default rate
        console.log("No rate found, using Twilio fallback");
      }

      const rate = rateData?.[0] || {
        provider_code: "twilio",
        rate_per_minute: 0.05,
        billing_increment_seconds: 60,
        currency: "USD",
      };

      // 2. Check wallet and reserve funds (5 minutes estimated)
      const estimatedCost = calculateEstimatedCost(rate.rate_per_minute, 5);

      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from("voice_wallets")
        .select("*")
        .eq("organization_id", organizationId)
        .single();

      if (walletError || !wallet) {
        return new Response(
          JSON.stringify({ success: false, error: "No voice wallet found. Please add credits." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (wallet.balance < estimatedCost) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Insufficient balance. Required: $${estimatedCost.toFixed(2)}, Available: $${wallet.balance.toFixed(2)}` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Create call session
      const { data: session, error: sessionError } = await supabase
        .from("voice_call_sessions")
        .insert({
          organization_id: organizationId,
          user_id: userId,
          source_number: normalizedSource,
          destination_number: normalizedDest,
          source_country_code: sourceCountry,
          destination_country_code: destCountry,
          estimated_cost: estimatedCost,
          rate_applied: rate.rate_per_minute,
          currency: rate.currency,
          recording_enabled: enableRecording || false,
          call_status: "initiated",
          metadata: { provider_code: rate.provider_code },
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create call session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 4. Reserve wallet funds
      const { error: reserveError } = await supabase.rpc("reserve_voice_wallet", {
        p_organization_id: organizationId,
        p_session_id: session.id,
        p_amount: estimatedCost,
        p_currency: rate.currency,
      });

      if (reserveError) {
        console.error("Wallet reserve error:", reserveError);
        // Update session status
        await supabase.from("voice_call_sessions")
          .update({ call_status: "failed", failure_reason: "Wallet reserve failed" })
          .eq("id", session.id);

        return new Response(
          JSON.stringify({ success: false, error: reserveError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 5. Initiate Leg A (call to user's phone)
      const baseUrl = supabaseUrl.replace("/rest/v1", "");
      const legACallbackUrl = `${baseUrl}/functions/v1/voice-orchestrator?action=leg-a-twiml&sessionId=${session.id}&destNumber=${encodeURIComponent(normalizedDest)}`;
      const statusCallbackUrl = `${baseUrl}/functions/v1/voice-orchestrator?action=call-status&sessionId=${session.id}&leg=a`;

      const provider = PROVIDERS[rate.provider_code] || PROVIDERS.twilio;

      const legAResult = await provider.initiateCall({
        from: Deno.env.get("TWILIO_PHONE_NUMBER") || normalizedSource,
        to: normalizedSource,
        callbackUrl: legACallbackUrl,
        statusCallbackUrl,
        sessionId: session.id,
      });

      if (!legAResult.success) {
        // Leg A failed - release wallet reserve
        await supabase.rpc("finalize_voice_billing", {
          p_session_id: session.id,
          p_final_cost: 0,
        });

        await supabase.from("voice_call_sessions")
          .update({ call_status: "leg_a_failed", failure_reason: legAResult.error })
          .eq("id", session.id);

        // Log event
        await supabase.from("voice_call_events").insert({
          session_id: session.id,
          event_type: "leg_a_failed",
          event_data: { error: legAResult.error, provider: provider.code },
        });

        return new Response(
          JSON.stringify({ success: false, error: legAResult.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update session with Leg A SID
      await supabase.from("voice_call_sessions")
        .update({ 
          leg_a_call_sid: legAResult.callSid,
          call_status: "leg_a_ringing",
        })
        .eq("id", session.id);

      // Log event
      await supabase.from("voice_call_events").insert({
        session_id: session.id,
        event_type: "leg_a_initiated",
        event_data: { callSid: legAResult.callSid, provider: provider.code },
      });

      return new Response(
        JSON.stringify({
          success: true,
          sessionId: session.id,
          callSid: legAResult.callSid,
          estimatedCost,
          ratePerMinute: rate.rate_per_minute,
          provider: provider.name,
          message: `Calling ${normalizedSource}...`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LEG A TwiML (User answers, bridge to destination) ==========
    if (action === "leg-a-twiml") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      const destNumber = url.searchParams.get("destNumber");

      if (!sessionId || !destNumber) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, call parameters are missing.</Say>
  <Hangup/>
</Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }

      // Update session - user answered
      await supabase.from("voice_call_sessions")
        .update({ 
          call_status: "leg_a_answered",
          leg_a_answered_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      await supabase.from("voice_call_events").insert({
        session_id: sessionId,
        event_type: "leg_a_answered",
        event_data: {},
      });

      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
      const baseUrl = supabaseUrl.replace("/rest/v1", "");
      const legBStatusUrl = `${baseUrl}/functions/v1/voice-orchestrator?action=call-status&sessionId=${sessionId}&leg=b`;

      // TwiML to announce and bridge to destination
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${BRAND_NAME} is connecting your call. Please hold.</Say>
  <Dial callerId="${twilioPhone}" timeout="45" action="${baseUrl}/functions/v1/voice-orchestrator?action=dial-complete&amp;sessionId=${sessionId}">
    <Number statusCallback="${legBStatusUrl}" statusCallbackEvent="initiated ringing answered completed">${destNumber}</Number>
  </Dial>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // ========== DIAL COMPLETE (Call ended) ==========
    if (action === "dial-complete") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
          { headers: { ...corsHeaders, "Content-Type": "application/xml" } }
        );
      }

      // Get call duration from form data
      const formData = await req.formData().catch(() => null);
      const dialCallDuration = formData?.get("DialCallDuration")?.toString() || "0";
      const dialCallStatus = formData?.get("DialCallStatus")?.toString() || "completed";
      const durationSeconds = parseInt(dialCallDuration, 10);

      // Get session details
      const { data: session } = await supabase
        .from("voice_call_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (session) {
        // Use enhanced billing function with accounting integration
        // Formula: charge = ceil(duration_seconds / billing_increment) × rate_per_minute / 60
        const { data: billingResult, error: billingError } = await supabase.rpc(
          "finalize_voice_billing_with_accounting",
          {
            p_session_id: sessionId,
            p_duration_seconds: durationSeconds,
            p_create_journal_entry: true, // Auto-post: DR Comm Expense, CR Wallet Asset
          }
        );

        let finalCost = 0;
        let billableSeconds = 0;
        let journalEntryId = null;

        if (billingError) {
          console.error("Billing error, falling back:", billingError);
          // Fallback to manual calculation
          const billingIncrement = session.billing_increment_seconds || 60;
          billableSeconds = Math.ceil(durationSeconds / billingIncrement) * billingIncrement;
          finalCost = (billableSeconds / 60) * session.rate_applied;
          
          // Try legacy finalize
          await supabase.rpc("finalize_voice_billing", {
            p_session_id: sessionId,
            p_final_cost: finalCost,
          });
        } else if (billingResult && billingResult.length > 0) {
          finalCost = billingResult[0].final_cost;
          billableSeconds = billingResult[0].billable_seconds;
          journalEntryId = billingResult[0].journal_entry_id;
        }

        // Update session status
        await supabase.from("voice_call_sessions")
          .update({
            call_status: "completed",
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            billable_seconds: billableSeconds,
            final_cost: finalCost,
          })
          .eq("id", sessionId);

        // Log event with accounting reference
        await supabase.from("voice_call_events").insert({
          session_id: sessionId,
          event_type: "call_completed",
          event_data: { 
            duration_seconds: durationSeconds,
            billable_seconds: billableSeconds,
            final_cost: finalCost,
            dial_status: dialCallStatus,
            journal_entry_id: journalEntryId,
            accounting_posted: !!journalEntryId,
          },
        });

        console.log(`Call completed: ${durationSeconds}s → ${billableSeconds}s billable → $${finalCost} ${journalEntryId ? '(JE:' + journalEntryId + ')' : ''}`);
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for using ${BRAND_NAME}. Goodbye.</Say>
  <Hangup/>
</Response>`;

      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    // ========== CALL STATUS CALLBACK ==========
    if (action === "call-status") {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get("sessionId");
      const leg = url.searchParams.get("leg");

      if (!sessionId) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { callStatus, duration, callSid } = body;

      console.log(`Call status [${leg}]: ${callStatus} for session ${sessionId}`);

      // Log event
      await supabase.from("voice_call_events").insert({
        session_id: sessionId,
        event_type: `${leg}_${callStatus}`,
        event_data: { callSid, duration },
      });

      // Update session based on status
      if (leg === "b") {
        if (callStatus === "answered") {
          await supabase.from("voice_call_sessions")
            .update({
              call_status: "bridged",
              leg_b_answered_at: new Date().toISOString(),
              bridged_at: new Date().toISOString(),
              leg_b_call_sid: callSid,
            })
            .eq("id", sessionId);
        } else if (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
          await supabase.from("voice_call_sessions")
            .update({
              call_status: "leg_b_failed",
              failure_reason: callStatus,
            })
            .eq("id", sessionId);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== GET SESSION STATUS ==========
    if (action === "get-session") {
      const { sessionId } = body;

      if (!sessionId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing sessionId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session, error } = await supabase
        .from("voice_call_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET CALL HISTORY ==========
    if (action === "get-call-history") {
      const { organizationId, limit = 50 } = body;

      if (!organizationId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: sessions, error } = await supabase
        .from("voice_call_sessions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("initiated_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, sessions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET WALLET ==========
    if (action === "get-wallet") {
      const { organizationId } = body;

      if (!organizationId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: wallet, error } = await supabase
        .from("voice_wallets")
        .select("*")
        .eq("organization_id", organizationId)
        .single();

      if (error && error.code !== "PGRST116") {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, wallet: wallet || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET RATES ==========
    if (action === "get-rates") {
      const { countryCode } = body;

      let query = supabase
        .from("voice_call_rates")
        .select(`
          *,
          provider:voice_providers(code, name)
        `)
        .eq("is_active", true);

      if (countryCode) {
        query = query.eq("country_code", countryCode);
      }

      const { data: rates, error } = await query.order("rate_per_minute", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, rates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET PROVIDERS ==========
    if (action === "get-providers") {
      const { data: providers, error } = await supabase
        .from("voice_providers")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, providers }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET ROUTING ==========
    if (action === "get-routing") {
      const { data: routes, error } = await supabase
        .from("voice_provider_routes")
        .select(`
          *,
          primary_provider:voice_providers!voice_provider_routes_primary_provider_id_fkey(code, name),
          secondary_provider:voice_providers!voice_provider_routes_secondary_provider_id_fkey(code, name),
          failover_provider:voice_providers!voice_provider_routes_failover_provider_id_fkey(code, name)
        `)
        .eq("is_active", true);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, routes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET WALLET TRANSACTIONS ==========
    if (action === "get-wallet-transactions") {
      const { organizationId, limit = 20 } = body;

      if (!organizationId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing organizationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // First get the wallet for this organization
      const { data: wallet, error: walletError } = await supabase
        .from("voice_wallets")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (walletError) {
        return new Response(
          JSON.stringify({ success: false, error: walletError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!wallet) {
        return new Response(
          JSON.stringify({ success: true, transactions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Then get transactions for that wallet
      const { data: transactions, error } = await supabase
        .from("voice_wallet_transactions")
        .select("id, transaction_type, amount, description, created_at, status")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, transactions: transactions || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== TOPUP WALLET ==========
    if (action === "topup-wallet") {
      const { organizationId, amount, paymentMethod, description } = body;

      if (!organizationId || !amount) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing organizationId or amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get or create wallet
      let { data: wallet, error: walletError } = await supabase
        .from("voice_wallets")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (walletError) {
        return new Response(
          JSON.stringify({ success: false, error: walletError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create wallet if it doesn't exist
      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from("voice_wallets")
          .insert({
            organization_id: organizationId,
            balance: 0,
            currency: "USD",
            low_balance_threshold: 10,
            auto_recharge_enabled: false,
          })
          .select()
          .single();

        if (createError) {
          return new Response(
            JSON.stringify({ success: false, error: createError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        wallet = newWallet;
      }

      // Update wallet balance
      const newBalance = wallet.balance + amount;
      const { error: updateError } = await supabase
        .from("voice_wallets")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create transaction record (without organization_id as it's not in the schema)
      await supabase
        .from("voice_wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          transaction_type: "topup",
          amount: amount,
          currency: wallet.currency || "USD",
          description: description || `Wallet top-up via ${paymentMethod || "manual"}`,
          status: "completed",
          reference: `TOPUP-${Date.now()}`,
        });

      console.log(`Wallet topped up: org=${organizationId}, amount=${amount}, newBalance=${newBalance}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          wallet: { ...wallet, balance: newBalance },
          message: `Successfully added $${amount.toFixed(2)} to your wallet`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Voice orchestrator error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
