import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

interface FilingRequest {
  organization_id: string;
  filing_type: 't4_summary' | 't4_slips' | 't5018' | 'pd7a' | 'gst_hst_netfile';
  period_start: string;
  period_end: string;
}

function xmlEscape(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!)
  );
}

function buildXml(req: FilingRequest, summary: Record<string, unknown>): string {
  const root = req.filing_type.replace(/_/g, '-');
  const inner = Object.entries(summary)
    .map(([k, v]) => `  <${k}>${xmlEscape(v as any)}</${k}>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<${root} period-start="${xmlEscape(req.period_start)}" period-end="${xmlEscape(req.period_end)}">
${inner}
</${root}>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Manual JWT verification
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: FilingRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.organization_id || !body.filing_type || !body.period_start || !body.period_end) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Verify membership
  const { data: isMember } = await admin.rpc('is_org_member', {
    _user_id: userData.user.id,
    _org_id: body.organization_id,
  });
  if (!isMember) {
    return new Response(JSON.stringify({ error: 'Not an org member' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Build a minimal summary from existing data; production would expand per filing type
  const summary: Record<string, unknown> = {
    filing_type: body.filing_type,
    period_start: body.period_start,
    period_end: body.period_end,
    generated_at: new Date().toISOString(),
  };

  if (body.filing_type === 'gst_hst_netfile') {
    const { data: payments } = await admin
      .from('tax_payments')
      .select('amount, status')
      .eq('organization_id', body.organization_id)
      .eq('payment_type', 'gst_hst')
      .gte('period_end', body.period_start)
      .lte('period_end', body.period_end);
    summary.total_remitted = (payments ?? [])
      .filter((p: any) => ['completed', 'paid', 'submitted'].includes(p.status))
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    summary.payment_count = payments?.length ?? 0;
  } else if (body.filing_type === 'pd7a') {
    const { data: payments } = await admin
      .from('tax_payments')
      .select('amount, status')
      .eq('organization_id', body.organization_id)
      .eq('payment_type', 'source_deductions')
      .gte('period_end', body.period_start)
      .lte('period_end', body.period_end);
    summary.total_source_deductions = (payments ?? [])
      .filter((p: any) => ['completed', 'paid', 'submitted'].includes(p.status))
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  }

  const xml = buildXml(body, summary);
  const path = `${body.organization_id}/${body.filing_type}/${body.period_start}_${body.period_end}_${Date.now()}.xml`;

  const { error: uploadErr } = await admin.storage
    .from('cra-filings')
    .upload(path, new Blob([xml], { type: 'application/xml' }), { upsert: false });

  if (uploadErr) {
    return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: filing, error: insertErr } = await admin
    .from('cra_filings')
    .insert({
      organization_id: body.organization_id,
      filing_type: body.filing_type,
      period_start: body.period_start,
      period_end: body.period_end,
      xml_storage_path: path,
      human_summary: summary,
      status: 'generated',
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (insertErr) {
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ filing, path }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
