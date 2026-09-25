import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function paysafeBrowserKey(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '');
  return trimmed.includes(':') ? btoa(trimmed) : trimmed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get('payment_link_id');
    if (!linkId) {
      return new Response(JSON.stringify({ error: 'payment_link_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const publicKey = Deno.env.get('PAYSAFE_PUBLIC_KEY');
    if (!publicKey) {
      return new Response(JSON.stringify({ error: 'PAYSAFE_PUBLIC_KEY is not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const env = Deno.env.get('PAYSAFE_ENVIRONMENT') === 'live' ? 'LIVE' : 'TEST';
    const accountId = Deno.env.get('PAYSAFE_ACCOUNT_ID_CARD') ?? null;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: link, error } = await admin
      .from('payment_links')
      .select('id, reference, amount, currency, status, description')
      .eq('id', linkId)
      .single();
    if (error || !link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      publicKey: paysafeBrowserKey(publicKey),
      environment: env,
      accountId,
      link: {
        id: link.id,
        reference: link.reference,
        amount: Number(link.amount),
        amountMinor: Math.round(Number(link.amount) * 100),
        currency: (link.currency || 'CAD').toUpperCase(),
        status: link.status,
        description: link.description,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
