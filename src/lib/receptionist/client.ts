import { supabase } from '@/integrations/supabase/client';
import { handleReceptionApi } from '@/lib/receptionist/api';
import { emptyReceptionOrg, publicOrg } from '@/lib/receptionist/engine';
import type { ReceptionOrg } from '@/lib/receptionist/types';

const db = supabase as unknown as { from: (table: string) => any };

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '');
}

function localKey(organizationId: string) {
  return `efinsuite.receptionist.${organizationId}`;
}

export function readLocalReceptionist(organizationId: string, storage: Pick<Storage, 'getItem'> = localStorage): ReceptionOrg {
  try {
    const raw = storage.getItem(localKey(organizationId));
    if (!raw) return emptyReceptionOrg(organizationId);
    const parsed = JSON.parse(raw) as Partial<ReceptionOrg>;
    return { ...emptyReceptionOrg(organizationId), ...parsed, organizationId };
  } catch {
    return emptyReceptionOrg(organizationId);
  }
}

function writeLocalReceptionist(org: ReceptionOrg, storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem(localKey(org.organizationId), JSON.stringify(org));
}

async function loadState(organizationId: string): Promise<ReceptionOrg | null> {
  const result = await db.from('ai_receptionist_state').select('state').eq('organization_id', organizationId).maybeSingle();
  if (missingTable(result.error)) return null;
  if (result.error || !result.data?.state) return emptyReceptionOrg(organizationId);
  return { ...emptyReceptionOrg(organizationId), ...result.data.state, organizationId, toolSecret: result.data.state.toolSecret || emptyReceptionOrg(organizationId).toolSecret };
}

async function saveState(org: ReceptionOrg) {
  const result = await db.from('ai_receptionist_state').upsert({
    organization_id: org.organizationId,
    state: org,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' });
  if (result.error) throw new Error(result.error.message);
}

function remember(result: { status: number; body: Record<string, unknown>; org?: ReceptionOrg }, storage: 'database' | 'browser') {
  return { ...result.body, org: result.org ? publicOrg(result.org) : result.body.org, storage };
}

export async function receptionistRequest(action: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const organizationId = String(body.organizationId ?? '');
  try {
    const response = await fetch('/api/receptionist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action, organizationId }),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await response.json() as Record<string, unknown>;
      if (json && (response.ok || json.ok === false || typeof json.error === 'string') && (json.org || json.ok === false)) return json;
    }
  } catch {
    // The dev API is not mounted. Fall through to stored receptionist state.
  }

  if (!organizationId) return { ok: false, error: 'organizationId is required.' };
  const current = await loadState(organizationId);
  if (!current) {
    const local = readLocalReceptionist(organizationId);
    const result = handleReceptionApi({ method: 'POST', action, body: { ...body, organizationId } }, { [organizationId]: local });
    if (result.org) writeLocalReceptionist(result.org);
    return remember(result, 'browser');
  }
  const result = handleReceptionApi({ method: 'POST', action, body: { ...body, organizationId } }, { [organizationId]: current });
  if (result.org && result.status < 400) {
    try {
      await saveState(result.org);
    } catch {
      writeLocalReceptionist(result.org);
      return remember(result, 'browser');
    }
  }
  if (action === 'sync' || action === 'session') {
    try {
      const { data } = await supabase.functions.invoke('ai-receptionist', { body: { action, organizationId } });
      if (data) return data as Record<string, unknown>;
    } catch {
      return { ok: true, org: publicOrg(result.org ?? current), voiceReady: false, error: 'Add ELEVENLABS_API_KEY on the server to connect the voice receptionist.' };
    }
  }
  return remember(result, 'database');
}
