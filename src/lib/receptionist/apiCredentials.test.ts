import { describe, expect, it } from 'vitest';
import {
  buildApiCredentialDraft,
  formatApiSettingsError,
  secretNameFor,
  usesOrganizationCredentialStore,
} from './apiCredentials';

describe('organization API credentials', () => {
  it('uses the ElevenLabs secret name from the add-api dialog', () => {
    expect(secretNameFor('elevenlabs', 'Ignored')).toBe('ELEVENLABS_API_KEY');
    expect(buildApiCredentialDraft('elevenlabs', 'ElevenLabs', ' sk_live_1234 ').secretName).toBe(
      'ELEVENLABS_API_KEY',
    );
  });

  it('does not treat a platform-settings failure as the final save error', () => {
    const error = new Error('Platform API settings are unavailable.');
    expect(usesOrganizationCredentialStore(error)).toBe(true);
    expect(formatApiSettingsError(error)).not.toMatch(/Platform API settings are unavailable/);
    expect(formatApiSettingsError(error)).toMatch(/current organization/i);
  });

  it('builds a secret name for a custom provider', () => {
    expect(secretNameFor('custom', 'Payroll Voice')).toBe('PAYROLL_VOICE_API_KEY');
  });
});
