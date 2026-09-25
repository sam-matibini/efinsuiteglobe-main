// Generates a ZIP package of settlement reconciliation activity for an audit period
// and stores it in the auditor-bundles storage bucket. Records a manifest row.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import JSZip from 'npm:jszip@3.10.1';

interface Body {
  organization_id: string;
  period_start: string;
  period_end: string;
  delivery_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (cErr || !claims?.claims?.sub) return j({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  let body: Body;
  try { body = await req.json(); } catch { return j({ error: 'Invalid JSON' }, 400); }
  if (!body.organization_id || !body.period_start || !body.period_end) return j({ error: 'organization_id, period_start, period_end required' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: isMember } = await admin.rpc('is_org_member' as any, { _user_id: userId, _org_id: body.organization_id } as any);
  if (!isMember) return j({ error: 'Forbidden' }, 403);

  // Create manifest row
  const { data: pack, error: packErr } = await admin.from('settlement_auditor_packages').insert({
    organization_id: body.organization_id,
    period_start: body.period_start,
    period_end: body.period_end,
    status: 'pending',
    generated_by: userId,
    delivered_to_email: body.delivery_email ?? null,
  } as any).select('id').single();
  if (packErr || !pack) return j({ error: packErr?.message ?? 'Failed to create package row' }, 500);

  try {
    // Pull data
    const [matchesRes, exceptionsRes, writeoffsRes, fxRes, settlementsRes, procsRes] = await Promise.all([
      admin.from('settlement_matches').select('*').eq('organization_id', body.organization_id).gte('created_at', body.period_start).lte('created_at', body.period_end + 'T23:59:59'),
      admin.from('settlements').select('*').eq('organization_id', body.organization_id).eq('status', 'exception').gte('settlement_date', body.period_start).lte('settlement_date', body.period_end),
      admin.from('settlement_writeoffs').select('*').eq('organization_id', body.organization_id).gte('created_at', body.period_start).lte('created_at', body.period_end + 'T23:59:59'),
      admin.from('settlement_fx_revaluations').select('*').eq('organization_id', body.organization_id).gte('period_end_date', body.period_start).lte('period_end_date', body.period_end),
      admin.from('settlements').select('*').eq('organization_id', body.organization_id).gte('settlement_date', body.period_start).lte('settlement_date', body.period_end),
      admin.from('processor_accounts').select('*').eq('organization_id', body.organization_id),
    ]);

    const zip = new JSZip();
    zip.file('matches.csv', toCsv(matchesRes.data ?? []));
    zip.file('exceptions.csv', toCsv(exceptionsRes.data ?? []));
    zip.file('writeoffs.csv', toCsv(writeoffsRes.data ?? []));
    zip.file('fx_revaluations.csv', toCsv(fxRes.data ?? []));
    zip.file('settlements.csv', toCsv(settlementsRes.data ?? []));
    zip.file('processor_accounts.json', JSON.stringify(procsRes.data ?? [], null, 2));

    // Collect JE ids and pull them
    const jeIds = new Set<string>();
    for (const r of (writeoffsRes.data ?? [])) { if (r.journal_entry_id) jeIds.add(r.journal_entry_id); }
    for (const r of (fxRes.data ?? [])) {
      if (r.journal_entry_id) jeIds.add(r.journal_entry_id);
      if (r.reversal_journal_entry_id) jeIds.add(r.reversal_journal_entry_id);
    }
    if (jeIds.size > 0) {
      const { data: jes } = await admin.from('journal_entries').select('*, journal_entry_lines(*)').in('id', Array.from(jeIds));
      zip.file('journal_entries.json', JSON.stringify(jes ?? [], null, 2));
    }

    const manifest = {
      organization_id: body.organization_id,
      period_start: body.period_start,
      period_end: body.period_end,
      generated_at: new Date().toISOString(),
      generated_by: userId,
      counts: {
        matches: matchesRes.data?.length ?? 0,
        exceptions: exceptionsRes.data?.length ?? 0,
        writeoffs: writeoffsRes.data?.length ?? 0,
        fx_revaluations: fxRes.data?.length ?? 0,
        settlements: settlementsRes.data?.length ?? 0,
        journal_entries: jeIds.size,
      },
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const buf = await zip.generateAsync({ type: 'uint8array' });
    const hash = await sha256Hex(buf);
    const path = `settlements/${body.organization_id}/${body.period_start}_${body.period_end}_${pack.id.slice(0,8)}.zip`;
    const { error: upErr } = await admin.storage.from('auditor-bundles').upload(path, buf, {
      contentType: 'application/zip', upsert: true,
    });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    await admin.from('settlement_auditor_packages').update({
      status: 'ready',
      bundle_storage_path: path,
      bundle_sha256: hash,
      match_count: manifest.counts.matches,
      writeoff_count: manifest.counts.writeoffs,
      exception_count: manifest.counts.exceptions,
      fx_revaluation_count: manifest.counts.fx_revaluations,
    }).eq('id', pack.id);

    // Optional email
    if (body.delivery_email) {
      const { data: signed } = await admin.storage.from('auditor-bundles').createSignedUrl(path, 14 * 24 * 3600);
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (resendKey && signed?.signedUrl) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'efinsuite <noreply@efinsuite.com>',
            to: [body.delivery_email],
            subject: `Settlement audit package ${body.period_start} → ${body.period_end}`,
            html: `<p>Your settlement reconciliation audit package is ready.</p>
              <p><a href="${signed.signedUrl}">Download ZIP</a> (link expires in 14 days)</p>
              <p>SHA-256: <code>${hash}</code></p>`,
          }),
        }).catch(() => {});
        await admin.from('settlement_auditor_packages').update({
          status: 'delivered', delivered_at: new Date().toISOString(),
        }).eq('id', pack.id);
      }
    }

    return j({ ok: true, package_id: pack.id, storage_path: path, sha256: hash, ...manifest.counts });
  } catch (e) {
    await admin.from('settlement_auditor_packages').update({
      status: 'failed', error_message: String((e as Error).message),
    }).eq('id', pack.id);
    return j({ error: String((e as Error).message), package_id: pack.id }, 500);
  }
});

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function j(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
