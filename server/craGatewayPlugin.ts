import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import {
  applyCraFirmSettings,
  callerMayUseGateway,
  craEnvFrom,
  finalizeCraGateway,
  handleCraGateway,
  readCraFirmSettings,
  type CraDb,
} from '../supabase/functions/_shared/cra-connection.ts';

/**
 * Dev-server route POST /api/cra-gateway.
 * Verifies the signed-in Supabase user, then calls the shared CRA handler.
 */
export function craGatewayPlugin(): Plugin {
  return {
    name: 'cra-gateway',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      server.middlewares.use('/api/cra-gateway', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        void serve(req, res, env).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'CRA gateway failed.';
          json(res, 500, { ok: false, action: 'error', error: message });
        });
      });
    },
  };
}

async function serve(
  req: { headers: { authorization?: string }; on(event: string, listener: (chunk?: Buffer) => void): void },
  res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void },
  env: Record<string, string>,
) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    json(res, 401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
    return;
  }
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    json(res, 500, { ok: false, action: 'unauthorized', error: 'Supabase is not configured for the CRA gateway.' });
    return;
  }
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: header } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    json(res, 401, { ok: false, action: 'unauthorized', error: 'Sign in before using the CRA gateway.' });
    return;
  }
  const raw = await readBody(req);
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    payload = parsed as Record<string, unknown>;
  } catch {
    json(res, 400, { ok: false, action: 'invalid', error: 'CRA gateway expected a JSON object.' });
    return;
  }
  const action = typeof payload.action === 'string' ? payload.action : '';
  const allowed = await callerMayUseGateway(supabase as unknown as CraDb, data.user.id, action, payload.organizationId);
  if (!allowed.ok) {
    json(res, 403, { ok: false, action, error: allowed.error });
    return;
  }
  const database = supabase as unknown as CraDb;
  const firm = await readCraFirmSettings(database);
  const result = await handleCraGateway(action, payload, applyCraFirmSettings(craEnvFrom((key) => readCraSetting(env, key)), firm), fetch);
  const finalized = await finalizeCraGateway(database, payload, result, firm);
  json(res, 200, finalized);
}

const NOMBA_DESKTOP_KEYS = new Set([
  'NOMBA_CLIENT_ID',
  'NOMBA_CLIENT_SECRET',
  'NOMBA_ACCOUNT_ID',
  'NOMBA_ENVIRONMENT',
  'NOMBA_CURRENCY',
  'NOMBA_CALLBACK_URL',
]);

const EFILE_DESKTOP_KEYS = new Set([
  'CRA_EFILE_NUMBER',
  'CRA_EFILE_PASSWORD',
  'CRA_EFILE_TRANSMIT_URL',
  'CRA_EFILE_STATUS_URL',
  'CRA_CDE_URL',
]);

function readCraSetting(env: Record<string, string>, key: string): string | undefined {
  if (key === 'CRA_REPRESENTATIVE_ID') {
    const fromDesktop = readDesktopRepresentativeId();
    if (fromDesktop) return fromDesktop;
  }
  if (NOMBA_DESKTOP_KEYS.has(key)) {
    const fromDesktop = readDesktopNomba(key);
    if (fromDesktop) return fromDesktop;
  }
  if (EFILE_DESKTOP_KEYS.has(key)) {
    const fromDesktop = readDesktopEfile(key);
    if (fromDesktop) return fromDesktop;
  }
  return env[key];
}

/** The desktop notepad is the local place to type the firm representative ID. */
function readDesktopRepresentativeId(): string {
  try {
    const file = path.join(os.homedir(), 'Desktop', 'CRA Representative ID.txt');
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^CRA_REPRESENTATIVE_ID=(.*)$/m);
    return (match?.[1] ?? '').trim();
  } catch {
    return '';
  }
}

/** Firm EFILE number, password, and certification-kit addresses. Values stay out of the repository. */
function readDesktopEfile(key: string): string {
  try {
    const file = path.join(os.homedir(), 'Desktop', 'CRA EFILE.txt');
    const text = fs.readFileSync(file, 'utf8');
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`^${escaped}=(.*)$`, 'm'));
    return (match?.[1] ?? '').trim();
  } catch {
    return '';
  }
}

/** Live Nomba credentials typed on the desktop. Values stay out of the repository. */
function readDesktopNomba(key: string): string {
  try {
    const file = path.join(os.homedir(), 'Desktop', 'Nomba Live Keys.txt');
    const text = fs.readFileSync(file, 'utf8');
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = text.match(new RegExp(`^${escaped}=(.*)$`, 'm'));
    return (match?.[1] ?? '').trim();
  } catch {
    return '';
  }
}

function readBody(req: { on(event: string, listener: (chunk?: Buffer) => void): void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.from(chunk ?? []);
      size += buffer.length;
      if (size > 1_000_000) {
        reject(new Error('CRA gateway request is too large.'));
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new Error('CRA gateway request could not be read.')));
  });
}

function json(
  res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void },
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
