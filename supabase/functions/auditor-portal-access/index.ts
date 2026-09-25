// Auditor portal access — issues short-lived signed URLs under an active delegation
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload {
  organization_id: string;
  scope: 'evidence' | 'filings' | 'anomalies' | 'all';
  resource_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Unauthenticated' }, 401);

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthenticated' }, 401);

    const body = (await req.json()) as Payload;
    if (!body.organization_id || !body.scope) return json({ error: 'organization_id and scope required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check delegation OR org membership
    const { data: isMember } = await admin.rpc('is_org_member', { _user_id: user.id, _org_id: body.organization_id });
    let delegationId: string | null = null;
    if (!isMember) {
      const { data: deleg } = await admin.from('accountant_delegations')
        .select('id, scope, expires_at, revoked_at')
        .eq('organization_id', body.organization_id)
        .eq('delegated_user_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();
      if (!deleg) return json({ error: 'No active delegation' }, 403);
      if (deleg.expires_at && new Date(deleg.expires_at) < new Date()) {
        return json({ error: 'Delegation expired' }, 403);
      }
      delegationId = deleg.id;
    }

    let signed_url: string | null = null;
    if (body.scope === 'filings' && body.resource_id) {
      const { data: filing } = await admin.from('cra_filings')
        .select('xml_storage_path').eq('id', body.resource_id).maybeSingle();
      if (filing?.xml_storage_path) {
        const { data: sig } = await admin.storage.from('cra-filings').createSignedUrl(filing.xml_storage_path, 300);
        signed_url = sig?.signedUrl ?? null;
      }
    } else if (body.scope === 'evidence') {
      // List most recent file in compliance-exports
      const { data: files } = await admin.storage.from('compliance-exports').list(body.organization_id, {
        limit: 1, sortBy: { column: 'created_at', order: 'desc' },
      });
      const latest = files?.[0]?.name;
      if (latest) {
        const { data: sig } = await admin.storage.from('compliance-exports')
          .createSignedUrl(`${body.organization_id}/${latest}`, 60 * 60 * 24 * 30);
        signed_url = sig?.signedUrl ?? null;
      }
    }

    // Log session activity
    await admin.from('auditor_portal_sessions').insert({
      delegation_id: delegationId ?? body.organization_id,
      organization_id: body.organization_id,
      auditor_user_id: user.id,
      scopes_used: [body.scope],
      actions_count: 1,
    });

    return json({ signed_url, scope: body.scope });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
