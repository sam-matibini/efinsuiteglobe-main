// Mint a Stripe processor token from a Plaid-linked bank account and attach it
// to Stripe to enable ACH debits/credits from Treasury.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bank_account_id } = await req.json();
    if (!bank_account_id || typeof bank_account_id !== 'string') {
      return new Response(JSON.stringify({ error: 'bank_account_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: bank, error: bErr } = await supabase
      .from('bank_accounts')
      .select('id, name, plaid_access_token, plaid_account_id, stripe_bank_account_id')
      .eq('id', bank_account_id)
      .single();
    if (bErr || !bank) {
      return new Response(JSON.stringify({ error: 'Bank account not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!bank.plaid_access_token || !bank.plaid_account_id) {
      return new Response(JSON.stringify({ error: 'Bank account is not Plaid-linked' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID');
    const PLAID_SECRET = Deno.env.get('PLAID_SECRET');
    const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox';
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) throw new Error('Plaid not configured');
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');

    const plaidHost =
      PLAID_ENV === 'production' ? 'https://production.plaid.com'
      : PLAID_ENV === 'development' ? 'https://development.plaid.com'
      : 'https://sandbox.plaid.com';

    // 1. Create Stripe bank account token via Plaid processor endpoint
    const pRes = await fetch(`${plaidHost}/processor/stripe/bank_account_token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: bank.plaid_access_token,
        account_id: bank.plaid_account_id,
      }),
    });
    const pData = await pRes.json();
    if (!pRes.ok || !pData.stripe_bank_account_token) {
      throw new Error(`Plaid error: ${pData?.error_message ?? pData?.display_message ?? pRes.status}`);
    }
    const btok = pData.stripe_bank_account_token as string;

    // 2. Create a Stripe Token-backed BankAccount on the platform account.
    // We attach it as a top-level bank account (for ACH debits) by creating a Token-source.
    // For destination payouts, Stripe expects /v1/accounts/{acct}/external_accounts;
    // for ACH debits from a customer, /v1/customers/{cus}/sources. We use the platform-level
    // /v1/tokens to retrieve the ba_... id directly from the btok (Stripe returns it embedded).
    const tokRes = await fetch(`https://api.stripe.com/v1/tokens/${btok}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const tokData = await tokRes.json();
    if (!tokRes.ok) {
      throw new Error(`Stripe token lookup failed: ${tokData?.error?.message ?? tokRes.status}`);
    }
    const baId = tokData?.bank_account?.id as string | undefined;
    if (!baId) throw new Error('Stripe did not return a bank account id');

    // 3. Persist on bank_accounts
    const { error: uErr } = await supabase
      .from('bank_accounts')
      .update({
        stripe_bank_account_id: baId,
        stripe_processor_token_created_at: new Date().toISOString(),
      })
      .eq('id', bank_account_id);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({
      success: true,
      stripe_bank_account_id: baId,
      bank_name: bank.name,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('plaid-stripe-processor-token error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
