import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to E.164 format
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

// Determine channel from Twilio From/To fields
function determineChannel(from: string, to: string): 'sms' | 'whatsapp' {
  if (from.startsWith('whatsapp:') || to.startsWith('whatsapp:')) {
    return 'whatsapp';
  }
  return 'sms';
}

// Strip whatsapp: prefix if present
function cleanPhoneNumber(phone: string): string {
  return normalizePhoneNumber(phone.replace(/^whatsapp:/i, ''));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role client for webhook operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-urlencoded)
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    console.log("Received Twilio webhook:", JSON.stringify(payload, null, 2));

    // Determine if this is an inbound message or a status callback
    // Inbound messages have a Body field and SmsStatus/MessageStatus of "received"
    // Status callbacks have MessageStatus but no Body (or empty Body for status updates)
    const messageStatus = payload.MessageStatus || payload.SmsStatus;
    const hasBody = payload.Body !== undefined && payload.Body !== '';
    // Some inbound payloads omit MessageStatus/SmsStatus; treat any payload with Body as inbound
    // unless it is clearly a delivery status callback.
    const isInboundMessage = hasBody && (messageStatus === 'received' || !messageStatus);
    
    // If this is a status callback (not an inbound message), update status and return
    if (messageStatus && !isInboundMessage) {
      // This is a delivery status update for an outbound message
      console.log(`Status callback: ${messageStatus} for message ${payload.MessageSid || payload.SmsSid}`);
      
      // Optionally update message status in database
       const statusSid = payload.MessageSid || payload.SmsSid || payload.SmsMessageSid;
       if (statusSid) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ status: messageStatus })
           .eq('external_id', statusSid);
        
        if (updateError) {
          console.log("Could not update message status:", updateError.message);
        } else {
          console.log(`Updated message status to: ${messageStatus}`);
        }
      }
      
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "text/xml" } 
        }
      );
    }
    
    console.log("Processing as inbound message, Body:", payload.Body);

    // Extract message details for inbound messages
    const messageSid = payload.MessageSid || payload.SmsSid || payload.SmsMessageSid;
    const from = payload.From || '';
    const to = payload.To || '';
    const body = payload.Body || '';
    const numMedia = parseInt(payload.NumMedia || '0', 10);

    // Inbound messages MUST have a Body field
    if (!messageSid || !from || !to || body === undefined) {
      console.log("Not an inbound message or missing required fields");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "text/xml" } 
        }
      );
    }

    const channel = determineChannel(from, to);
    const cleanedFrom = cleanPhoneNumber(from);
    const cleanedTo = cleanPhoneNumber(to);

    // Collect media URLs if present
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}`];
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    // Route inbound replies to the organization/conversation that most recently messaged this contact.
    // This avoids “split threads” when the same contact exists across multiple organizations.
    let organizationId: string | null = null;
    let routedConversationId: string | null = null;

    const toIdentifierVariants = Array.from(
      new Set([
        cleanedFrom,
        cleanedFrom.replace(/^\+/, ''),
        cleanedFrom.replace(/^\+1/, ''),
        cleanedFrom.slice(-10),
      ].filter(Boolean))
    );

    const { data: lastOutbound } = await supabase
      .from('messages')
      .select('organization_id, conversation_id')
      .eq('channel', channel)
      .eq('direction', 'outbound')
      .in('to_identifier', toIdentifierVariants)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastOutbound?.organization_id && lastOutbound?.conversation_id) {
      organizationId = lastOutbound.organization_id;
      routedConversationId = lastOutbound.conversation_id;
      console.log(`Routing via last outbound message -> org ${organizationId}, conversation ${routedConversationId}`);
    } else {
      // Fallback: try most recent conversation for this contact/channel
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id, organization_id')
        .eq('contact_identifier', cleanedFrom)
        .eq('channel', channel)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConvo) {
        organizationId = existingConvo.organization_id;
        routedConversationId = existingConvo.id;
        console.log(`Found existing conversation, using org ${organizationId}, conversation ${routedConversationId}`);
      } else {
        // Last resort: use most recently active organization
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id')
          .order('updated_at', { ascending: false })
          .limit(1);

        organizationId = orgs?.[0]?.id || null;
        console.log(`No conversation context, using default organization: ${organizationId}`);
      }
    }

    if (!organizationId) {
      console.error("No organization found for incoming message");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "text/xml" } 
        }
      );
    }

    // Find or create conversation (prefer routedConversationId when available)
    let conversationId: string;

    if (routedConversationId) {
      conversationId = routedConversationId;
    } else {
      const { data: convoForMessage } = await supabase
        .from('conversations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('contact_identifier', cleanedFrom)
        .eq('channel', channel)
        .maybeSingle();

      if (convoForMessage) {
        conversationId = convoForMessage.id;
      } else {
        // Create new conversation
        const { data: newConvo, error: convoError } = await supabase
          .from('conversations')
          .insert({
            organization_id: organizationId,
            contact_identifier: cleanedFrom,
            contact_name: null, // Could be enriched later
            channel: channel,
          })
          .select('id')
          .single();

        if (convoError) {
          console.error("Error creating conversation:", convoError);
          throw convoError;
        }
        conversationId = newConvo.id;
      }
    }

    // Insert the inbound message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        channel: channel,
        direction: 'inbound',
        from_identifier: cleanedFrom,
        to_identifier: cleanedTo,
        body: body,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        status: 'received',
        external_id: messageSid,
        is_read: false,
      });

    if (msgError) {
      console.error("Error inserting message:", msgError);
      throw msgError;
    }

    console.log(`Inbound ${channel} message stored from ${cleanedFrom}`);

    // Return empty TwiML response (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "text/xml" } 
      }
    );

  } catch (err: any) {
    console.error("Webhook error:", err);
    // Still return 200 to prevent Twilio retries
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "text/xml" } 
      }
    );
  }
});
