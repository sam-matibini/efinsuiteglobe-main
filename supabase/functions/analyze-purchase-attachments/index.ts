import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'purchase-attachments';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;

type EntityType = 'expense_claim' | 'expense' | 'bill' | 'purchase_order' | 'vendor';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

interface RecordContext {
  label: string;
  reference: string | null;
  date: string | null;
  currency: string | null;
  total: number | null;
  vendor_or_employee: string | null;
  status: string | null;
  notes: string | null;
  extra?: Record<string, unknown>;
}

async function loadRecordContext(
  admin: ReturnType<typeof createClient>,
  entityType: EntityType,
  entityId: string,
): Promise<{ organization_id: string; context: RecordContext } | null> {
  switch (entityType) {
    case 'expense_claim': {
      const { data } = await admin
        .from('expense_claims')
        .select('organization_id, claim_number, claim_date, currency, total_amount, status, notes, description, employee:employees(first_name,last_name)')
        .eq('id', entityId)
        .maybeSingle();
      if (!data) return null;
      const emp: any = (data as any).employee;
      return {
        organization_id: (data as any).organization_id,
        context: {
          label: 'Expense Claim',
          reference: (data as any).claim_number,
          date: (data as any).claim_date,
          currency: (data as any).currency,
          total: Number((data as any).total_amount ?? 0),
          vendor_or_employee: emp ? `${emp.first_name} ${emp.last_name}` : null,
          status: (data as any).status,
          notes: (data as any).notes,
          extra: { description: (data as any).description },
        },
      };
    }
    case 'expense': {
      const { data } = await admin
        .from('expenses')
        .select('organization_id, reference, expense_date, currency, amount, tax_amount, notes, vendor:vendors(name)')
        .eq('id', entityId)
        .maybeSingle();
      if (!data) return null;
      const v: any = (data as any).vendor;
      const amt = Number((data as any).amount ?? 0);
      const tax = Number((data as any).tax_amount ?? 0);
      return {
        organization_id: (data as any).organization_id,
        context: {
          label: 'Direct Expense',
          reference: (data as any).reference,
          date: (data as any).expense_date,
          currency: (data as any).currency,
          total: amt + tax,
          vendor_or_employee: v?.name ?? null,
          status: null,
          notes: (data as any).notes,
          extra: { amount: amt, tax_amount: tax },
        },
      };
    }
    case 'bill': {
      const { data } = await admin
        .from('bills')
        .select('organization_id, bill_number, bill_date, due_date, currency, total, subtotal, tax_amount, status, notes, vendor:vendors(name)')
        .eq('id', entityId)
        .maybeSingle();
      if (!data) return null;
      const v: any = (data as any).vendor;
      return {
        organization_id: (data as any).organization_id,
        context: {
          label: 'Bill',
          reference: (data as any).bill_number,
          date: (data as any).bill_date,
          currency: (data as any).currency,
          total: Number((data as any).total ?? 0),
          vendor_or_employee: v?.name ?? null,
          status: (data as any).status,
          notes: (data as any).notes,
          extra: {
            due_date: (data as any).due_date,
            subtotal: (data as any).subtotal,
            tax_amount: (data as any).tax_amount,
          },
        },
      };
    }
    case 'purchase_order': {
      const { data } = await admin
        .from('purchase_orders')
        .select('organization_id, po_number, po_date, expected_date, currency, total, status, notes, vendor:vendors(name)')
        .eq('id', entityId)
        .maybeSingle();
      if (!data) return null;
      const v: any = (data as any).vendor;
      return {
        organization_id: (data as any).organization_id,
        context: {
          label: 'Purchase Order',
          reference: (data as any).po_number,
          date: (data as any).po_date,
          currency: (data as any).currency,
          total: Number((data as any).total ?? 0),
          vendor_or_employee: v?.name ?? null,
          status: (data as any).status,
          notes: (data as any).notes,
          extra: { expected_date: (data as any).expected_date },
        },
      };
    }
    case 'vendor': {
      const { data } = await admin
        .from('vendors')
        .select('organization_id, name, notes, tax_number, email, phone, address_line1, city, province, country, is_active')
        .eq('id', entityId)
        .maybeSingle();
      if (!data) return null;
      return {
        organization_id: (data as any).organization_id,
        context: {
          label: 'Vendor',
          reference: null,
          date: null,
          currency: null,
          total: null,
          vendor_or_employee: (data as any).name,
          status: (data as any).is_active ? 'active' : 'inactive',
          notes: (data as any).notes,
          extra: {
            tax_number: (data as any).tax_number,
            email: (data as any).email,
            phone: (data as any).phone,
            address_line1: (data as any).address_line1,
            city: (data as any).city,
            province: (data as any).province,
            country: (data as any).country,
          },
        },
      };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized: missing bearer token' });
    }
    const token = auth.slice(7);

    const supaUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes, error: userErr } = await supaUser.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return json(401, { error: `Unauthorized: ${userErr?.message ?? 'invalid token'}` });
    }
    const userId = userRes.user.id;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const mode: 'record' | 'draft' = body?.mode === 'draft' ? 'draft' : 'record';
    const entity_type = body?.entity_type as EntityType | undefined;
    const entity_id = body?.entity_id as string | undefined;
    const allowed: EntityType[] = ['expense_claim', 'expense', 'bill', 'purchase_order', 'vendor'];
    if (!entity_type || !allowed.includes(entity_type)) {
      return json(400, { error: 'entity_type is required' });
    }
    if (mode === 'record' && !entity_id) {
      return json(400, { error: 'entity_id is required' });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const warnings: string[] = [];
    const contentBlocks: any[] = [];
    let used = 0;
    let organization_id: string;
    let context: RecordContext;

    const LABELS: Record<EntityType, string> = {
      expense_claim: 'Expense Claim',
      expense: 'Expense',
      bill: 'Bill',
      purchase_order: 'Purchase Order',
      vendor: 'Vendor',
    };

    if (mode === 'draft') {
      organization_id = (body?.organization_id ?? '').toString();
      if (!organization_id) return json(400, { error: 'organization_id is required for draft mode' });

      const { data: member } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!member) return json(403, { error: 'Forbidden: not a member of this organization' });

      context = {
        label: `${LABELS[entity_type]} (draft)`,
        reference: body?.draft_context?.reference ?? null,
        date: body?.draft_context?.date ?? null,
        currency: body?.draft_context?.currency ?? null,
        total: body?.draft_context?.total ?? null,
        vendor_or_employee: body?.draft_context?.vendor ?? null,
        status: 'draft',
        notes: null,
      };

      const files: any[] = Array.isArray(body?.files) ? body.files : [];
      if (files.length === 0) return json(400, { error: 'No files supplied for analysis' });

      for (const f of files) {
        if (used >= MAX_FILES) {
          warnings.push(`Skipped ${f?.name ?? 'file'}: max ${MAX_FILES} files per analysis`);
          continue;
        }
        const mime = (f?.mime_type || 'application/octet-stream').toString();
        const data = (f?.data ?? '').toString();
        if (!data) continue;
        // base64 length -> approximate bytes
        if ((data.length * 3) / 4 > MAX_BYTES) {
          warnings.push(`Skipped ${f?.name ?? 'file'}: exceeds 20MB`);
          continue;
        }
        if (!mime.startsWith('image/') && mime !== 'application/pdf') {
          warnings.push(`Skipped ${f?.name ?? 'file'}: unsupported type (${mime})`);
          continue;
        }
        contentBlocks.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } });
        used += 1;
      }
    } else {
      const loaded = await loadRecordContext(admin, entity_type, entity_id!);
      if (!loaded) return json(404, { error: `${entity_type} not found` });
      organization_id = loaded.organization_id;
      context = loaded.context;

      const { data: member } = await admin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (!member) return json(403, { error: 'Forbidden: not a member of this organization' });

      const { data: attachments, error: aErr } = await admin
        .from('purchase_attachments')
        .select('id, file_name, file_path, mime_type, file_size')
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id!)
        .order('created_at', { ascending: true });
      if (aErr) return json(500, { error: `Attachments query failed: ${aErr.message}` });
      if (!attachments || attachments.length === 0) {
        return json(400, { error: 'No attachments to analyze' });
      }

      for (const att of attachments) {
        if (used >= MAX_FILES) {
          warnings.push(`Skipped ${att.file_name}: max ${MAX_FILES} files per analysis`);
          continue;
        }
        if ((att.file_size ?? 0) > MAX_BYTES) {
          warnings.push(`Skipped ${att.file_name}: exceeds 20MB`);
          continue;
        }
        const mime = att.mime_type || 'application/octet-stream';
        const isImage = mime.startsWith('image/');
        const isPdf = mime === 'application/pdf';
        if (!isImage && !isPdf) {
          warnings.push(`Skipped ${att.file_name}: unsupported type (${mime})`);
          continue;
        }
        try {
          const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(att.file_path);
          if (dErr || !file) {
            warnings.push(`Skipped ${att.file_name}: download failed (${dErr?.message ?? 'unknown'})`);
            continue;
          }
          const buf = new Uint8Array(await file.arrayBuffer());
          const dataUrl = `data:${mime};base64,${bytesToBase64(buf)}`;
          contentBlocks.push({ type: 'image_url', image_url: { url: dataUrl } });
          used += 1;
        } catch (dl) {
          warnings.push(`Skipped ${att.file_name}: ${dl instanceof Error ? dl.message : String(dl)}`);
        }
      }
    }

    if (contentBlocks.length === 0) {
      return json(400, { error: 'No analyzable attachments', warnings });
    }

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json(500, { error: 'AI not configured (LOVABLE_API_KEY missing)' });

    const system =
      'You are a senior accountant reviewing supporting documents for a purchase-domain record ' +
      `(${context.label}). Extract precise financial data from the attachments and reconcile to ` +
      'the record. Return STRICT JSON only. Never invent amounts or vendors — use null if not stated.';

    const user =
      `${context.label} context (JSON):\n\`\`\`json\n` +
      JSON.stringify(context, null, 2) +
      '\n```\n\n' +
      'Analyze the attached documents and return JSON with this exact shape:\n' +
      '{\n' +
      '  "financial_summary": {\n' +
      '    "vendor_or_payer": string|null,\n' +
      '    "document_date": string|null,\n' +
      '    "document_reference": string|null,\n' +
      '    "currency": string|null,\n' +
      '    "subtotal": number|null,\n' +
      '    "tax_total": number|null,\n' +
      '    "grand_total": number|null,\n' +
      '    "tax_breakdown": [{ "label": string, "amount": number }],\n' +
      '    "record_total": number|null,\n' +
      '    "variance_vs_record": number|null,\n' +
      '    "reconciliation_status": "matches"|"minor_variance"|"mismatch"|"unknown",\n' +
      '    "notes": string|null\n' +
      '  },\n' +
      '  "extraction": {\n' +
      '    "vendor_name": string|null,\n' +
      '    "document_number": string|null,\n' +
      '    "document_date": string|null,\n' +
      '    "due_date": string|null,\n' +
      '    "terms": string|null,\n' +
      '    "currency": string|null,\n' +
      '    "subtotal": number|null,\n' +
      '    "tax_total": number|null,\n' +
      '    "grand_total": number|null,\n' +
      '    "lines": [{ "description": string, "quantity": number|null, "unit_price": number|null, "tax_rate": number|null }]\n' +
      '  },\n' +
      '  "narrative": string\n' +
      '}\n' +
      'Dates must be ISO yyyy-mm-dd. quantity/unit_price/tax_rate are plain numbers ' +
      '(tax_rate as a percentage, e.g. 13 for 13%). Only include line items actually printed ' +
      'on the document; return an empty array if none are itemized. ' +
      `Set record_total to ${context.total ?? 'null'} (from context). ` +
      'Compute variance_vs_record = grand_total - record_total when both are known, else null. ' +
      'Use "matches" (<0.01), "minor_variance" (<=2.00), "mismatch" (>2.00), or "unknown". ' +
      'For Vendor records without a total, set record_total and variance_vs_record to null and ' +
      'use reconciliation_status "unknown". Narrative should be 3-5 sentences explaining what ' +
      'the documents contain and how they support this record.';

    const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [{ type: 'text', text: user }, ...contentBlocks] },
        ],
      }),
    });

    if (!gwRes.ok) {
      const errText = await gwRes.text();
      const status = gwRes.status === 429 || gwRes.status === 402 ? gwRes.status : 500;
      const msg =
        gwRes.status === 429
          ? 'AI rate limit reached. Please try again shortly.'
          : gwRes.status === 402
          ? 'AI credits exhausted. Please top up in Settings → Plans & credits.'
          : `AI gateway ${gwRes.status}: ${errText.slice(0, 300)}`;
      return json(status, { error: msg });
    }

    const gwJson = await gwRes.json();
    const raw: string = (gwJson?.choices?.[0]?.message?.content ?? '').toString().trim();
    if (!raw) return json(500, { error: 'Empty AI response' });

    let financial_summary: any = null;
    let narrative = '';
    try {
      const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      financial_summary = parsed.financial_summary ?? null;
      narrative = (parsed.narrative ?? '').toString().trim();
      if (financial_summary && context.total != null) {
        financial_summary.record_total = context.total;
      }
    } catch {
      narrative = raw;
    }

    const fmtMoney = (n: number | null | undefined, cur?: string | null) =>
      n == null || Number.isNaN(Number(n))
        ? '—'
        : `${cur ? cur + ' ' : ''}${Number(n).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

    const fsLines: string[] = [];
    if (financial_summary) {
      const f = financial_summary;
      fsLines.push(`Financial Summary (${context.label}):`);
      if (f.vendor_or_payer) fsLines.push(`  Vendor/Payer: ${f.vendor_or_payer}`);
      if (f.document_date) fsLines.push(`  Document Date: ${f.document_date}`);
      if (f.document_reference) fsLines.push(`  Reference: ${f.document_reference}`);
      fsLines.push(`  Subtotal: ${fmtMoney(f.subtotal, f.currency)}`);
      fsLines.push(`  Tax: ${fmtMoney(f.tax_total, f.currency)}`);
      fsLines.push(`  Grand Total: ${fmtMoney(f.grand_total, f.currency)}`);
      if (f.record_total != null) fsLines.push(`  Record Total: ${fmtMoney(f.record_total, f.currency)}`);
      if (f.variance_vs_record != null) fsLines.push(`  Variance vs Record: ${fmtMoney(f.variance_vs_record, f.currency)}`);
      fsLines.push(`  Reconciliation: ${f.reconciliation_status ?? 'unknown'}`);
      if (f.notes) fsLines.push(`  Notes: ${f.notes}`);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const summaryText = [fsLines.join('\n'), narrative].filter(Boolean).join('\n\n');
    const block =
      `— AI Document Summary (${stamp}) —\n` +
      summaryText +
      (warnings.length ? `\n\nWarnings: ${warnings.join('; ')}` : '');

    return json(200, {
      summary: summaryText,
      narrative,
      financial_summary,
      formatted: block,
      files_analyzed: used,
      warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[fatal]', msg);
    return json(500, { error: msg });
  }
});
