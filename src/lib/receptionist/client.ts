import { supabase } from '@/integrations/supabase/client';
import { handleReceptionApi, handleReceptionVoice } from '@/lib/receptionist/api';
import { emptyReceptionOrg, publicOrg } from '@/lib/receptionist/engine';
import type { ReceptionOrg } from '@/lib/receptionist/types';

const db = supabase as unknown as { from: (table: string) => any };

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '');
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

export async function receptionistRequest(action: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const organizationId = String(body.organizationId ?? '');
  try {
    const response = await fetch('/api/receptionist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, action, organizationId }),
    });
    const text = await response.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    if (json && (response.ok || json.ok === false || typeof json.error === 'string')) return json;
  } catch {
    // The dev API is not mounted. Fall through to the database.
  }

  if (!organizationId) return { ok: false, error: 'organizationId is required.' };
  const current = await loadState(organizationId);
  if (!current) return { ok: false, error: 'Receptionist storage is not available yet. Apply the AI receptionist migration.' };
  const result = handleReceptionApi({ method: 'POST', action, body: { ...body, organizationId } }, { [organizationId]: current });
  if (result.org && result.status < 400) await saveState(result.org);
  if (action === 'sync' || action === 'session') {
    const { data } = await supabase.functions.invoke('ai-receptionist', { body: { action, organizationId } });
    return (data as Record<string, unknown>) ?? { ok: false, error: 'The voice receptionist function is not deployed yet.' };
  }
  return { ...result.body, org: result.org ? publicOrg(result.org) : result.body.org };
}
