/**
 * Production CRA gateway handler.
 * scripts/bundle-cra-gateway.mjs emits this as api/cra-gateway.js for Vercel.
 * The browser posts to /api/cra-gateway. It does not call an Edge Function.
 */
import { createClient } from '@supabase/supabase-js';
import {
  callerMayUseGateway,
  craEnvFrom,
  finalizeCraGateway,
  handleCraGateway,
  type CraDb,
} from '../supabase/functions/_shared/cra-connection.ts';

interface NodeResponse {
  status(code: number): NodeResponse;
  json(body: unknown): void;
}

type GatewayRequest = {
  method?: string;
  headers?: { get?(name: string): string | null } | Record<string, string | string[] | undefined>;
  body?: unknown;
  json?: () => Promise<unknown>;
};

export default async function handler(req: GatewayRequest, res?: NodeResponse): Promise<Response | void> {
  if (req.method !== 'POST') {
    return reply(res, 405, { ok: false, action: 'invalid', error: 'POST required.' });
  }

  const header = authorizationHeader(req);
  if (!header.startsWith('Bearer ')) {
    return reply(res, 401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
  }

  const supabaseUrl = firstSetting(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.CRA_BUNDLE_SUPABASE_URL,
  );
  const anonKey = firstSetting(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.CRA_BUNDLE_SUPABASE_ANON_KEY,
  );
  if (!supabaseUrl || !anonKey) {
    return reply(res, 500, { ok: false, action: 'unauthorized', error: 'Supabase is not configured for the CRA gateway.' });
  }

  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: header } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return reply(res, 401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await readPayload(req);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    payload = parsed as Record<string, unknown>;
  } catch {
    return reply(res, 400, { ok: false, action: 'invalid', error: 'CRA gateway expected a JSON object.' });
  }

  const action = typeof payload.action === 'string' ? payload.action : '';
  const allowed = await callerMayUseGateway(supabase as unknown as CraDb, data.user.id, action, payload.organizationId);
  if (allowed.ok === false) {
    return reply(res, 403, { ok: false, action, error: allowed.error });
  }

  const result = await handleCraGateway(action, payload, craEnvFrom((key) => process.env[key]), fetch);
  const finalized = await finalizeCraGateway(supabase as unknown as CraDb, payload, result);
  return reply(res, 200, finalized);
}

function reply(res: NodeResponse | undefined, status: number, body: unknown): Response | void {
  if (res && typeof res.status === 'function') {
    res.status(status).json(body);
    return;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function authorizationHeader(req: GatewayRequest): string {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(name: string): string | null }).get('authorization') ?? '';
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record.authorization ?? record.Authorization;
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

async function readPayload(req: GatewayRequest): Promise<unknown> {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (isPlainObject(req.body)) return req.body;
  if (typeof req.json === 'function') return req.json();
  throw new Error('invalid');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function firstSetting(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}
