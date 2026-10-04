import { supabase } from '@/integrations/supabase/client';
import { formatApiSettingsError, keyHint } from '@/lib/receptionist/apiCredentials';
import { canStoreApiKeyForOrganization, secretHint, type PlatformApiInput, type PlatformApiPublic } from './platformApis';

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

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: Array<Record<string, string | null>> | null; error: { message?: string; code?: string } | null }>;
    };
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message?: string; code?: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string; code?: string } | null }>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string; code?: string } | null }>;
    };
  };
};

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

function unavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /platform api settings are unavailable/i.test(message);
}

async function localRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch('/api/platform-apis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Platform API settings are unavailable.');
  }
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType) || text.trim().startsWith('<')) {
    throw new Error('Platform API settings are unavailable.');
  }
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

async function organizationIdForCurrentUser(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId);
  if (error || !data?.length) return null;
  const preferred = data.find((row) => row.role === 'owner') ?? data.find((row) => row.role === 'admin');
  return preferred?.organization_id ?? null;
}

function publicFromInput(input: PlatformApiInput): PlatformApiPublic {
  return {
    id: input.secretName,
    provider: input.provider,
    label: input.label,
    secretName: input.secretName,
    hint: secretHint(input.secretValue) || keyHint(input.secretValue),
    enabled: true,
    docsUrl: input.docsUrl ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function listOrganizationApis(): Promise<PlatformApiPublic[]> {
  const organizationId = await organizationIdForCurrentUser();
  if (!organizationId) return [];
  const { data, error } = await db
    .from('organization_api_credentials')
    .select('id, provider, name, secret_name, key_hint, status')
    .eq('organization_id', organizationId);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider ?? 'custom'),
    label: String(row.name ?? ''),
    secretName: String(row.secret_name ?? ''),
    hint: String(row.key_hint ?? ''),
    enabled: row.status !== 'disabled',
    docsUrl: null,
    updatedAt: new Date().toISOString(),
  }));
}

async function saveOrganizationApi(input: PlatformApiInput): Promise<PlatformApiPublic> {
  const organizationId = await organizationIdForCurrentUser();
  if (!organizationId) throw new Error('Choose an organization first.');

  const invoked = await supabase.functions.invoke('org-api-credentials', {
    body: {
      action: 'save',
      organizationId,
      provider: input.provider === 'custom' ? 'custom' : 'elevenlabs',
      name: input.label,
      secretName: input.secretName,
      apiKey: input.secretValue,
    },
  });
  const functionMissing = /not found|Failed to send|FunctionsFetchError|404/i.test(invoked.error?.message ?? '');
  if (!invoked.error && invoked.data?.ok && !invoked.data?.error) return publicFromInput(input);

  const { error } = await db.from('organization_api_credentials').upsert(
    {
      organization_id: organizationId,
      provider: input.provider === 'custom' ? 'custom' : 'elevenlabs',
      name: input.label,
      secret_name: input.secretName,
      api_key: input.secretValue,
      key_hint: secretHint(input.secretValue) || keyHint(input.secretValue),
      status: 'saved',
      last_error: null,
    },
    { onConflict: 'organization_id,secret_name' },
  );
  if (error) {
    if (functionMissing || missingRemote(error)) throw new Error(formatApiSettingsError(error));
    throw new Error(formatApiSettingsError(error));
  }
  return publicFromInput(input);
}

async function withOrganizationFallback<T>(remoteError: { code?: string; message?: string } | null, local: () => Promise<T>, organization: () => Promise<T>): Promise<T> {
  if (remoteError && !missingRemote(remoteError) && !canStoreApiKeyForOrganization(remoteError)) {
    throw new Error(remoteError.message ?? 'Could not save the API key.');
  }
  try {
    return await local();
  } catch (error) {
    if (!unavailable(error) && !canStoreApiKeyForOrganization(error instanceof Error ? { message: error.message } : null)) throw error;
    try {
      return await organization();
    } catch (orgError) {
      throw new Error(formatApiSettingsError(orgError));
    }
  }
}

export async function listPlatformApis(): Promise<PlatformApiPublic[]> {
  const remote = await supabase.rpc('list_platform_api_keys' as never);
  if (!remote.error && Array.isArray(remote.data)) return (remote.data as RpcRow[]).map(fromRpc);
  return withOrganizationFallback(remote.error, async () => {
    const payload = await localRequest({ action: 'list' });
    return (payload.keys as PlatformApiPublic[]) ?? [];
  }, listOrganizationApis);
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
  return withOrganizationFallback(remote.error, async () => {
    const payload = await localRequest({ action: 'save', ...input });
    return payload.key as PlatformApiPublic;
  }, () => saveOrganizationApi(input));
}

export async function setPlatformApiEnabled(id: string, enabled: boolean): Promise<void> {
  const remote = await supabase.rpc('set_platform_api_key_enabled' as never, { p_id: id, p_enabled: enabled } as never);
  if (!remote.error) return;
  await withOrganizationFallback(remote.error, async () => {
    await localRequest({ action: 'enable', id, enabled });
  }, async () => {
    const { error } = await db.from('organization_api_credentials').update({ status: enabled ? 'saved' : 'disabled' }).eq('id', id);
    if (error) throw new Error(formatApiSettingsError(error));
  });
}

export async function deletePlatformApi(id: string): Promise<void> {
  const remote = await supabase.rpc('delete_platform_api_key' as never, { p_id: id } as never);
  if (!remote.error) return;
  await withOrganizationFallback(remote.error, async () => {
    await localRequest({ action: 'delete', id });
  }, async () => {
    const { error } = await db.from('organization_api_credentials').delete().eq('id', id);
    if (error) throw new Error(formatApiSettingsError(error));
  });
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
    if (error instanceof Error && !/failed to send|function|not found|404|admin access required/i.test(error.message)) throw error;
  }
  try {
    const payload = await localRequest({ action: 'test', ...input });
    return String(payload.message || 'Connection checked.');
  } catch (error) {
    if (!unavailable(error)) throw new Error(formatApiSettingsError(error));
  }
  const secret = input.secretValue?.trim() ?? '';
  if (input.secretName !== 'ELEVENLABS_API_KEY' && input.provider !== 'elevenlabs') {
    return 'Saved. This API does not have an automatic connection test.';
  }
  if (!secret) throw new Error('Enter the ElevenLabs API key first.');
  const response = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': secret } });
  if (!response.ok) throw new Error('ElevenLabs rejected this API key.');
  return 'ElevenLabs accepted this API key.';
}
