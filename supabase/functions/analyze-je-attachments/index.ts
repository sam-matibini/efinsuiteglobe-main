import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'journal-attachments';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 5;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      console.log('[auth] missing bearer');
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
      console.log('[auth] getUser failed', userErr?.message);
      return json(401, { error: `Unauthorized: ${userErr?.message ?? 'invalid token'}` });
    }
    const userId = userRes.user.id;
    console.log('[auth] ok', userId);

    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }
    const journal_entry_id = body?.journal_entry_id;
    if (!journal_entry_id) return json(400, { error: 'journal_entry_id required' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: entry, error: eErr } = await admin
      .from('journal_entries')
      .select('id, organization_id, reference, entry_date, description, notes, status, journal_type')
      .eq('id', journal_entry_id)
      .maybeSingle();
    if (eErr) {
      console.log('[je] query error', eErr.message);
      return json(500, { error: `JE query failed: ${eErr.message}` });
    }
    if (!entry) return json(404, { error: 'Journal entry not found' });
    console.log('[je] loaded', entry.reference, 'org', entry.organization_id);

    const { data: member, error: mErr } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', entry.organization_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (mErr) {
      console.log('[member] query error', mErr.message);
      return json(500, { error: `Membership check failed: ${mErr.message}` });
    }
    if (!member) return json(403, { error: 'Forbidden: not a member of this organization' });

    const { data: lines } = await admin
      .from('journal_entry_lines')
      .select('description, debit_amount, credit_amount, accounts:account_id(code, name)')
      .eq('journal_entry_id', journal_entry_id)
      .order('line_order', { ascending: true });

    const { data: attachments, error: aErr } = await admin
      .from('journal_entry_attachments')
      .select('id, file_name, file_path, mime_type, file_size')
      .eq('journal_entry_id', journal_entry_id)
      .order('created_at', { ascending: true });
    if (aErr) {
      console.log('[att] query error', aErr.message);
      return json(500, { error: `Attachments query failed: ${aErr.message}` });
    }
    if (!attachments || attachments.length === 0) {
      return json(400, { error: 'No attachments to analyze' });
    }
    console.log('[att] found', attachments.length);

    const warnings: string[] = [];
    const contentBlocks: any[] = [];
    let used = 0;

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
          console.log('[download] failed', att.file_path, dErr?.message);
          warnings.push(`Skipped ${att.file_name}: download failed (${dErr?.message ?? 'unknown'})`);
          continue;
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        const b64 = bytesToBase64(buf);
        const dataUrl = `data:${mime};base64,${b64}`;

        // Gemini via Gateway/OpenRouter accepts both PDFs and images as image_url data URLs.
        contentBlocks.push({ type: 'image_url', image_url: { url: dataUrl } });
        used += 1;
        console.log('[download] ok', att.file_name, buf.length, 'bytes');
      } catch (dl) {
        const msg = dl instanceof Error ? dl.message : String(dl);
        console.log('[download] exception', att.file_name, msg);
        warnings.push(`Skipped ${att.file_name}: ${msg}`);
      }
    }

    if (contentBlocks.length === 0) {
      return json(400, { error: 'No analyzable attachments', warnings });
    }

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json(500, { error: 'AI not configured (LOVABLE_API_KEY missing)' });

    const lineRows = (lines ?? []) as any[];
    const totalDebit = lineRows.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
    const totalCredit = lineRows.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
    const jeContext = {
      reference: entry.reference,
      entry_date: entry.entry_date,
      description: entry.description,
      current_notes: entry.notes,
      journal_type: entry.journal_type,
      total_debit: totalDebit,
      total_credit: totalCredit,
      lines: lineRows.map((l: any) => ({
        account: l.accounts ? `${l.accounts.code} — ${l.accounts.name}` : null,
        description: l.description,
        debit: l.debit_amount,
        credit: l.credit_amount,
      })),
    };

    const system =
      'You are a senior accountant reviewing supporting documents for a Journal Entry. ' +
      'Extract precise financial data from the attachments and reconcile to the JE. ' +
      'Return STRICT JSON only. Never invent amounts or vendors — use null if not stated.';

    const user =
      'Journal Entry context (JSON):\n```json\n' +
      JSON.stringify(jeContext, null, 2) +
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
      '    "je_debit_total": number,\n' +
      '    "je_credit_total": number,\n' +
      '    "variance_vs_je": number|null,\n' +
      '    "reconciliation_status": "matches"|"minor_variance"|"mismatch"|"unknown",\n' +
      '    "notes": string|null\n' +
      '  },\n' +
      '  "narrative": string  // 3-5 sentences explaining what the documents show and how they justify the JE\n' +
      '}\n' +
      'Set je_debit_total and je_credit_total from the context above. Compute variance_vs_je = grand_total - max(je_debit_total, je_credit_total) when grand_total is known, else null. Use "matches" (<0.01), "minor_variance" (<=2.00), "mismatch" (>2.00), or "unknown".';

    console.log('[gw] calling gateway with', contentBlocks.length, 'blocks');
    const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
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
      console.error('[gw] error', gwRes.status, errText.slice(0, 500));
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
    if (!raw) {
      console.error('[gw] empty response', JSON.stringify(gwJson).slice(0, 500));
      return json(500, { error: 'Empty AI response' });
    }

    let financial_summary: any = null;
    let narrative = '';
    try {
      const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      financial_summary = parsed.financial_summary ?? null;
      narrative = (parsed.narrative ?? '').toString().trim();
      if (financial_summary) {
        financial_summary.je_debit_total = totalDebit;
        financial_summary.je_credit_total = totalCredit;
      }
    } catch (err) {
      console.warn('[gw] JSON parse failed, using raw as narrative');
      narrative = raw;
    }

    const fmtMoney = (n: number | null | undefined, cur?: string | null) =>
      n == null || Number.isNaN(Number(n))
        ? '—'
        : `${cur ? cur + ' ' : ''}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const fsLines: string[] = [];
    if (financial_summary) {
      const f = financial_summary;
      fsLines.push('Financial Summary:');
      if (f.vendor_or_payer) fsLines.push(`  Vendor/Payer: ${f.vendor_or_payer}`);
      if (f.document_date) fsLines.push(`  Document Date: ${f.document_date}`);
      if (f.document_reference) fsLines.push(`  Reference: ${f.document_reference}`);
      fsLines.push(`  Subtotal: ${fmtMoney(f.subtotal, f.currency)}`);
      fsLines.push(`  Tax: ${fmtMoney(f.tax_total, f.currency)}`);
      fsLines.push(`  Grand Total: ${fmtMoney(f.grand_total, f.currency)}`);
      fsLines.push(`  JE Debit / Credit: ${fmtMoney(totalDebit)} / ${fmtMoney(totalCredit)}`);
      if (f.variance_vs_je != null) fsLines.push(`  Variance vs JE: ${fmtMoney(f.variance_vs_je, f.currency)}`);
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
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[fatal]', msg, stack);
    return json(500, { error: msg });
  }
});
