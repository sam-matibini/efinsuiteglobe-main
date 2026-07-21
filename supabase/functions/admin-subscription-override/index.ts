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

async function stripe(path: string, method: string, body?: Record<string, string>) {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
  const data = await res.json();
  if (data?.error) throw new Error(`Stripe: ${data.error.message}`);
  return data;
}

async function createStripeCoupon(params: {
  percent: number;
  duration?: 'once' | 'repeating' | 'forever';
  duration_in_months?: number | null;
  redeem_by?: string | null; // ISO
  max_redemptions?: number | null;
  name?: string;
}) {
  const body: Record<string, string> = {
    percent_off: String(params.percent),
    duration: params.duration || 'forever',
  };
  if (body.duration === 'repeating' && params.duration_in_months) {
    body.duration_in_months = String(params.duration_in_months);
  }
  if (params.redeem_by) {
    body.redeem_by = String(Math.floor(new Date(params.redeem_by).getTime() / 1000));
  }
  if (params.max_redemptions) body.max_redemptions = String(params.max_redemptions);
  if (params.name) body.name = params.name;
  return await stripe('/coupons', 'POST', body);
}

async function deleteStripeCoupon(id: string) {
  try {
    await stripe(`/coupons/${id}`, 'DELETE');
  } catch (e) {
    console.warn('deleteStripeCoupon failed', id, (e as Error).message);
  }
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

    // ============ UPDATE DEFAULTS ============
    if (action === 'update-defaults') {
      const { trial_period_days, global_discount } = body;

      if (trial_period_days !== undefined) {
        const { data: existing } = await admin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'subscription.trial_period_days')
          .maybeSingle();
        await admin.from('platform_settings').upsert(
          {
            setting_key: 'subscription.trial_period_days',
            setting_value: { days: Number(trial_period_days) },
            category: 'subscription',
          },
          { onConflict: 'setting_key' },
        );
        await audit(null, 'platform_settings.update:subscription.trial_period_days',
          existing?.setting_value, { days: Number(trial_period_days) });
      }

      if (global_discount !== undefined) {
        const { data: existing } = await admin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'subscription.global_discount')
          .maybeSingle();
        const prev = (existing?.setting_value as any) || {};
        const presetId: string | null = global_discount.preset_id || null;
        const note = global_discount.note || null;

        let percent = Number(global_discount.percent) || 0;
        let expiresAt: string | null = global_discount.expires_at || null;
        let duration: 'once' | 'repeating' | 'forever' =
          (global_discount.duration as any) || (expiresAt ? 'once' : 'forever');
        let durationInMonths: number | null =
          duration === 'repeating' && global_discount.duration_in_months
            ? Number(global_discount.duration_in_months)
            : null;
        if (duration === 'repeating' && !durationInMonths) {
          return json({ error: 'duration_in_months required when duration is repeating' }, 400);
        }
        let newCouponId: string | null = prev.stripe_coupon_id || null;

        if (presetId) {
          const { data: preset } = await admin
            .from('discount_presets')
            .select('*')
            .eq('id', presetId)
            .maybeSingle();
          if (!preset) return json({ error: 'Preset not found' }, 404);
          percent = Number(preset.percent);
          expiresAt = preset.expires_at || null;
          duration = preset.duration || 'forever';
          durationInMonths = preset.duration_in_months || null;
          if (prev.stripe_coupon_id && !(await isPresetCoupon(admin, prev.stripe_coupon_id))) {
            await deleteStripeCoupon(prev.stripe_coupon_id);
          }
          newCouponId = preset.stripe_coupon_id;
        } else {
          const changed =
            Number(prev.percent) !== percent ||
            (prev.expires_at || null) !== (expiresAt || null) ||
            (prev.duration || null) !== duration ||
            (prev.duration_in_months || null) !== durationInMonths;

          if (percent > 0 && (changed || !newCouponId || (newCouponId && await isPresetCoupon(admin, newCouponId)))) {
            if (prev.stripe_coupon_id && !(await isPresetCoupon(admin, prev.stripe_coupon_id))) {
              await deleteStripeCoupon(prev.stripe_coupon_id);
            }
            const coupon = await createStripeCoupon({
              percent,
              duration,
              duration_in_months: durationInMonths,
              redeem_by: expiresAt,
              name: `Global ${percent}% off`,
            });
            newCouponId = coupon.id;
          } else if (percent === 0 && prev.stripe_coupon_id) {
            if (!(await isPresetCoupon(admin, prev.stripe_coupon_id))) {
              await deleteStripeCoupon(prev.stripe_coupon_id);
            }
            newCouponId = null;
          }
        }

        const newValue = {
          percent,
          expires_at: expiresAt,
          duration,
          duration_in_months: durationInMonths,
          stripe_coupon_id: newCouponId,
          preset_id: presetId,
          note,
        };
        await admin.from('platform_settings').upsert(
          {
            setting_key: 'subscription.global_discount',
            setting_value: newValue,
            category: 'subscription',
          },
          { onConflict: 'setting_key' },
        );
        await audit(null, 'platform_settings.update:subscription.global_discount', prev, newValue);
      }

      return json({ success: true });
    }


    // ============ EXTEND TRIAL ============
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

    // ============ OVERRIDE ============
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

    // ============ SET DISCOUNT (per-org) ============
    if (action === 'set-discount') {
      const { organization_id, discount_percent, discount_expires_at, preset_id, duration: durationIn, duration_in_months: durationMonthsIn } = body;
      if (!organization_id) return json({ error: 'organization_id required' }, 400);

      const { data: sub } = await admin
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let percent = Number(discount_percent) || 0;
      let expiresAt: string | null = discount_expires_at || null;
      let couponId: string | null = null;

      // Delete existing per-org coupon if any (only if it was auto-created for the org)
      const prevCoupon = sub?.stripe_coupon_id || null;

      if (preset_id) {
        const { data: preset } = await admin
          .from('discount_presets')
          .select('*')
          .eq('id', preset_id)
          .maybeSingle();
        if (!preset) return json({ error: 'Preset not found' }, 404);
        percent = Number(preset.percent);
        expiresAt = preset.expires_at || null;
        couponId = preset.stripe_coupon_id;
        // Don't delete preset coupons — they're shared
        if (prevCoupon && !(await isPresetCoupon(admin, prevCoupon))) {
          await deleteStripeCoupon(prevCoupon);
        }
      } else if (percent > 0) {
        const duration: 'once' | 'repeating' | 'forever' =
          (durationIn as any) || (expiresAt ? 'once' : 'forever');
        const durationInMonths: number | null =
          duration === 'repeating' && durationMonthsIn ? Number(durationMonthsIn) : null;
        if (duration === 'repeating' && !durationInMonths) {
          return json({ error: 'duration_in_months required when duration is repeating' }, 400);
        }
        if (prevCoupon && !(await isPresetCoupon(admin, prevCoupon))) {
          await deleteStripeCoupon(prevCoupon);
        }
        const coupon = await createStripeCoupon({
          percent,
          duration,
          duration_in_months: durationInMonths,
          redeem_by: expiresAt,
          max_redemptions: 1,
          name: `Org ${organization_id.slice(0, 8)} ${percent}% off`,
        });
        couponId = coupon.id;
      } else {
        // Clearing discount
        if (prevCoupon && !(await isPresetCoupon(admin, prevCoupon))) {
          await deleteStripeCoupon(prevCoupon);
        }
      }

      const patch = {
        discount_percent: percent,
        discount_expires_at: expiresAt,
        stripe_coupon_id: couponId,
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
        {
          discount_percent: sub?.discount_percent,
          discount_expires_at: sub?.discount_expires_at,
          stripe_coupon_id: prevCoupon,
        },
        patch);
      return json({ success: true });
    }

    // ============ CREATE PRESET ============
    if (action === 'create-preset') {
      const { name, percent, duration, duration_in_months, expires_at, max_redemptions, scope, country_id } = body;
      if (!name || !percent) return json({ error: 'name and percent required' }, 400);
      const p = Number(percent);
      if (p <= 0 || p > 100) return json({ error: 'percent must be 1-100' }, 400);
      const presetScope = (scope === 'country' ? 'country' : 'global');
      if (presetScope === 'country' && !country_id) {
        return json({ error: 'country_id required for country-scoped preset' }, 400);
      }

      const coupon = await createStripeCoupon({
        percent: p,
        duration: (duration as any) || 'once',
        duration_in_months: duration_in_months ? Number(duration_in_months) : null,
        redeem_by: expires_at || null,
        max_redemptions: max_redemptions ? Number(max_redemptions) : null,
        name,
      });

      const { data, error } = await admin.from('discount_presets').insert({
        name,
        percent: p,
        duration: duration || 'once',
        duration_in_months: duration_in_months ? Number(duration_in_months) : null,
        expires_at: expires_at || null,
        max_redemptions: max_redemptions ? Number(max_redemptions) : null,
        stripe_coupon_id: coupon.id,
        created_by: actorId,
        scope: presetScope,
        country_id: presetScope === 'country' ? country_id : null,
      }).select().single();

      if (error) {
        await deleteStripeCoupon(coupon.id);
        return json({ error: error.message }, 500);
      }
      await audit(null, 'discount_preset.create', null, data);
      return json({ success: true, preset: data });
    }

    // ============ UPDATE PRESET ============
    if (action === 'update-preset') {
      const { preset_id, name, percent, duration, duration_in_months, expires_at, max_redemptions } = body;
      if (!preset_id) return json({ error: 'preset_id required' }, 400);

      const { data: preset } = await admin
        .from('discount_presets')
        .select('*')
        .eq('id', preset_id)
        .maybeSingle();
      if (!preset) return json({ error: 'Not found' }, 404);

      const newPercent = percent != null ? Number(percent) : Number(preset.percent);
      const newDuration = (duration as any) || preset.duration || 'once';
      const newDurationMonths = duration_in_months != null
        ? Number(duration_in_months)
        : preset.duration_in_months;
      const newExpiresAt = expires_at !== undefined ? (expires_at || null) : preset.expires_at;
      const newMaxRedemptions = max_redemptions !== undefined
        ? (max_redemptions ? Number(max_redemptions) : null)
        : preset.max_redemptions;
      const newName = (name ?? preset.name) as string;

      // Stripe coupons are immutable for percent/duration/redeem_by/max_redemptions.
      // Only `name` can be updated safely.
      const financialChanged =
        newPercent !== Number(preset.percent) ||
        newDuration !== preset.duration ||
        (newDurationMonths || null) !== (preset.duration_in_months || null) ||
        (newExpiresAt || null) !== (preset.expires_at || null) ||
        (newMaxRedemptions || null) !== (preset.max_redemptions || null);

      let newCouponId = preset.stripe_coupon_id;

      if (financialChanged) {
        // Create a new coupon; archive the old one
        const coupon = await createStripeCoupon({
          percent: newPercent,
          duration: newDuration,
          duration_in_months: newDuration === 'repeating' ? newDurationMonths : null,
          redeem_by: newExpiresAt,
          max_redemptions: newMaxRedemptions,
          name: newName,
        });
        newCouponId = coupon.id;
        if (preset.stripe_coupon_id) {
          await deleteStripeCoupon(preset.stripe_coupon_id);
        }
      } else if (newName !== preset.name && preset.stripe_coupon_id) {
        // Just rename in Stripe
        try {
          await stripe(`/coupons/${preset.stripe_coupon_id}`, 'POST', { name: newName });
        } catch (e) {
          console.warn('Rename Stripe coupon failed', (e as Error).message);
        }
      }

      const patch = {
        name: newName,
        percent: newPercent,
        duration: newDuration,
        duration_in_months: newDuration === 'repeating' ? newDurationMonths : null,
        expires_at: newExpiresAt,
        max_redemptions: newMaxRedemptions,
        stripe_coupon_id: newCouponId,
      };
      const { data: updated, error } = await admin
        .from('discount_presets')
        .update(patch)
        .eq('id', preset_id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await audit(null, 'discount_preset.update', preset, updated);
      return json({ success: true, preset: updated, coupon_replaced: financialChanged });
    }

    // ============ ARCHIVE PRESET ============
    if (action === 'archive-preset') {
      const { preset_id } = body;
      if (!preset_id) return json({ error: 'preset_id required' }, 400);
      const { data: preset } = await admin
        .from('discount_presets')
        .select('*')
        .eq('id', preset_id)
        .maybeSingle();
      if (!preset) return json({ error: 'Not found' }, 404);
      await deleteStripeCoupon(preset.stripe_coupon_id);
      await admin.from('discount_presets').update({ status: 'archived' }).eq('id', preset_id);
      await audit(null, 'discount_preset.archive', preset, { status: 'archived' });
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('admin-subscription-override error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function isPresetCoupon(admin: any, couponId: string): Promise<boolean> {
  const { data } = await admin
    .from('discount_presets')
    .select('id')
    .eq('stripe_coupon_id', couponId)
    .maybeSingle();
  return !!data;
}
