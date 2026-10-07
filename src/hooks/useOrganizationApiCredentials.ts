import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import {
  ApiCredentialDraft,
  StoredApiCredential,
  formatApiSettingsError,
  keyHint,
} from '@/lib/receptionist/apiCredentials';

const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: Array<Record<string, string | null>> | null; error: { message?: string; code?: string } | null }>;
    };
    upsert: (values: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message?: string; code?: string } | null }>;
  };
};

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '');
}

export function useOrganizationApiCredentials() {
  const { currentOrganization } = useOrganizationContext();
  const organizationId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const credentials = useQuery({
    queryKey: ['organization-api-credentials', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<StoredApiCredential[]> => {
      const { data, error } = await db
        .from('organization_api_credentials')
        .select('id, provider, name, secret_name, key_hint, status, last_error')
        .eq('organization_id', organizationId!);

      if (error) {
        if (missingRelation(error)) return [];
        throw new Error(formatApiSettingsError(error));
      }

      return (data ?? []).map((row) => ({
        id: String(row.id),
        provider: row.provider === 'custom' ? 'custom' : 'elevenlabs',
        name: String(row.name ?? ''),
        secretName: String(row.secret_name ?? ''),
        keyHint: String(row.key_hint ?? ''),
        status: String(row.status ?? 'saved'),
        lastError: row.last_error,
      }));
    },
  });

  const saveCredential = async (draft: ApiCredentialDraft) => {
    if (!organizationId) throw new Error('Choose an organization first.');
    if (!draft.apiKey) throw new Error('Paste an API key first.');

    const invoked = await supabase.functions.invoke('org-api-credentials', {
      body: {
        action: 'save',
        organizationId,
        provider: draft.provider,
        name: draft.name,
        secretName: draft.secretName,
        apiKey: draft.apiKey,
      },
    });

    if (!invoked.error && invoked.data?.ok) {
      await queryClient.invalidateQueries({ queryKey: ['organization-api-credentials', organizationId] });
      if (invoked.data.error) throw new Error(String(invoked.data.error));
      return;
    }

    const functionMissing = /not found|Failed to send|FunctionsFetchError|404/i.test(
      invoked.error?.message ?? '',
    );
    if (invoked.error && !functionMissing && invoked.data?.error) {
      throw new Error(formatApiSettingsError(new Error(String(invoked.data.error))));
    }

    const { error } = await db.from('organization_api_credentials').upsert(
      {
        organization_id: organizationId,
        provider: draft.provider,
        name: draft.name,
        secret_name: draft.secretName,
        api_key: draft.apiKey,
        key_hint: keyHint(draft.apiKey),
        status: 'saved',
        last_error: null,
      },
      { onConflict: 'organization_id,secret_name' },
    );

    if (error) throw new Error(formatApiSettingsError(error));
    await queryClient.invalidateQueries({ queryKey: ['organization-api-credentials', organizationId] });
  };

  const testCredential = async (draft: ApiCredentialDraft) => {
    if (!draft.apiKey) throw new Error('Paste an API key first.');
    if (draft.provider !== 'elevenlabs') return;

    const invoked = await supabase.functions.invoke('org-api-credentials', {
      body: {
        action: 'test',
        organizationId,
        provider: draft.provider,
        apiKey: draft.apiKey,
      },
    });

    if (!invoked.error && invoked.data?.ok) return;
    if (invoked.data?.error) throw new Error(formatApiSettingsError(new Error(String(invoked.data.error))));

    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': draft.apiKey },
    });
    if (!response.ok) throw new Error('ElevenLabs rejected this API key.');
  };

  return {
    credentials: credentials.data ?? [],
    isLoading: credentials.isLoading,
    loadError: credentials.error instanceof Error ? credentials.error.message : null,
    saveCredential,
    testCredential,
  };
}
