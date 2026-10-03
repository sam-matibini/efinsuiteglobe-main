import fs from 'fs';
import {
  enabledSecret,
  removePlatformApi,
  setPlatformApiEnabled,
  toPublicApi,
  upsertPlatformApi,
  type PlatformApiInput,
  type PlatformApiRecord,
} from '../src/lib/platformApis';

const storePath = '/tmp/efinsuite-platform-apis.json';

export function readPlatformApis(): PlatformApiRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as PlatformApiRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePlatformApis(rows: PlatformApiRecord[]) {
  fs.writeFileSync(storePath, JSON.stringify(rows));
}

export function elevenLabsKeyFromStore(): string {
  return enabledSecret(readPlatformApis(), 'ELEVENLABS_API_KEY');
}

export function handlePlatformApiAction(body: Record<string, unknown>): { status: number; payload: Record<string, unknown> } {
  const action = String(body.action ?? 'list');
  const rows = readPlatformApis();
  if (action === 'list') {
    return { status: 200, payload: { ok: true, keys: rows.map(toPublicApi) } };
  }
  if (action === 'save') {
    try {
      const input: PlatformApiInput = {
        provider: String(body.provider ?? 'custom'),
        label: String(body.label ?? ''),
        secretName: String(body.secretName ?? ''),
        secretValue: String(body.secretValue ?? ''),
        docsUrl: body.docsUrl ? String(body.docsUrl) : null,
      };
      const result = upsertPlatformApi(rows, input);
      writePlatformApis(result.rows);
      return { status: 200, payload: { ok: true, key: toPublicApi(result.saved) } };
    } catch (error) {
      return { status: 400, payload: { ok: false, error: error instanceof Error ? error.message : 'Could not save the API key.' } };
    }
  }
  if (action === 'enable') {
    writePlatformApis(setPlatformApiEnabled(rows, String(body.id ?? ''), Boolean(body.enabled)));
    return { status: 200, payload: { ok: true } };
  }
  if (action === 'delete') {
    writePlatformApis(removePlatformApi(rows, String(body.id ?? '')));
    return { status: 200, payload: { ok: true } };
  }
  return { status: 400, payload: { ok: false, error: 'Unknown API settings action.' } };
}

export function keyForTest(body: Record<string, unknown>): { secretName: string; key: string } {
  const secretName = String(body.secretName ?? '');
  const provided = String(body.secretValue ?? '').trim();
  const stored = readPlatformApis().find((row) => row.secretName === secretName)?.secretValue ?? '';
  return { secretName, key: provided || stored };
}
