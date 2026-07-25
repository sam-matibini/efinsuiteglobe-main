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

const EFINSIGN_BASE = 'https://cavdivfhszrnhliyafze.supabase.co/functions/v1/api';
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

const DOCSIGN_BUCKET = 'docsign-documents';

function extractStoragePath(fileUrl: string): string | null {
  const markers = [
    `/storage/v1/object/public/${DOCSIGN_BUCKET}/`,
    `/storage/v1/object/sign/${DOCSIGN_BUCKET}/`,
    `/storage/v1/object/authenticated/${DOCSIGN_BUCKET}/`,
  ];
  for (const m of markers) {
    const idx = fileUrl.indexOf(m);
    if (idx !== -1) {
      return decodeURIComponent(fileUrl.slice(idx + m.length).split('?')[0]);
    }
  }
  // Bare storage path fallback (no scheme)
  if (!/^https?:\/\//i.test(fileUrl) && !fileUrl.startsWith('/')) {
    return fileUrl.split('?')[0];
  }
  return null;
}

async function fetchPdfBlob(fileUrl: string): Promise<Blob> {
  const path = extractStoragePath(fileUrl);
  if (path) {
    const { data, error } = await admin
      .storage
      .from('docsign-documents')
      .createSignedUrl(path, 60 * 60); // expires in 1 hour
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign document URL: ${error?.message || 'unknown error'} (path: ${path})`);
    }
    const r = await fetch(data.signedUrl);
    if (!r.ok) throw new Error(`Failed to fetch signed document (${r.status})`);
    return await r.blob();
  }
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
type Ctx = { userId: string; orgId: string | null; isAdmin: boolean; origin: string | null };

async function assertDocumentInOrg(localDocId: string, orgId: string | null) {
  if (!orgId) {
    const err = new Error('organization_id is required');
    (err as { status?: number }).status = 400;
    throw err;
  }
  const { data, error } = await admin
    .from('documents')
    .select('organization_id')
    .eq('id', localDocId)
    .single();
  if (error) throw error;
  if ((data as { organization_id: string | null }).organization_id !== orgId) {
    const err = new Error('Document does not belong to the current organization');
    (err as { status?: number }).status = 403;
    throw err;
  }
}

function requireAdmin(ctx: Ctx) {
  if (!ctx.isAdmin) {
    const err = new Error('Platform admin role required');
    (err as { status?: number }).status = 403;
    throw err;
  }
}

const handlers: Record<string, (payload: Payload, ctx: Ctx) => Promise<unknown>> = {

  async create_document(payload, ctx) {
    const { title, file_url, mime_type, file_size, document_type } = payload as {
      title: string; file_url?: string; mime_type?: string; file_size?: number;
      document_type?: string;
    };
    if (!title) throw new Error('title is required');
    if (!ctx.orgId) throw Object.assign(new Error('organization_id is required'), { status: 400 });

    // Insert local row first so we have an id. Ignore any client-supplied org id.
    const { data: local, error: insErr } = await admin.from('documents').insert({
      title,
      document_type: document_type || 'contract',
      file_url: file_url ?? null,
      mime_type: mime_type ?? null,
      file_size: file_size ?? null,
      owner_id: ctx.userId,
      organization_id: ctx.orgId,
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

  async update_document(payload, ctx) {
    const { id, title } = payload as { id: string; title?: string };
    await assertDocumentInOrg(id, ctx.orgId);
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

  async delete_document(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
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

  async send(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/send`, { method: 'POST' });
    await admin.from('documents').update({ status: 'sent' }).eq('id', id);
    await admin.from('document_signers').update({ status: 'sent' }).eq('document_id', id).neq('status', 'signed');
    await admin.from('document_audit_logs').insert({
      document_id: id, action: 'document_sent', actor_type: 'user',
      details: { via: 'efinsign', sent_at: new Date().toISOString() },
    });

    // eFinSign does not email signers — do it here.
    const emailed = await emailSignersForDocument(id, ctx);
    return { success: true, emailed };
  },

  async void(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/void`, { method: 'POST' });
    await admin.from('documents').update({ status: 'voided' }).eq('id', id);
    return { success: true };
  },

  async remind(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
    const efId = await ensureEfinsignDocument(id);
    await efinsign(`/documents/${efId}/remind`, { method: 'POST' });
    return { success: true };
  },

  async refresh_status(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
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

  async add_signer(payload, ctx) {
    const { document_id, email, name, signing_order, auth_method, phone_number, role } = payload as {
      document_id: string; email: string; name?: string | null;
      signing_order?: number; auth_method?: string; phone_number?: string | null; role?: string;
    };
    await assertDocumentInOrg(document_id, ctx.orgId);
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

  async update_signer(payload, ctx) {
    const { id, document_id, name, email, signing_order } = payload as {
      id: string; document_id: string; name?: string; email?: string; signing_order?: number;
    };
    await assertDocumentInOrg(document_id, ctx.orgId);
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

  async delete_signer(payload, ctx) {
    const { id, document_id } = payload as { id: string; document_id: string };
    await assertDocumentInOrg(document_id, ctx.orgId);
    const { docId, signerId } = await getEfinsignIds(document_id, id);
    if (docId && signerId) {
      try { await efinsign(`/documents/${docId}/signers/${signerId}`, { method: 'DELETE' }); }
      catch (e) { console.warn('eFinSign signer delete failed:', e); }
    }
    const { error } = await admin.from('document_signers').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async add_field(payload, ctx) {
    const {
      document_id, assigned_signer_id, field_type, page_number,
      position_x, position_y, width, height, label, is_required,
    } = payload as {
      document_id: string; assigned_signer_id: string;
      field_type: string; page_number: number;
      position_x: number; position_y: number; width: number; height: number;
      label?: string | null; is_required?: boolean;
    };
    await assertDocumentInOrg(document_id, ctx.orgId);
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

  async update_field(payload, ctx) {
    const { id, document_id, assigned_signer_id, updates } = payload as {
      id: string; document_id: string; assigned_signer_id?: string;
      updates: Record<string, unknown>;
    };
    await assertDocumentInOrg(document_id, ctx.orgId);
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

  async delete_field(payload, ctx) {
    const { id, document_id, assigned_signer_id } = payload as {
      id: string; document_id: string; assigned_signer_id?: string;
    };
    await assertDocumentInOrg(document_id, ctx.orgId);
    const { docId, signerId, fieldId } = await getEfinsignIds(document_id, assigned_signer_id, id);
    if (docId && signerId && fieldId) {
      try { await efinsign(`/documents/${docId}/signers/${signerId}/fields/${fieldId}`, { method: 'DELETE' }); }
      catch (e) { console.warn('eFinSign field delete failed:', e); }
    }
    const { error } = await admin.from('document_fields').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async get_signing_url(payload, ctx) {
    // Signer-scoped action: resolve signer's document, then enforce ownership
    // (the signing page itself calls this without an org context — allow when
    // the caller is the signer's owning org, OR skip the check for public
    // signing links by falling back to signer.document ownership check only
    // when an org is provided).
    const { signer_id } = payload as { signer_id: string };
    const { data: signer, error } = await admin.from('document_signers')
      .select('id, email, efinsign_signer_id, document_id')
      .eq('id', signer_id).single();
    if (error) throw error;
    const docLocalId = (signer as { document_id: string }).document_id;
    if (ctx.orgId) {
      await assertDocumentInOrg(docLocalId, ctx.orgId);
    }
    let efSignerId = (signer as { efinsign_signer_id: string | null }).efinsign_signer_id;
    if (!efSignerId) {
      // Attempt refresh to backfill.
      await handlers.refresh_status({ id: docLocalId }, { ...ctx, orgId: ctx.orgId ?? (await admin.from('documents').select('organization_id').eq('id', docLocalId).single()).data?.organization_id ?? null });
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

  async audit_log(payload, ctx) {
    const { id } = payload as { id: string };
    await assertDocumentInOrg(id, ctx.orgId);
    const efId = await ensureEfinsignDocument(id).catch(() => null);
    if (!efId) return { data: [] };
    const res = await efinsign(`/documents/${efId}/audit-log`);
    return res.data;
  },

  // Return a short-lived download URL for the signed PDF (and certificate if available).
  // eFinSign's /documents/:id/download returns the signed file bytes; we forward it as
  // a base64 payload so the client can trigger a download without exposing the API key.
  async download_signed(payload, ctx) {
    const { id, kind = 'signed' } = payload as { id: string; kind?: 'signed' | 'certificate' };
    await assertDocumentInOrg(id, ctx.orgId);
    const efId = await ensureEfinsignDocument(id);
    if (!API_KEY) throw new Error('EFINSIGN_API_KEY is not configured');
    const url = kind === 'certificate'
      ? `${EFINSIGN_BASE}/documents/${efId}/download?type=certificate`
      : `${EFINSIGN_BASE}/documents/${efId}/download`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) {
      const text = await res.text();
      const err = new Error(`[${res.status}] eFinSign download failed: ${text}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }
    const contentType = res.headers.get('content-type') || 'application/pdf';
    const buf = new Uint8Array(await res.arrayBuffer());
    // Base64-encode in chunks to avoid stack overflow on large PDFs.
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return { content_type: contentType, base64: btoa(binary), filename: `${kind}-${efId}.pdf` };
  },

  // ---- Templates (eFinSign-org-wide; platform-admin only) ---------------
  async list_templates(_payload, ctx) {
    requireAdmin(ctx);
    const res = await efinsign('/templates');
    return res.data ?? [];
  },
  async get_template(payload, ctx) {
    requireAdmin(ctx);
    const { id } = payload as { id: string };
    const res = await efinsign(`/templates/${id}`);
    return res.data;
  },
  async delete_template(payload, ctx) {
    requireAdmin(ctx);
    const { id } = payload as { id: string };
    await efinsign(`/templates/${id}`, { method: 'DELETE' });
    return { success: true };
  },
  // Any org member can instantiate a template — the resulting document is
  // tagged with their org id so subsequent per-document actions are scoped.
  async create_from_template(payload, ctx) {
    if (!ctx.orgId) throw Object.assign(new Error('organization_id is required'), { status: 400 });
    const { template_id, title, signers } = payload as {
      template_id: string; title?: string; signers?: Array<Record<string, unknown>>;
    };
    const res = await efinsign(`/templates/${template_id}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, signers }),
    });
    const created = res.data as { id: string; title?: string } | null;
    if (created?.id) {
      await admin.from('documents').insert({
        title: created.title || title || 'Untitled',
        document_type: 'contract',
        owner_id: ctx.userId,
        organization_id: ctx.orgId,
        efinsign_document_id: created.id,
      });
    }
    return res.data;
  },

  // ---- Organization (eFinSign-org-level; platform-admin only) -----------
  async usage(_payload, ctx) {
    requireAdmin(ctx);
    const res = await efinsign('/organization/usage');
    return res.data;
  },
  async organization(_payload, ctx) {
    requireAdmin(ctx);
    const res = await efinsign('/organization');
    return res.data;
  },

  // ---- Webhooks (platform-admin only) -----------------------------------
  async list_webhooks(_payload, ctx) {
    requireAdmin(ctx);
    const res = await efinsign('/webhooks');
    return res.data ?? [];
  },
  async register_webhook(payload, ctx) {
    requireAdmin(ctx);
    const { url, events, secret, description } = payload as {
      url: string; events?: string[]; secret?: string; description?: string;
    };
    const res = await efinsign('/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events, secret, description }),
    });
    return res.data;
  },
  async delete_webhook(payload, ctx) {
    requireAdmin(ctx);
    const { id } = payload as { id: string };
    await efinsign(`/webhooks/${id}`, { method: 'DELETE' });
    return { success: true };
  },
  async test_webhook(payload, ctx) {
    requireAdmin(ctx);
    const { id } = payload as { id: string };
    const res = await efinsign(`/webhooks/${id}/test`, { method: 'POST' });
    return res.data ?? { success: true };
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

    // Resolve caller's local org (from payload) and validate membership.
    const rawOrgId = (payload as { organization_id?: string } | null)?.organization_id ?? null;
    let orgId: string | null = null;
    if (rawOrgId) {
      const { data: mem } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('organization_id', rawOrgId)
        .maybeSingle();
      if (!mem) return json({ error: 'Not a member of the specified organization' }, 403);
      orgId = rawOrgId;
    }

    // Resolve platform-admin flag for admin-only actions.
    const { data: isAdminRes } = await admin.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const isAdmin = isAdminRes === true;

    const origin = req.headers.get('origin');
    const data = await handler(payload || {}, { userId, orgId, isAdmin, origin });
    return json({ data });

  } catch (e) {
    const err = e as { message?: string; status?: number; body?: unknown };
    console.error('efinsign-proxy error:', err);
    return json({ error: err.message || 'Internal error', details: err.body }, err.status || 500);
  }
});

// Silence unused import warnings for helpers imported but only used conditionally.
export { mapFieldTypeFromEfinsign };
