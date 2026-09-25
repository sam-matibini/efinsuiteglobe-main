/**
 * Production CRA gateway. Verifies the user JWT, then uses the shared handler.
 * Client CRA passwords are never stored or forwarded.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  callerMayUseGateway,
  craEnvFrom,
  finalizeCraGateway,
  handleCraGateway,
  type CraDb,
} from '../_shared/cra-connection.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, action: 'invalid', error: 'POST required.' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json(401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey) {
    return json(500, { ok: false, action: 'unauthorized', error: 'Supabase is not configured for the CRA gateway.' });
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return json(401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, action: 'invalid', error: 'CRA gateway expected a JSON object.' });
  }

  const action = typeof payload.action === 'string' ? payload.action : '';
  const allowed = await callerMayUseGateway(supabase as unknown as CraDb, data.user.id, action, payload.organizationId);
  if (!allowed.ok) return json(403, { ok: false, action, error: allowed.error });

  const result = await handleCraGateway(action, payload, craEnvFrom((key) => Deno.env.get(key)), fetch);
  const finalized = await finalizeCraGateway(supabase as unknown as CraDb, payload, result);
  return json(200, finalized);
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
