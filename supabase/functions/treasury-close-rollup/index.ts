// Treasury period close rollup — advances close status as payments and filings post
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload {
  organization_id: string;
  tax_payment_id?: string;
  filing_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthenticated' }, 401);

    const body = (await req.json()) as Payload;
    if (!body.organization_id) return json({ error: 'organization_id required' }, 400);

    const { data: isMember } = await admin.rpc('is_org_member', {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (isMember !== true) return json({ error: 'Forbidden' }, 403);

    let advanced = 0;
    if (body.tax_payment_id) {
      const { data: pay } = await admin.from('tax_payments')
        .select('payment_type, period_end, status, amount')
        .eq('id', body.tax_payment_id).maybeSingle();
      if (pay) {
        const status = ['completed', 'paid'].includes(pay.status) ? 'paid'
          : ['submitted', 'processing'].includes(pay.status) ? 'filed' : 'reconciled';
        const { data: close } = await admin.from('treasury_period_close')
          .select('id, status')
          .eq('organization_id', body.organization_id)
          .eq('program_code', pay.payment_type)
          .lte('period_start', pay.period_end ?? '9999-12-31')
          .gte('period_end', pay.period_end ?? '0001-01-01')
          .maybeSingle();
        if (close) {
          await admin.from('treasury_period_close').update({
            status,
            related_tax_payment_id: body.tax_payment_id,
          }).eq('id', close.id);
          advanced++;
        }
      }
    }

    if (body.filing_id) {
      const { data: filing } = await admin.from('cra_filings')
        .select('filing_type, period_end, status')
        .eq('id', body.filing_id).maybeSingle();
      if (filing) {
        const { data: close } = await admin.from('treasury_period_close')
          .select('id')
          .eq('organization_id', body.organization_id)
          .lte('period_start', filing.period_end ?? '9999-12-31')
          .gte('period_end', filing.period_end ?? '0001-01-01')
          .maybeSingle();
        if (close) {
          await admin.from('treasury_period_close').update({
            status: 'filed',
            related_filing_id: body.filing_id,
          }).eq('id', close.id);
          advanced++;
        }
      }
    }

    return json({ advanced });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
