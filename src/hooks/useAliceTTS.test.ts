import { describe, expect, it } from 'vitest';
import { aliceSpeechError } from './useAliceTTS';

describe('alice speech errors', () => {
  it('explains a rejected ElevenLabs key without the provider dump', () => {
    expect(aliceSpeechError({
      error: 'Text-to-speech generation failed',
      provider_error: { detail: { status: 'invalid_api_key', message: 'Invalid API key' } },
    }, 401)).toBe('Voice is unavailable right now.');
  });

  it('keeps the quota message', () => {
    expect(aliceSpeechError({
      provider_error: { detail: { status: 'quota_exceeded', message: 'Quota exceeded' } },
    }, 429)).toBe('Quota exceeded');
  });
});
