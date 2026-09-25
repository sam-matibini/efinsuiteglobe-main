import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ReceiptSchema = z.object({
  vendor_name: z.string().nullable().optional(),
  expense_date: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  subtotal: z.number().nullable().optional(),
  tax_amount: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  category_suggestion: z
    .enum([
      'travel',
      'meals',
      'office_supplies',
      'software',
      'equipment',
      'professional_development',
      'communication',
      'transportation',
      'lodging',
      'other',
    ])
    .nullable()
    .optional(),
  line_items: z.array(z.object({ description: z.string(), amount: z.number() })).nullable().optional(),
});

// Convert "1,234.56" / "1.234,56" / "$1,234.56 USD" → 1234.56
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/[^\d.,\-]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Use the rightmost as decimal sep
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Only commas — treat as decimal if 1-2 digits after, else thousands
    const after = s.length - lastComma - 1;
    s = after === 1 || after === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function normalize(parsed: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...parsed };
  for (const k of ['subtotal', 'tax_amount', 'total'] as const) {
    out[k] = toNumber(parsed[k]);
  }
  if (Array.isArray(parsed.line_items)) {
    out.line_items = parsed.line_items
      .map((li: any) => ({ description: String(li?.description ?? ''), amount: toNumber(li?.amount) ?? 0 }))
      .filter((li: any) => li.description);
  }
  const sub = out.subtotal as number | null;
  const tax = out.tax_amount as number | null;
  const tot = out.total as number | null;
  // Fill gaps
  if (tot != null && sub == null && tax != null) out.subtotal = Math.max(0, +(tot - tax).toFixed(2));
  if (tot != null && tax == null && sub != null) out.tax_amount = Math.max(0, +(tot - sub).toFixed(2));
  if (tot == null && sub != null && tax != null) out.total = +(sub + tax).toFixed(2);
  // Clamp negatives
  for (const k of ['subtotal', 'tax_amount', 'total'] as const) {
    const n = out[k] as number | null;
    if (typeof n === 'number' && n < 0) out[k] = Math.abs(n);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { fileBase64, mimeType, fileName } = body ?? {};
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const isPdf = mimeType === 'application/pdf';

    // OpenAI-compatible multimodal content block.
    // For PDFs the AI SDK openai-compatible converter doesn't support file parts,
    // so we POST chat-completions directly to the Lovable AI Gateway.
    const contentBlock = isPdf
      ? {
          type: 'file',
          file: {
            filename: fileName || 'receipt.pdf',
            file_data: dataUrl,
          },
        }
      : {
          type: 'image_url',
          image_url: { url: dataUrl },
        };

    const systemPrompt =
      'You are an expert receipt and invoice analyzer. Extract key fields precisely. Output raw numbers only — no currency symbols, no thousands separators. Use ISO date YYYY-MM-DD. If unsure, use null.';

    const userPrompt =
      'Extract structured data from this receipt/invoice. Respond ONLY with a JSON object (no prose, no code fences) matching this schema: ' +
      '{"vendor_name": string|null, "expense_date": string|null, "currency": string|null, "subtotal": number|null, "tax_amount": number|null, "total": number|null, "description": string|null, "category_suggestion": one of [travel, meals, office_supplies, software, equipment, professional_development, communication, transportation, lodging, other]|null, "line_items": [{"description": string, "amount": number}]|null}. ' +
      'subtotal is pre-tax. tax_amount is total sales tax (GST/HST/VAT/PST). total is the grand total paid. Ensure subtotal + tax_amount ≈ total when possible.';

    const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': lovableKey,
        'X-Lovable-AIG-SDK': 'vercel-ai-sdk',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              contentBlock,
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      console.error('gateway error', gwRes.status, errText);
      return new Response(JSON.stringify({ error: `AI gateway ${gwRes.status}: ${errText.slice(0, 500)}` }), {
        status: gwRes.status === 429 || gwRes.status === 402 ? gwRes.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gwJson = await gwRes.json();
    let text: string = gwJson?.choices?.[0]?.message?.content ?? '';
    if (typeof text !== 'string') text = JSON.stringify(text);
    text = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Model did not return JSON');
      parsed = JSON.parse(match[0]);
    }

    const normalized = normalize(parsed);
    const validated = ReceiptSchema.parse(normalized);

    return new Response(JSON.stringify({ data: validated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('analyze-receipt error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
