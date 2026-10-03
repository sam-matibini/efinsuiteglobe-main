import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => state.from(...args),
    functions: { invoke: (...args: unknown[]) => state.invoke(...args) },
  },
}));

import { receptionistRequest } from './client';

function missingTable() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null, error: { code: 'PGRST205', message: 'schema cache' } }),
    upsert: async () => ({ error: { message: 'missing table' } }),
  };
  return chain;
}

describe('receptionist client fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    state.from.mockReset();
    state.from.mockImplementation(() => missingTable());
    state.invoke.mockReset();
  });

  it('keeps the desk in the browser when the dev API is an HTML page and the table is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      json: async () => { throw new Error('not json'); },
    })));

    const loaded = await receptionistRequest('state', { organizationId: 'org-fallback' });
    expect(loaded.storage).toBe('browser');
    expect(loaded.org).toMatchObject({ organizationId: 'org-fallback' });
    expect(JSON.stringify(loaded)).not.toContain('toolSecret');

    await receptionistRequest('save-settings', {
      organizationId: 'org-fallback',
      settings: { enabled: true },
    });
    const talked = await receptionistRequest('talk', {
      organizationId: 'org-fallback',
      text: "I'd like to speak with someone about my payroll.",
      directory: { contacts: [], nextPayDate: null },
    });
    expect(String(talked.reply)).toMatch(/name and phone/i);
    const stored = JSON.parse(localStorage.getItem('efinsuite.receptionist.org-fallback') ?? '{}');
    expect(stored.calls.length).toBeGreaterThan(0);

    const again = await receptionistRequest('state', { organizationId: 'org-fallback' });
    expect((again.org as { calls: unknown[] }).calls.length).toBeGreaterThan(0);
  });

  it('uses the dev API when it returns JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, org: { organizationId: 'org-api', calls: [{ id: 'call-1' }] }, voiceReady: false }),
    })));

    const loaded = await receptionistRequest('state', { organizationId: 'org-api' });
    expect(loaded).toMatchObject({ ok: true, voiceReady: false });
    expect((loaded.org as { calls: unknown[] }).calls).toHaveLength(1);
    expect(state.from).not.toHaveBeenCalled();
  });
});
