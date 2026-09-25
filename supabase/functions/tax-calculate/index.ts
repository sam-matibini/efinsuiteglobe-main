// supabase/functions/tax-calculate/index.ts
// Public-ish tax calculation API for external integrations (POS, e-commerce).
// Returns a split tax breakdown for a given amount, jurisdiction, and (optionally)
// customer/product. Manual JWT verification — caller must include a valid bearer.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CalcInput {
  amount: number;
  jurisdiction: string;     // e.g. 'CA-ON', 'CA-BC', 'US-CA'
  customer_id?: string;
  product_id?: string;
  date?: string;            // YYYY-MM-DD
  inclusive?: boolean;
  organization_id?: string; // optional explicit override
}

interface ResolvedTax {
  code: string;
  name: string;
  rate: number;
  type: string;
  authority: string | null;
  is_recoverable: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as CalcInput;
    if (
      typeof body.amount !== 'number' ||
      !isFinite(body.amount) ||
      body.amount < 0 ||
      typeof body.jurisdiction !== 'string' ||
      body.jurisdiction.length < 2
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: amount (number ≥ 0) and jurisdiction (string) required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const inclusive = Boolean(body.inclusive);
    const onDate = body.date ?? new Date().toISOString().slice(0, 10);

    // Resolve organization
    let orgId = body.organization_id;
    if (!orgId) {
      const { data: memberships } = await sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .limit(1);
      orgId = memberships?.[0]?.organization_id;
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'No organization context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Customer exemption check
    if (body.customer_id) {
      const { data: customer } = await sb
        .from('customers')
        .select('id, tax_exempt')
        .eq('id', body.customer_id)
        .maybeSingle();
      if (customer && (customer as any).tax_exempt) {
        return new Response(
          JSON.stringify({
            taxable_amount: round2(body.amount),
            taxes: [],
            total_tax: 0,
            grand_total: round2(body.amount),
            inclusive,
            jurisdiction: body.jurisdiction,
            notes: 'Customer is tax exempt',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Resolve applicable tax codes for jurisdiction within effective date window
    const { data: codes, error: codesErr } = await sb
      .from('tax_codes')
      .select(
        'id, code, name, tax_type, jurisdiction_code, is_active, effective_date, expiry_date, is_recoverable, tax_authority_id, tax_authorities(name)',
      )
      .eq('organization_id', orgId)
      .eq('jurisdiction_code', body.jurisdiction)
      .eq('is_active', true);

    if (codesErr) {
      return new Response(JSON.stringify({ error: codesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eligible = (codes ?? []).filter((c: any) => {
      if (c.effective_date && c.effective_date > onDate) return false;
      if (c.expiry_date && c.expiry_date < onDate) return false;
      return true;
    });

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({
          taxable_amount: round2(body.amount),
          taxes: [],
          total_tax: 0,
          grand_total: round2(body.amount),
          inclusive,
          jurisdiction: body.jurisdiction,
          notes: 'No tax codes configured for jurisdiction',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const codeIds = eligible.map((c: any) => c.id);
    const { data: rates } = await sb
      .from('tax_rates')
      .select('tax_code_id, rate, effective_from, effective_to')
      .in('tax_code_id', codeIds);

    const rateForCode = (codeId: string): number => {
      const matches = (rates ?? []).filter((r: any) => {
        if (r.tax_code_id !== codeId) return false;
        if (r.effective_from && r.effective_from > onDate) return false;
        if (r.effective_to && r.effective_to < onDate) return false;
        return true;
      });
      if (matches.length === 0) return 0;
      matches.sort((a: any, b: any) =>
        (b.effective_from ?? '').localeCompare(a.effective_from ?? ''),
      );
      return Number(matches[0].rate ?? 0);
    };

    const resolved: ResolvedTax[] = eligible.map((c: any) => ({
      code: c.code,
      name: c.name,
      type: c.tax_type,
      rate: rateForCode(c.id),
      authority: c.tax_authorities?.name ?? null,
      is_recoverable: c.is_recoverable !== false,
    }));

    const totalRatePct = resolved.reduce((s, t) => s + t.rate, 0);
    const taxable = inclusive
      ? round2(body.amount / (1 + totalRatePct / 100))
      : round2(body.amount);

    const taxes = resolved.map((t) => ({
      code: t.code,
      name: t.name,
      type: t.type,
      authority: t.authority,
      rate: t.rate,
      amount: round2(taxable * (t.rate / 100)),
      is_recoverable: t.is_recoverable,
    }));

    const totalTax = round2(taxes.reduce((s, t) => s + t.amount, 0));
    const grandTotal = inclusive ? round2(body.amount) : round2(taxable + totalTax);

    return new Response(
      JSON.stringify({
        taxable_amount: taxable,
        taxes,
        total_tax: totalTax,
        grand_total: grandTotal,
        inclusive,
        jurisdiction: body.jurisdiction,
        date: onDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
