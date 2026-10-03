import { supabase } from '@/integrations/supabase/client';
import type { PlatformApiInput, PlatformApiPublic } from './platformApis';

interface RpcRow {
  id: string;
  provider: string;
  label: string;
  secret_name: string;
  secret_hint: string;
  enabled: boolean;
  docs_url: string | null;
  updated_at: string;
}

function fromRpc(row: RpcRow): PlatformApiPublic {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    secretName: row.secret_name,
    hint: row.secret_hint,
    enabled: row.enabled,
    docsUrl: row.docs_url,
    updatedAt: row.updated_at,
  };
}

function missingRemote(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return message.includes('pgrst202') || message.includes('42883') || message.includes('42p01') || message.includes('schema cache') || message.includes('could not find the function') || message.includes('does not exist');
}

async function localRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('/api/platform-apis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    throw new Error('Platform API settings are unavailable.');
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(String(payload.error || 'Could not save the API key.'));
  }
  return payload;
}

export async function listPlatformApis(): Promise<PlatformApiPublic[]> {
  const remote = await supabase.rpc('list_platform_api_keys' as never);
  if (!remote.error && Array.isArray(remote.data)) return (remote.data as RpcRow[]).map(fromRpc);
  if (remote.error && !missingRemote(remote.error)) throw new Error(remote.error.message);
  const payload = await localRequest({ action: 'list' });
  return (payload.keys as PlatformApiPublic[]) ?? [];
}

export async function savePlatformApi(input: PlatformApiInput): Promise<PlatformApiPublic> {
  const remote = await supabase.rpc('save_platform_api_key' as never, {
    p_provider: input.provider,
    p_label: input.label,
    p_secret_name: input.secretName,
    p_secret_value: input.secretValue,
    p_docs_url: input.docsUrl ?? null,
  } as never);
  if (!remote.error && remote.data) {
    const row = Array.isArray(remote.data) ? remote.data[0] : remote.data;
    return fromRpc(row as RpcRow);
  }
  if (remote.error && !missingRemote(remote.error)) throw new Error(remote.error.message);
  const payload = await localRequest({ action: 'save', ...input });
  return payload.key as PlatformApiPublic;
}

export async function setPlatformApiEnabled(id: string, enabled: boolean): Promise<void> {
  const remote = await supabase.rpc('set_platform_api_key_enabled' as never, { p_id: id, p_enabled: enabled } as never);
  if (!remote.error) return;
  if (!missingRemote(remote.error)) throw new Error(remote.error.message);
  await localRequest({ action: 'enable', id, enabled });
}

export async function deletePlatformApi(id: string): Promise<void> {
  const remote = await supabase.rpc('delete_platform_api_key' as never, { p_id: id } as never);
  if (!remote.error) return;
  if (!missingRemote(remote.error)) throw new Error(remote.error.message);
  await localRequest({ action: 'delete', id });
}

export async function testPlatformApi(input: { secretName?: string; secretValue?: string; provider?: string }): Promise<string> {
  try {
    const remote = await supabase.functions.invoke('platform-api-keys', { body: { action: 'test', ...input } });
    if (!remote.error && remote.data && typeof remote.data === 'object') {
      const data = remote.data as { ok?: boolean; message?: string; error?: string };
      if (data.ok === false) throw new Error(data.error || data.message || 'The API key was rejected.');
      if (data.message) return data.message;
    }
  } catch (error) {
    if (error instanceof Error && !/failed to send|function|not found|404/i.test(error.message)) throw error;
  }
  const payload = await localRequest({ action: 'test', ...input });
  return String(payload.message || 'Connection checked.');
}
