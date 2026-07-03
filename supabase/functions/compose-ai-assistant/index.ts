import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AIRequest {
  action: 'compose' | 'rewrite' | 'grammar' | 'shorten' | 'expand' | 'professional' | 'friendly';
  content: string;
  channel: 'email' | 'sms' | 'whatsapp';
  context?: string;
  numDrafts?: number; // Number of drafts to generate (default 3)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, content, channel, context, numDrafts = 3 } = await req.json() as AIRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`AI Compose Assistant: action=${action}, channel=${channel}, numDrafts=${numDrafts}`);

    const channelDescription = channel === 'email' ? 'emails' : channel === 'sms' ? 'SMS messages' : 'WhatsApp messages';
    const formatNote = channel !== 'email' 
      ? 'Keep it concise as this is for mobile messaging.' 
      : 'Format properly with greeting and sign-off.';

    // System prompts for generating multiple drafts
    const systemPrompts: Record<string, string> = {
      compose: `You are an expert business communication assistant for ${channelDescription}. 
Help the user compose a professional message based on their prompt. 
${formatNote}
Generate exactly ${numDrafts} different versions of the message, each with a distinct style or approach.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the message text
- "style": a short label describing this version (e.g., "Formal", "Friendly", "Concise")
Example format: [{"draft": "message text", "style": "Formal"}, ...]
Only output valid JSON, no other text.`,

      rewrite: `You are a professional editor. Rewrite the following ${channel} message to improve clarity, flow, and impact.
Generate exactly ${numDrafts} different rewrites, each with a distinct approach.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the rewritten message
- "style": a short label (e.g., "Polished", "Modern", "Dynamic")
Only output valid JSON, no other text.`,

      grammar: `You are a grammar and spelling expert. Fix any grammar, spelling, punctuation, or syntax errors.
Generate exactly ${numDrafts} variations with different levels of editing.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the corrected message
- "style": a short label (e.g., "Minimal Edits", "Refined", "Thorough")
Only output valid JSON, no other text.`,

      shorten: `You are an expert at concise communication. Shorten the following ${channel} message.
${channel !== 'email' ? 'This is for mobile - be very brief.' : 'Remove unnecessary words and redundancies.'}
Generate exactly ${numDrafts} versions at different lengths.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the shortened message
- "style": a short label (e.g., "Ultra-Brief", "Balanced", "Slightly Shorter")
Only output valid JSON, no other text.`,

      expand: `You are an expert communicator. Expand and elaborate on the following ${channel} message.
Keep it professional and relevant.
Generate exactly ${numDrafts} expanded versions with different approaches.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the expanded message
- "style": a short label (e.g., "Detailed", "Warm", "Comprehensive")
Only output valid JSON, no other text.`,

      professional: `You are a business communication expert. Rewrite in a formal, professional tone.
Generate exactly ${numDrafts} professional variations.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the professional message
- "style": a short label (e.g., "Executive", "Corporate", "Business Formal")
Only output valid JSON, no other text.`,

      friendly: `You are a communication expert. Rewrite in a warmer, conversational tone.
Keep it professional but approachable.
Generate exactly ${numDrafts} friendly variations.
Format your response as a JSON array with exactly ${numDrafts} objects, each containing:
- "draft": the friendly message
- "style": a short label (e.g., "Warm", "Casual", "Personable")
Only output valid JSON, no other text.`,
    };

    const systemPrompt = systemPrompts[action] || systemPrompts.rewrite;

    const userMessage = action === 'compose' 
      ? `Create a ${channel} message for the following: ${content}${context ? `\n\nAdditional context: ${context}` : ''}`
      : content;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.8, // Slightly higher for variety
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawResult = data.choices?.[0]?.message?.content || '';

    // Try to parse as JSON array of drafts
    let drafts: Array<{ draft: string; style: string }> = [];
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanedResult = rawResult.trim();
      if (cleanedResult.startsWith('```json')) {
        cleanedResult = cleanedResult.slice(7);
      } else if (cleanedResult.startsWith('```')) {
        cleanedResult = cleanedResult.slice(3);
      }
      if (cleanedResult.endsWith('```')) {
        cleanedResult = cleanedResult.slice(0, -3);
      }
      cleanedResult = cleanedResult.trim();
      
      const parsed = JSON.parse(cleanedResult);
      if (Array.isArray(parsed)) {
        drafts = parsed.map((item: any, index: number) => ({
          draft: item.draft || item.text || item.message || String(item),
          style: item.style || item.label || `Option ${index + 1}`,
        }));
      }
    } catch (parseError) {
      console.warn("Failed to parse JSON, falling back to single result:", parseError);
      // Fallback: treat as single result for backward compatibility
      drafts = [{ draft: rawResult, style: "Generated" }];
    }

    // Ensure we have at least one draft
    if (drafts.length === 0) {
      drafts = [{ draft: rawResult, style: "Generated" }];
    }

    console.log(`AI Compose Assistant: success, ${drafts.length} drafts generated`);

    return new Response(JSON.stringify({ 
      drafts,
      // Keep 'result' for backward compatibility (first draft)
      result: drafts[0]?.draft || rawResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Compose AI error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});