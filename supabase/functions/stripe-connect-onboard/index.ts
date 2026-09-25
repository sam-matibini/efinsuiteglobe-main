// Creates a Stripe Express/Standard connected account and returns an onboarding link.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  organization_id: string;
  account_type?: 'express' | 'standard' | 'custom';
  country?: string;
  email?: string;
  business_type?: 'individual' | 'company' | 'non_profit' | 'government_entity';
  return_url: string;
  refresh_url: string;
  connected_account_id?: string; // resume onboarding for existing account
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not set' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub;

    const body = (await req.json()) as Body;
    if (!body.organization_id || !body.return_url || !body.refresh_url) {
      return json({ error: 'organization_id, return_url, refresh_url required' }, 400);
    }

    const { data: isMember } = await admin.rpc('is_org_member' as any, { _user_id: userId, _org_id: body.organization_id } as any);
    if (!isMember) return json({ error: 'Forbidden' }, 403);

    let stripeAccountId = body.connected_account_id ? null : null;
    let connectedRow: any = null;

    if (body.connected_account_id) {
      const { data } = await admin.from('stripe_connected_accounts').select('*').eq('id', body.connected_account_id).maybeSingle();
      if (!data) return json({ error: 'Account not found' }, 404);
      connectedRow = data;
      stripeAccountId = data.stripe_account_id;
    } else {
      const params: Record<string, string> = {
        type: body.account_type ?? 'express',
        ...(body.country ? { country: body.country } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.business_type ? { business_type: body.business_type } : {}),
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
      };
      const acctRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      const acct = await acctRes.json();
      if (!acctRes.ok) {
        const msg: string = acct?.error?.message ?? 'Stripe account create failed';
        const isPlatformProfile = /platform-profile|managing losses/i.test(msg);
        return json({
          error: msg,
          code: isPlatformProfile ? 'platform_profile_incomplete' : acct?.error?.code,
          doc_url: acct?.error?.doc_url ?? 'https://dashboard.stripe.com/settings/connect/platform-profile',
          param: acct?.error?.param,
          hint: isPlatformProfile
            ? 'Complete your Stripe Connect Platform Profile (loss liability section) in the same mode (test/live) as your STRIPE_SECRET_KEY, then retry.'
            : undefined,
        }, isPlatformProfile ? 422 : 500);
      }

      stripeAccountId = acct.id;

      const { data: inserted, error: insErr } = await admin.from('stripe_connected_accounts').insert({
        organization_id: body.organization_id,
        stripe_account_id: acct.id,
        account_type: body.account_type ?? 'express',
        country: acct.country,
        default_currency: acct.default_currency,
        email: acct.email,
        business_profile: acct.business_profile ?? {},
        capabilities: acct.capabilities ?? {},
        requirements: acct.requirements ?? {},
        charges_enabled: !!acct.charges_enabled,
        payouts_enabled: !!acct.payouts_enabled,
        details_submitted: !!acct.details_submitted,
        last_synced_at: new Date().toISOString(),
      }).select('*').single();
      if (insErr) return json({ error: insErr.message }, 500);
      connectedRow = inserted;
    }

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        account: stripeAccountId!,
        refresh_url: body.refresh_url,
        return_url: body.return_url,
        type: 'account_onboarding',
      }),
    });
    const link = await linkRes.json();
    if (!linkRes.ok) return json({ error: link?.error?.message ?? 'account_links failed' }, 500);

    return json({ ok: true, connected_account: connectedRow, onboarding_url: link.url, expires_at: link.expires_at });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
