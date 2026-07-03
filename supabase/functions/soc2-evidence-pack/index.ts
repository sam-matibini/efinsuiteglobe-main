import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

interface ExportRequest {
  organization_id: string;
  period_start: string;
  period_end: string;
  scope: {
    audit_log?: boolean;
    approvals?: boolean;
    pad_agreements?: boolean;
    reconciliation?: boolean;
    fintrac?: boolean;
    delegations?: boolean;
    webhooks?: boolean;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

  let body: ExportRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.organization_id || !body.period_start || !body.period_end) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: isMember } = await admin.rpc('is_org_member', {
    _user_id: userData.user.id,
    _org_id: body.organization_id,
  });
  if (!isMember) {
    return new Response(JSON.stringify({ error: 'Not an org member' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const scope = body.scope ?? {};
  const pack: Record<string, unknown> = {
    organization_id: body.organization_id,
    period: { start: body.period_start, end: body.period_end },
    generated_at: new Date().toISOString(),
    generated_by: userData.user.id,
  };

  const fetchRange = async (table: string, dateCol = 'created_at') => {
    const { data, error } = await admin
      .from(table)
      .select('*')
      .eq('organization_id', body.organization_id)
      .gte(dateCol, body.period_start)
      .lte(dateCol, body.period_end + 'T23:59:59');
    if (error) return { error: error.message };
    return data ?? [];
  };

  if (scope.audit_log)      pack.cra_audit_log = await fetchRange('cra_audit_log');
  if (scope.approvals)      pack.approvals = await fetchRange('cra_remittance_approvals', 'decided_at').catch(() => []);
  if (scope.pad_agreements) pack.pad_agreements = await fetchRange('pad_agreements');
  if (scope.reconciliation) pack.reconciliation_review = await fetchRange('reconciliation_review_queue');
  if (scope.fintrac)        pack.fintrac_reports = await fetchRange('fintrac_large_eft_reports');
  if (scope.delegations)    pack.accountant_delegations = await fetchRange('accountant_delegations');
  if (scope.webhooks) {
    const { count } = await admin
      .from('treasury_webhook_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', body.period_start)
      .lte('created_at', body.period_end + 'T23:59:59');
    pack.webhook_event_count = count ?? 0;
  }

  const json = JSON.stringify(pack, null, 2);
  const path = `${body.organization_id}/soc2/${body.period_start}_${body.period_end}_${Date.now()}.json`;

  const { error: uploadErr } = await admin.storage
    .from('compliance-exports')
    .upload(path, new Blob([json], { type: 'application/json' }), { upsert: false });

  if (uploadErr) {
    return new Response(JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('compliance-exports')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  if (signErr) {
    return new Response(JSON.stringify({ error: signErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    path,
    download_url: signed.signedUrl,
    expires_in: 60 * 60 * 24 * 30,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
