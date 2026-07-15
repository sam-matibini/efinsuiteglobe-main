import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const actorId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const organizationId: string | undefined = body?.organization_id;
    const confirmName: string | undefined = body?.confirm_name;

    if (!organizationId || typeof organizationId !== 'string') {
      return new Response(JSON.stringify({ error: 'organization_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!confirmName || typeof confirmName !== 'string') {
      return new Response(JSON.stringify({ error: 'confirm_name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the organization
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((confirmName || '').trim() !== (org.name || '').trim()) {
      return new Response(
        JSON.stringify({ error: 'Confirmation name does not match the organization name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Authorization: owner via organization_members OR global admin
    let isAuthorized = org.owner_id === actorId;

    if (!isAuthorized) {
      const { data: memberRow } = await admin
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', actorId)
        .maybeSingle();
      if (memberRow?.role === 'owner') isAuthorized = true;
    }

    if (!isAuthorized) {
      const { data: isAdmin } = await admin.rpc('has_role', {
        _user_id: actorId,
        _role: 'admin',
      });
      if (isAdmin === true) isAuthorized = true;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to delete this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Best-effort audit log before deletion
    try {
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        user_id: actorId,
        action: 'organization.deleted',
        entity_type: 'organization',
        entity_id: organizationId,
        metadata: { organization_name: org.name },
      });
    } catch (_) {
      // ignore
    }

    // Atomic cascade delete via SECURITY DEFINER function
    const { error: rpcError } = await admin.rpc('delete_organization_cascade', {
      _org_id: organizationId,
      _actor: actorId,
    });

    if (rpcError) {
      console.error('delete_organization_cascade error', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to delete organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('delete-organization error', err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
