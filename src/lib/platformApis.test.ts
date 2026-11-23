import { describe, expect, it } from 'vitest';
import { enabledSecret, secretHint, toPublicApi, upsertPlatformApi, validatePlatformApi } from './platformApis';

const key = 'sk_live_elevenlabs_demo_91ab';

describe('platform API keys', () => {
  it('rejects a missing key and a short secret name', () => {
    expect(validatePlatformApi({ provider: 'elevenlabs', label: 'ElevenLabs', secretName: 'ELEVENLABS_API_KEY', secretValue: 'short' })).toMatch(/API key/);
    expect(validatePlatformApi({ provider: 'custom', label: 'Other', secretName: 'x', secretValue: '12345678' })).toMatch(/secret name/);
  });

  it('stores the key and returns only a hint', () => {
    const { rows, saved } = upsertPlatformApi([], {
      provider: 'elevenlabs',
      label: 'ElevenLabs',
      secretName: 'ELEVENLABS_API_KEY',
      secretValue: key,
      docsUrl: 'https://elevenlabs.io',
    });
    const pub = toPublicApi(saved);
    expect(pub.hint).toBe(secretHint(key));
    expect(JSON.stringify(pub)).not.toContain(key);
    expect(enabledSecret(rows, 'ELEVENLABS_API_KEY')).toBe(key);
    const replaced = upsertPlatformApi(rows, {
      provider: 'elevenlabs',
      label: 'ElevenLabs',
      secretName: 'ELEVENLABS_API_KEY',
      secretValue: 'replacement-key-22zz',
    });
    expect(replaced.rows).toHaveLength(1);
    expect(replaced.saved.hint).toBe('••••22zz');
  });
});
