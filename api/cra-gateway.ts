/**
 * eFinsuite production route POST /api/cra-gateway.
 * The browser calls this on the same host. It does not call an Edge Function.
 */
import { createClient } from '@supabase/supabase-js';
import {
  callerMayUseGateway,
  craEnvFrom,
  finalizeCraGateway,
  handleCraGateway,
  type CraDb,
} from '../supabase/functions/_shared/cra-connection.ts';

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, action: 'invalid', error: 'POST required.' });
    return;
  }

  const header = headerValue(req.headers.authorization);
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ ok: false, action: 'unauthorized', error: 'Supabase is not configured for the CRA gateway.' });
    return;
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: header } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    res.status(401).json({ ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    payload = parsed as Record<string, unknown>;
  } catch {
    res.status(400).json({ ok: false, action: 'invalid', error: 'CRA gateway expected a JSON object.' });
    return;
  }

  const action = typeof payload.action === 'string' ? payload.action : '';
  const allowed = await callerMayUseGateway(supabase as unknown as CraDb, data.user.id, action, payload.organizationId);
  if (!allowed.ok) {
    res.status(403).json({ ok: false, action, error: allowed.error });
    return;
  }

  const result = await handleCraGateway(action, payload, craEnvFrom((key) => process.env[key]), fetch);
  const finalized = await finalizeCraGateway(supabase as unknown as CraDb, payload, result);
  res.status(200).json(finalized);
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}
