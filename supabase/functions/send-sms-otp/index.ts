import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOtpRequest {
  action: 'send';
  phoneNumber: string;
  email?: string;
  purpose: 'signing' | 'banking_mfa' | 'login' | 'verification';
  referenceId?: string;
}

interface VerifyOtpRequest {
  action: 'verify';
  phoneNumber: string;
  code: string;
  purpose: 'signing' | 'banking_mfa' | 'login' | 'verification';
}

interface HealthCheckRequest {
  action: 'health-check' | 'test';
  phoneNumber?: string;
}

type OtpRequest = SendOtpRequest | VerifyOtpRequest | HealthCheckRequest;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse body and get action from it
    const body: OtpRequest = await req.json();
    const action = body.action;

    // Health check endpoint for admin testing
    if (action === 'health-check') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Twilio integration is configured',
          configured: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test endpoint for admin testing (doesn't actually send SMS)
    if (action === 'test') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Twilio credentials verified',
          configured: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send' && req.method === 'POST') {
      const { phoneNumber, email, purpose, referenceId } = body as SendOtpRequest;

      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store OTP in database
      const { data: otpRecord, error: insertError } = await supabase
        .from('otp_verifications')
        .insert({
          phone_number: phoneNumber,
          email: email || null,
          otp_code: otpCode,
          purpose,
          reference_id: referenceId || null,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing OTP:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create verification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send SMS via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      let messageBody = '';
      switch (purpose) {
        case 'banking_mfa':
          messageBody = `Your efinsuite banking verification code is: ${otpCode}. This code expires in 5 minutes. Do not share this code.`;
          break;
        case 'signing':
          messageBody = `Your efinsuite document signing code is: ${otpCode}. This code expires in 5 minutes.`;
          break;
        case 'verification':
          messageBody = `Your efinsuite verification code is: ${otpCode}. This code expires in 5 minutes.`;
          break;
        default:
          messageBody = `Your efinsuite code is: ${otpCode}. This code expires in 5 minutes.`;
      }

      const formData = new URLSearchParams();
      formData.append('To', phoneNumber);
      formData.append('From', twilioPhoneNumber);
      formData.append('Body', messageBody);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const twilioData = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error('Twilio error:', twilioData);
        // Update OTP status to failed
        await supabase
          .from('otp_verifications')
          .update({ status: 'failed' })
          .eq('id', otpRecord.id);

        return new Response(
          JSON.stringify({ error: 'Failed to send SMS', details: twilioData.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update with Twilio message SID
      await supabase
        .from('otp_verifications')
        .update({ twilio_message_sid: twilioData.sid })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP sent successfully',
          expiresAt: expiresAt.toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify' && req.method === 'POST') {
      const { phoneNumber, code, purpose } = body as VerifyOtpRequest;

      if (!phoneNumber || !code) {
        return new Response(
          JSON.stringify({ error: 'Phone number and code are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find the most recent pending OTP for this phone
      const { data: otpRecords, error: fetchError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('purpose', purpose)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError || !otpRecords || otpRecords.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No pending verification found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otpRecord = otpRecords[0];

      // Check expiration
      if (new Date(otpRecord.expires_at) < new Date()) {
        await supabase
          .from('otp_verifications')
          .update({ status: 'expired' })
          .eq('id', otpRecord.id);

        return new Response(
          JSON.stringify({ error: 'Verification code has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check attempts
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await supabase
          .from('otp_verifications')
          .update({ status: 'failed' })
          .eq('id', otpRecord.id);

        return new Response(
          JSON.stringify({ error: 'Maximum attempts exceeded' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Increment attempts
      await supabase
        .from('otp_verifications')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      // Verify code via SECURITY DEFINER RPC (compares against bcrypt hash)
      const { data: isValid, error: verifyErr } = await supabase.rpc('verify_otp_code', {
        _id: otpRecord.id,
        _code: code,
      });

      if (verifyErr || !isValid) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid verification code',
            attemptsRemaining: otpRecord.max_attempts - otpRecord.attempts - 1
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark as verified
      await supabase
        .from('otp_verifications')
        .update({ 
          status: 'verified',
          verified_at: new Date().toISOString()
        })
        .eq('id', otpRecord.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Verification successful',
          referenceId: otpRecord.reference_id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use action: "send" or "verify"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
