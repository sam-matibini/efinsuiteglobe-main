import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformApiKeysCard } from './PlatformApiKeysCard';

const listPlatformApis = vi.hoisted(() => vi.fn());
const savePlatformApi = vi.hoisted(() => vi.fn());
const deletePlatformApi = vi.hoisted(() => vi.fn());
const setPlatformApiEnabled = vi.hoisted(() => vi.fn());
const testPlatformApi = vi.hoisted(() => vi.fn());

vi.mock('@/lib/platformApisClient', () => ({
  listPlatformApis,
  savePlatformApi,
  deletePlatformApi,
  setPlatformApiEnabled,
  testPlatformApi,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('PlatformApiKeysCard', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    listPlatformApis.mockReset();
    savePlatformApi.mockReset();
    const saved: Array<Record<string, unknown>> = [];
    listPlatformApis.mockImplementation(async () => [...saved]);
    savePlatformApi.mockImplementation(async (input: { label: string; secretName: string; secretValue: string }) => {
      const row = {
        id: 'key-1',
        provider: 'elevenlabs',
        label: input.label,
        secretName: input.secretName,
        hint: `••••${input.secretValue.slice(-4)}`,
        enabled: true,
        docsUrl: null,
        updatedAt: '2026-10-03T00:00:00.000Z',
      };
      saved.splice(0, saved.length, row);
      return row;
    });
  });

  it('lets an admin add an ElevenLabs key and shows only the hint', async () => {
    render(<PlatformApiKeysCard />);
    expect(await screen.findByText('No API keys yet. Add ElevenLabs to answer calls by voice.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add API' }));
    expect(screen.getByLabelText('Secret name')).toHaveProperty('value', 'ELEVENLABS_API_KEY');
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'elevenlabs-secret-91ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save API key' }));
    await waitFor(() => expect(savePlatformApi).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'elevenlabs',
      secretName: 'ELEVENLABS_API_KEY',
      secretValue: 'elevenlabs-secret-91ab',
    })));
    expect(await screen.findByText('ELEVENLABS_API_KEY · ••••91ab')).toBeTruthy();
    expect(screen.queryByDisplayValue('elevenlabs-secret-91ab')).toBeNull();
  });

  it('opens a custom API with an empty secret name', async () => {
    render(<PlatformApiKeysCard />);
    await screen.findByText(/No API keys yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add API' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom API' }));
    expect(screen.getByLabelText('Secret name')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Secret name')).toHaveProperty('disabled', false);
  });
});
