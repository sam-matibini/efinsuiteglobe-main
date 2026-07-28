import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const EFINCASH_URL = 'https://efincash.lenhub.net';

const CreateSchema = z.object({
  organization_id: z.string().uuid(),
  currency: z.string().min(1).max(10),
  email: z.string().email(),
  first_name: z.string().min(1).max(100).nullable().optional(),
  last_name: z.string().min(1).max(100).nullable().optional(),
  bvn_or_nin: z.string().max(50).nullable().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apiKey = Deno.env.get('EFINCASH_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'EFINCASH_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const input = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify user is org admin/owner
    const { data: isAdmin, error: roleErr } = await admin.rpc('is_org_admin_or_owner', {
      p_user_id: userId, p_org_id: input.organization_id,
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: org admin required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent duplicates per (org, currency)
    const { data: existing } = await admin
      .from('virtual_accounts')
      .select('id, status')
      .eq('organization_id', input.organization_id)
      .eq('currency', input.currency)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: `A ${input.currency} virtual account already exists for this organization.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userKey = `org_${input.organization_id}_${input.currency.toLowerCase()}`;

    // Insert pending row
    const { data: row, error: insertErr } = await admin
      .from('virtual_accounts')
      .insert({
        organization_id: input.organization_id,
        created_by: userId,
        provider: 'efincash',
        user_key: userKey,
        currency: input.currency,
        email: input.email,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        bvn_or_nin: input.bvn_or_nin ?? null,
        status: 'pending',
      })
      .select()
      .single();
    if (insertErr || !row) {
      return new Response(JSON.stringify({ error: insertErr?.message ?? 'Insert failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call eFinCash
    const payload = {
      user_key: apiKey,
      currency: input.currency,
      email: input.email,
      bvn_or_nin: input.bvn_or_nin ?? null,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
    };

    let providerJson: any = null;
    let providerStatus = 0;
    let accessToken = '';
    try {
      const resp = await fetch(`${EFINCASH_URL}/v1/flutterwave/auth/user_api/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_key: apiKey }),
      });
      providerStatus = resp.status;
      const text = await resp.text();
      try { 
        const data = JSON.parse(text); 
        accessToken = data?.access_token ?? ''; 
        console.log('[INFO] eFinCash access token response:', data);
      } catch { 
        return new Response(JSON.stringify({ error: `[ERROR] Failed to parse access token response: ${text}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: `[ERROR] ${ (e as Error).message }` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    try {
      const resp = await fetch(`${EFINCASH_URL}/v1/flutterwave/flutter/permant/virtual/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });
      providerStatus = resp.status;
      const text = await resp.text();
      try { providerJson = JSON.parse(text); } catch { providerJson = { raw: text }; }
    } catch (e) {
      providerJson = { error: (e as Error).message };
    }

    const success = providerStatus >= 200 && providerStatus < 300;
    const d = providerJson?.data ?? providerJson ?? {};
    const accountNumber = d.account_number ?? d.accountNumber ?? d.virtual_account_number ?? null;
    const bankName = d.bank_name ?? d.bankName ?? null;
    const accountName = d.account_name ?? d.accountName ?? null;
    const providerAccountId = d.id ?? d.reference ?? d.order_ref ?? null;

    const { data: updated } = await admin
      .from('virtual_accounts')
      .update({
        status: success ? (accountNumber ? 'active' : 'pending') : 'failed',
        account_number: accountNumber,
        bank_name: bankName,
        account_name: accountName,
        provider_account_id: providerAccountId ? String(providerAccountId) : null,
        raw_response: providerJson,
      })
      .eq('id', row.id)
      .select()
      .single();

    return new Response(
      JSON.stringify({ success, virtual_account: updated ?? row, provider_status: providerStatus, provider_response: providerJson }),
      { status: success ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
