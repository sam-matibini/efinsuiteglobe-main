export interface PlatformApiInput {
  provider: string;
  label: string;
  secretName: string;
  secretValue: string;
  docsUrl?: string | null;
}

export interface PlatformApiRecord {
  id: string;
  provider: string;
  label: string;
  secretName: string;
  secretValue: string;
  hint: string;
  enabled: boolean;
  docsUrl: string | null;
  updatedAt: string;
}

export interface PlatformApiPublic {
  id: string;
  provider: string;
  label: string;
  secretName: string;
  hint: string;
  enabled: boolean;
  docsUrl: string | null;
  updatedAt: string;
}

export interface PlatformApiPreset {
  provider: string;
  label: string;
  secretName: string;
  docsUrl: string;
  description: string;
}

export const PLATFORM_API_PRESETS: PlatformApiPreset[] = [
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs',
    secretName: 'ELEVENLABS_API_KEY',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    description: 'Voice for the AI Receptionist and Alice',
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    secretName: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    description: 'Alice and document assistants',
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    secretName: 'TWILIO_AUTH_TOKEN',
    docsUrl: 'https://www.twilio.com/docs',
    description: 'SMS and voice',
  },
  {
    provider: 'stripe',
    label: 'Stripe',
    secretName: 'STRIPE_SECRET_KEY',
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    description: 'Payments',
  },
  {
    provider: 'resend',
    label: 'Resend',
    secretName: 'RESEND_API_KEY',
    docsUrl: 'https://resend.com/api-keys',
    description: 'Email',
  },
];

const SECRET_NAME = /^[A-Z][A-Z0-9_]{2,63}$/;

export function secretHint(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < 4) return '';
  return `••••${trimmed.slice(-4)}`;
}

export function normalizeSecretName(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

export function validatePlatformApi(input: PlatformApiInput): string | null {
  if (!input.label.trim()) return 'Enter a name for this API.';
  if (!SECRET_NAME.test(input.secretName.trim())) return 'Use a secret name like ELEVENLABS_API_KEY.';
  if (input.secretValue.trim().length < 8) return 'Enter the API key.';
  return null;
}

export function toPublicApi(record: PlatformApiRecord): PlatformApiPublic {
  return {
    id: record.id,
    provider: record.provider,
    label: record.label,
    secretName: record.secretName,
    hint: record.hint,
    enabled: record.enabled,
    docsUrl: record.docsUrl,
    updatedAt: record.updatedAt,
  };
}

export function upsertPlatformApi(rows: PlatformApiRecord[], input: PlatformApiInput, now = new Date().toISOString()): { rows: PlatformApiRecord[]; saved: PlatformApiRecord } {
  const error = validatePlatformApi(input);
  if (error) throw new Error(error);
  const secretName = input.secretName.trim();
  const existing = rows.find((row) => row.secretName === secretName);
  const saved: PlatformApiRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    provider: input.provider.trim() || 'custom',
    label: input.label.trim(),
    secretName,
    secretValue: input.secretValue.trim(),
    hint: secretHint(input.secretValue),
    enabled: existing?.enabled ?? true,
    docsUrl: input.docsUrl?.trim() || null,
    updatedAt: now,
  };
  const next = existing
    ? rows.map((row) => (row.secretName === secretName ? saved : row))
    : [...rows, saved];
  return { rows: next.sort((a, b) => a.label.localeCompare(b.label)), saved };
}

export function setPlatformApiEnabled(rows: PlatformApiRecord[], id: string, enabled: boolean): PlatformApiRecord[] {
  return rows.map((row) => (row.id === id ? { ...row, enabled, updatedAt: new Date().toISOString() } : row));
}

export function removePlatformApi(rows: PlatformApiRecord[], id: string): PlatformApiRecord[] {
  return rows.filter((row) => row.id !== id);
}

export function enabledSecret(rows: PlatformApiRecord[], secretName: string): string {
  return rows.find((row) => row.secretName === secretName && row.enabled)?.secretValue ?? '';
}

/**
 * Platform admins use save_platform_api_key. An organization owner is not a
 * platform admin, and the dev-only /api/platform-apis route is absent on the
 * deployed site. Those failures should store the key for the organization.
 */
export function canStoreApiKeyForOrganization(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = `${error.code ?? ''} ${error.message ?? ''}`;
  if (/pgrst202|42883|42p01|pgrst205|schema cache|could not find the function|does not exist/i.test(message)) return true;
  if (/admin access required|platform api settings are unavailable|platform_settings/i.test(message)) return true;
  return false;
}
