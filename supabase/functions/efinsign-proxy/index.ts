// eFinSign API proxy: performs operations against eFinSign and mirrors results
// into the local docsign tables so existing reads keep working unchanged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  mapDocStatusFromEfinsign,
  mapSignerStatusFromEfinsign,
  mapFieldTypeFromEfinsign,
  mapFieldTypeToEfinsign,
} from './map.ts';

const EFINSIGN_BASE = 'https://api.efinsign.ca/functions/v1/api';
const API_KEY = Deno.env.get('EFINSIGN_API_KEY');

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function efinsign(path: string, init: RequestInit = {}) {
  if (!API_KEY) throw new Error('EFINSIGN_API_KEY is not configured');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${API_KEY}`);
  const res = await fetch(`${EFINSIGN_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message || `eFinSign ${res.status}`;
    const err = new Error(`[${res.status}] ${message}`);
    (err as { status?: number; body?: unknown }).status = res.status;
    (err as { status?: number; body?: unknown }).body = body;
    throw err;
  }
  return body as { data?: unknown; meta?: unknown };
}

// ---- helpers -------------------------------------------------------------

async function fetchPdfBlob(fileUrl: string): Promise<Blob> {
  const r = await fetch(fileUrl);
  if (!r.ok) throw new Error(`Failed to fetch document file (${r.status})`);
  return await r.blob();
}

async function ensureEfinsignDocument(localId: string): Promise<string> {
  const { data: doc, error } = await admin
    .from('documents')
    .select('id, title, file_url, efinsign_document_id')
    .eq('id', localId)
    .single();
  if (error) throw error;
  if (doc.efinsign_document_id) return doc.efinsign_document_id as string;
  if (!doc.file_url) throw new Error('Document has no file to upload to eFinSign');

  const blob = await fetchPdfBlob(doc.file_url);
  const form = new FormData();
  form.append('title', doc.title);
  form.append('file', blob, `${doc.title || 'document'}.pdf`);
  const res = await efinsign('/documents', { method: 'POST', body: form });
  const created = res.data as { id: string };
  await admin.from('documents').update({ efinsign_document_id: created.id }).eq('id', localId);
  return created.id;
}

async function getEfinsignIds(localDocId: string, localSignerId?: string, localFieldId?: string) {
  const docQ = admin.from('documents').select('efinsign_document_id').eq('id', localDocId).single();
  const signerQ = localSignerId
    ? admin.from('document_signers').select('efinsign_signer_id').eq('id', localSignerId).single()
    : Promise.resolve({ data: null, error: null });
  const fieldQ = localFieldId
    ? admin.from('document_fields').select('efinsign_field_id').eq('id', localFieldId).single()
    : Promise.resolve({ data: null, error: null });
  const [d, s, f] = await Promise.all([docQ, signerQ, fieldQ]);
  return {
    docId: (d.data as { efinsign_document_id: string | null } | null)?.efinsign_document_id ?? null,
    signerId: (s.data as { efinsign_signer_id: string | null } | null)?.efinsign_signer_id ?? null,
    fieldId: (f.data as { efinsign_field_id: string | null } | null)?.efinsign_field_id ?? null,
  };
}

// ---- action handlers -----------------------------------------------------

type Payload = Record<string, unknown>;

