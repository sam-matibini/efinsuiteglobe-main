export type ApiProvider = 'elevenlabs' | 'custom';

export interface ApiCredentialDraft {
  provider: ApiProvider;
  name: string;
  secretName: string;
  apiKey: string;
}

export interface StoredApiCredential {
  id: string;
  provider: ApiProvider;
  name: string;
  secretName: string;
  keyHint: string;
  status: string;
  lastError: string | null;
}

const PLATFORM_SETTINGS_ERROR = /platform api settings are unavailable|platform_settings/i;

/** Read a human message from an Error, a Supabase error, or a nested API payload. */
export function errorText(error: unknown): string {
  if (typeof error === 'string') return error === '[object Object]' ? '' : error.trim();
  if (error instanceof Error) return error.message === '[object Object]' ? '' : error.message.trim();
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'error', 'details', 'hint', 'error_description', 'msg']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() && value !== '[object Object]') return value.trim();
      if (value && typeof value === 'object') {
        const nested = errorText(value);
        if (nested) return nested;
      }
    }
  }
  return '';
}

export function secretNameFor(provider: ApiProvider, name: string): string {
  if (provider === 'elevenlabs') return 'ELEVENLABS_API_KEY';
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${slug || 'CUSTOM'}_API_KEY`;
}

export function buildApiCredentialDraft(
  provider: ApiProvider,
  name: string,
  apiKey: string,
): ApiCredentialDraft {
  const trimmedName = name.trim() || (provider === 'elevenlabs' ? 'ElevenLabs' : 'Custom API');
  return {
    provider,
    name: trimmedName,
    secretName: secretNameFor(provider, trimmedName),
    apiKey: apiKey.trim(),
  };
}

export function keyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}

/**
 * Organization owners are not platform admins, so a failure to read
 * platform_settings must not block saving a key for this organization.
 */
export function formatApiSettingsError(error: unknown): string {
  const raw = errorText(error);
  if (PLATFORM_SETTINGS_ERROR.test(raw)) {
    return 'Saving this key does not need platform-wide settings. Store it for the current organization and try again.';
  }
  if (/schema cache|does not exist|42P01/i.test(raw)) {
    return 'Organization API credentials are not ready yet. Apply the latest database migration, then save the key again.';
  }
  if (/row-level security|permission denied|42501/i.test(raw)) {
    return 'Only an organization owner or admin can save API keys.';
  }
  return raw || 'Could not save the API key.';
}

export function usesOrganizationCredentialStore(error: unknown): boolean {
  return PLATFORM_SETTINGS_ERROR.test(errorText(error));
}
