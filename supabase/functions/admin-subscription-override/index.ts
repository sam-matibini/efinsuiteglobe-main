import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is a platform admin
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const action = body?.action as string;
    const actorId = userData.user.id;

    const audit = async (orgId: string | null, actionName: string, oldValues: any, newValues: any) => {
      await admin.from('audit_logs').insert({
        organization_id: orgId,
        user_id: actorId,
        action: actionName,
        entity_type: 'subscription',
        entity_id: orgId,
        old_values: oldValues,
        new_values: newValues,
      });
    };

    if (action === 'update-defaults') {
      const { trial_period_days, global_discount } = body;
      const updates: Array<{ setting_key: string; setting_value: any; category: string }> = [];
      if (trial_period_days !== undefined) {
        updates.push({
          setting_key: 'subscription.trial_period_days',
          setting_value: { days: Number(trial_period_days) },
          category: 'subscription',
        });
      }
      if (global_discount !== undefined) {
        updates.push({
          setting_key: 'subscription.global_discount',
          setting_value: global_discount,
          category: 'subscription',
        });
      }
      for (const u of updates) {
        const { data: existing } = await admin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', u.setting_key)
          .maybeSingle();
        await admin
          .from('platform_settings')
          .upsert(u, { onConflict: 'setting_key' });
        await audit(null, `platform_settings.update:${u.setting_key}`, existing?.setting_value, u.setting_value);
      }
      return json({ success: true });
    }

    if (action === 'extend-trial') {
      const { organization_id, new_trial_end } = body;
      if (!organization_id || !new_trial_end) return json({ error: 'organization_id and new_trial_end required' }, 400);

      const { data: sub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organization_id)
        .in('status', ['active', 'trialing', 'incomplete', 'past_due'])
        .maybeSingle();

      const patch = {
        status: 'trialing',
        current_period_end: new_trial_end,
        trial_extended_by: actorId,
        trial_extended_at: new Date().toISOString(),
      };

      if (sub) {
        await admin.from('subscriptions').update(patch).eq('id', sub.id);
      } else {
        await admin.from('subscriptions').insert({
          organization_id,
          ...patch,
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
        });
      }
      await audit(organization_id, 'subscription.extend_trial',
        { current_period_end: sub?.current_period_end, status: sub?.status },
        patch);
      return json({ success: true });
    }

    if (action === 'override') {
      const { organization_id, plan_id, status, billing_cycle, current_period_end, custom_price, admin_notes } = body;
      if (!organization_id) return json({ error: 'organization_id required' }, 400);

      const { data: sub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const patch: any = {};
      if (plan_id !== undefined) patch.plan_id = plan_id;
      if (status !== undefined) patch.status = status;
      if (billing_cycle !== undefined) patch.billing_cycle = billing_cycle;
      if (current_period_end !== undefined) patch.current_period_end = current_period_end;
      if (custom_price !== undefined) patch.custom_price = custom_price;
      if (admin_notes !== undefined) patch.admin_notes = admin_notes;

      if (sub) {
        await admin.from('subscriptions').update(patch).eq('id', sub.id);
      } else {
        await admin.from('subscriptions').insert({
          organization_id,
          status: patch.status || 'active',
          billing_cycle: patch.billing_cycle || 'monthly',
          current_period_start: new Date().toISOString(),
          ...patch,
        });
      }
      await audit(organization_id, 'subscription.override', sub, patch);
      return json({ success: true });
    }

    if (action === 'set-discount') {
      const { organization_id, discount_percent, discount_expires_at } = body;
      if (!organization_id) return json({ error: 'organization_id required' }, 400);

      const { data: sub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const patch = {
        discount_percent: Number(discount_percent) || 0,
        discount_expires_at: discount_expires_at || null,
      };

      if (sub) {
        await admin.from('subscriptions').update(patch).eq('id', sub.id);
      } else {
        await admin.from('subscriptions').insert({
          organization_id,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          ...patch,
        });
      }
      await audit(organization_id, 'subscription.set_discount',
        { discount_percent: sub?.discount_percent, discount_expires_at: sub?.discount_expires_at },
        patch);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin-subscription-override error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