const handlers: Record<string, (payload: Payload, userId: string) => Promise<unknown>> = {
  async create_document(payload, userId) {
    const { title, file_url, mime_type, file_size, document_type, organization_id } = payload as {
      title: string; file_url?: string; mime_type?: string; file_size?: number;
      document_type?: string; organization_id?: string | null;
    };
    if (!title) throw new Error('title is required');

    // Insert local row first so we have an id.
    const { data: local, error: insErr } = await admin.from('documents').insert({
      title,
      document_type: document_type || 'contract',
      file_url: file_url ?? null,
      mime_type: mime_type ?? null,
      file_size: file_size ?? null,
      owner_id: userId,
      organization_id: organization_id ?? null,
    }).select().single();
    if (insErr) throw insErr;

    // Upload to eFinSign if we have a file.
    if (file_url) {
      try {
        const blob = await fetchPdfBlob(file_url);
        const form = new FormData();
        form.append('title', title);
        form.append('file', blob, `${title}.pdf`);
        const res = await efinsign('/documents', { method: 'POST', body: form });
        const created = res.data as { id: string };
        await admin.from('documents').update({ efinsign_document_id: created.id }).eq('id', local.id);
        (local as { efinsign_document_id?: string }).efinsign_document_id = created.id;
      } catch (e) {
        console.error('eFinSign upload failed:', e);
        // Keep local row; user can retry with refresh_status/send once file is fixed.
      }
    }
    return local;
  },

  async update_document(payload) {
    const { id, title } = payload as { id: string; title?: string };
    const efId = await ensureEfinsignDocument(id).catch(() => null);
    if (efId && title) await efinsign(`/documents/${efId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;
    const { data, error } = await admin.from('documents').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete_document(payload) {
    const { id } = payload as { id: string };
    const { data: doc } = await admin.from('documents').select('efinsign_document_id').eq('id', id).single();
    const efId = (doc as { efinsign_document_id?: string } | null)?.efinsign_document_id;
    if (efId) {
      try { await efinsign(`/documents/${efId}`, { method: 'DELETE' }); }
      catch (e) { console.warn('eFinSign delete failed (continuing):', e); }
    }
    const { error } = await admin.from('documents').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async send(payload) {
    const { id } = payload as { id: string };
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/send`, { method: 'POST' });
    await admin.from('documents').update({ status: 'sent' }).eq('id', id);
    await admin.from('document_signers').update({ status: 'sent' }).eq('document_id', id).neq('status', 'signed');
    await admin.from('document_audit_logs').insert({
      document_id: id, action: 'document_sent', actor_type: 'user',
      details: { via: 'efinsign', sent_at: new Date().toISOString() },
    });
    return { success: true };
  },

  async void(payload) {
    const { id } = payload as { id: string };
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/void`, { method: 'POST' });
    await admin.from('documents').update({ status: 'voided' }).eq('id', id);
    return { success: true };
  },

  async remind(payload) {
    const { id } = payload as { id: string };
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/remind`, { method: 'POST' });
    return { success: true };
  },

  async refresh_status(payload) {
    const { id } = payload as { id: string };
    const { docId } = await getEfinsignIds(id);
    if (!docId) throw new Error('Document has not been uploaded to eFinSign yet');
    const res = await efinsign(`/documents/${docId}`);
    const remote = res.data as {
      status: string;
      signers?: Array<{ id: string; email: string; status: string; signed_at?: string | null }>;
    };
    await admin.from('documents')
      .update({ status: mapDocStatusFromEfinsign(remote.status) })
      .eq('id', id);
    // Sync signer statuses by email match.
    for (const rs of remote.signers ?? []) {
      await admin.from('document_signers')
        .update({
          status: mapSignerStatusFromEfinsign(rs.status),
          signed_at: rs.signed_at ?? null,
          efinsign_signer_id: rs.id,
        })
        .eq('document_id', id)
        .eq('email', rs.email);
    }
    return { success: true };
  },

  async add_signer(payload) {
    const { document_id, email, name, signing_order, auth_method, phone_number, role } = payload as {
      document_id: string; email: string; name?: string | null;
      signing_order?: number; auth_method?: string; phone_number?: string | null; role?: string;
    };
    const efDocId = await ensureEfinsignDocument(document_id);
    const res = await efinsign(`/documents/${efDocId}/signers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || email, email, order: signing_order ?? 0 }),
    });
    const created = res.data as { id: string };
    const { data, error } = await admin.from('document_signers').insert({
      document_id,
      email,
      name: name ?? null,
      role: role ?? 'signer',
      signing_order: signing_order ?? 1,
      auth_method: auth_method ?? 'email',
      phone_number: phone_number ?? null,
      status: 'pending',
      efinsign_signer_id: created.id,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async update_signer(payload) {
    const { id, document_id, name, email, signing_order } = payload as {
      id: string; document_id: string; name?: string; email?: string; signing_order?: number;
    };
    const { docId, signerId } = await getEfinsignIds(document_id, id);
    if (docId && signerId) {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (email !== undefined) body.email = email;
      if (signing_order !== undefined) body.order = signing_order;
      if (Object.keys(body).length) {
        await efinsign(`/documents/${docId}/signers/${signerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    }
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (signing_order !== undefined) updates.signing_order = signing_order;
    const { data, error } = await admin.from('document_signers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete_signer(payload) {
    const { id, document_id } = payload as { id: string; document_id: string };
    const { docId, signerId } = await getEfinsignIds(document_id, id);
    if (docId && signerId) {
      try { await efinsign(`/documents/${docId}/signers/${signerId}`, { method: 'DELETE' }); }
      catch (e) { console.warn('eFinSign signer delete failed:', e); }
    }
    const { error } = await admin.from('document_signers').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async add_field(payload) {
    const {
      document_id, assigned_signer_id, field_type, page_number,
      position_x, position_y, width, height, label, is_required,
    } = payload as {
      document_id: string; assigned_signer_id: string;
      field_type: string; page_number: number;
      position_x: number; position_y: number; width: number; height: number;
      label?: string | null; is_required?: boolean;
    };
    const { docId, signerId } = await getEfinsignIds(document_id, assigned_signer_id);
    let efFieldId: string | null = null;
    if (docId && signerId) {
      const res = await efinsign(`/documents/${docId}/signers/${signerId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mapFieldTypeToEfinsign(field_type),
          page: page_number,
          x: position_x, y: position_y, w: width, h: height,
          label: label ?? undefined,
        }),
      });
      efFieldId = (res.data as { id: string }).id;
    }
    const { data, error } = await admin.from('document_fields').insert({
      document_id,
      assigned_signer_id,
      field_type,
      page_number,
      position_x, position_y, width, height,
      label: label ?? null,
      is_required: is_required ?? true,
      efinsign_field_id: efFieldId,
    }).select().single();
    if (error) throw error;
    return data;
  },

  async update_field(payload) {
    const { id, document_id, assigned_signer_id, updates } = payload as {
      id: string; document_id: string; assigned_signer_id?: string;
      updates: Record<string, unknown>;
    };
    const { docId, signerId, fieldId } = await getEfinsignIds(document_id, assigned_signer_id, id);
    if (docId && signerId && fieldId) {
      const body: Record<string, unknown> = {};
      if (updates.field_type) body.type = mapFieldTypeToEfinsign(String(updates.field_type));
      if (updates.page_number !== undefined) body.page = updates.page_number;
      if (updates.position_x !== undefined) body.x = updates.position_x;
      if (updates.position_y !== undefined) body.y = updates.position_y;
      if (updates.width !== undefined) body.w = updates.width;
      if (updates.height !== undefined) body.h = updates.height;
      if (updates.label !== undefined) body.label = updates.label;
      if (Object.keys(body).length) {
        await efinsign(`/documents/${docId}/signers/${signerId}/fields/${fieldId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    }
    const { data, error } = await admin.from('document_fields').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async delete_field(payload) {
    const { id, document_id, assigned_signer_id } = payload as {
      id: string; document_id: string; assigned_signer_id?: string;
    };
    const { docId, signerId, fieldId } = await getEfinsignIds(document_id, assigned_signer_id, id);
    if (docId && signerId && fieldId) {
      try { await efinsign(`/documents/${docId}/signers/${signerId}/fields/${fieldId}`, { method: 'DELETE' }); }
      catch (e) { console.warn('eFinSign field delete failed:', e); }
    }
    const { error } = await admin.from('document_fields').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async get_signing_url(payload) {
    const { signer_id } = payload as { signer_id: string };
    const { data: signer, error } = await admin.from('document_signers')
      .select('id, email, efinsign_signer_id, document_id')
      .eq('id', signer_id).single();
    if (error) throw error;
    let efSignerId = (signer as { efinsign_signer_id: string | null }).efinsign_signer_id;
    if (!efSignerId) {
      // Attempt refresh to backfill.
      await handlers.refresh_status({ id: (signer as { document_id: string }).document_id }, '');
      const { data: s2 } = await admin.from('document_signers')
        .select('efinsign_signer_id').eq('id', signer_id).single();
      efSignerId = (s2 as { efinsign_signer_id: string | null } | null)?.efinsign_signer_id ?? null;
    }
    if (!efSignerId) throw new Error('Signer not registered on eFinSign yet — send the document first');
    const res = await efinsign(`/embed/signing-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signer_id: efSignerId, signer_email: (signer as { email: string }).email }),
    });
    return res.data;
  },

  async audit_log(payload) {
    const { id } = payload as { id: string };
    const efId = await ensureEfinsignDocument(id).catch(() => null);
    if (!efId) return { data: [] };
    const res = await efinsign(`/documents/${efId}/audit-log`);
    return res.data;
  },
};

// ---- HTTP entrypoint -----------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await authed.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const { action, payload } = await req.json() as { action: string; payload: Payload };
    const handler = handlers[action];
    if (!handler) return json({ error: `Unknown action: ${action}` }, 400);

    const data = await handler(payload || {}, userId);
    return json({ data });
  } catch (e) {
    const err = e as { message?: string; status?: number; body?: unknown };
    console.error('efinsign-proxy error:', err);
    return json({ error: err.message || 'Internal error', details: err.body }, err.status || 500);
  }
});

// Silence unused import warnings for helpers imported but only used conditionally.
export { mapFieldTypeFromEfinsign };
