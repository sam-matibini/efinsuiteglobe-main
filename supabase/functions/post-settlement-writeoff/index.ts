// Posts a balanced journal entry for a settlement write-off and links it back to the settlement.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  settlement_id: string;
  writeoff_account_id?: string;
  reason?: string;
  reverse?: boolean; // if true, reverse an existing write-off
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!body.settlement_id) return json({ error: 'settlement_id required' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Load settlement + processor + bank GL account
  const { data: settlement, error: sErr } = await admin
    .from('settlements')
    .select('*, processor:processor_account_id(id, default_writeoff_account_id, expected_bank_account_id)')
    .eq('id', body.settlement_id)
    .single();
  if (sErr || !settlement) return json({ error: 'Settlement not found' }, 404);

  // Authorize: caller must be member of the org
  const { data: isMember } = await admin.rpc('is_org_member' as any, { _user_id: userId, _org_id: settlement.organization_id } as any);
  if (!isMember) return json({ error: 'Forbidden' }, 403);

  if (body.reverse) {
    return await reverseWriteoff(admin, settlement, userId);
  }

  const writeoffAccountId = body.writeoff_account_id || settlement.processor?.default_writeoff_account_id;
  if (!writeoffAccountId) return json({ error: 'No write-off GL account specified or configured on processor' }, 400);

  // Resolve bank GL account id from bank_accounts.gl_account_id
  const bankAccountId = settlement.processor?.expected_bank_account_id;
  if (!bankAccountId) return json({ error: 'Processor account has no destination bank account configured' }, 400);
  const { data: bank, error: bErr } = await admin.from('bank_accounts').select('gl_account_id, currency').eq('id', bankAccountId).single();
  if (bErr || !bank?.gl_account_id) return json({ error: 'Destination bank account has no linked GL account' }, 400);

  const amount = Math.abs(Number(settlement.net_amount));
  if (amount <= 0) return json({ error: 'Settlement amount is zero' }, 400);

  const entryDate = (settlement.expected_deposit_date || settlement.settlement_date) as string;
  const ref = `WO-${settlement.settlement_ref}`.slice(0, 64);

  // Create JE
  const { data: je, error: jeErr } = await admin
    .from('journal_entries')
    .insert({
      organization_id: settlement.organization_id,
      reference: ref,
      entry_date: entryDate,
      description: `Settlement write-off: ${settlement.settlement_ref}${body.reason ? ' — ' + body.reason : ''}`,
      status: 'posted',
      created_by: userId,
      posted_by: userId,
      posted_at: new Date().toISOString(),
      journal_type: 'manual',
    } as any)
    .select('id, reference')
    .single();
  if (jeErr || !je) return json({ error: `JE create failed: ${jeErr?.message}` }, 500);

  // Lines: DR write-off account, CR bank GL
  const { error: lErr } = await admin.from('journal_entry_lines').insert([
    {
      journal_entry_id: je.id,
      account_id: writeoffAccountId,
      description: `Write-off ${settlement.settlement_ref}`,
      debit: amount, credit: 0, line_order: 1,
      currency: settlement.currency,
    },
    {
      journal_entry_id: je.id,
      account_id: bank.gl_account_id,
      description: `Write-off offset ${settlement.settlement_ref}`,
      debit: 0, credit: amount, line_order: 2,
      currency: settlement.currency,
    },
  ] as any);
  if (lErr) {
    await admin.from('journal_entries').delete().eq('id', je.id);
    return json({ error: `JE lines failed: ${lErr.message}` }, 500);
  }

  // Insert writeoff
  const { data: wo, error: woErr } = await admin.from('settlement_writeoffs').insert({
    organization_id: settlement.organization_id,
    settlement_id: settlement.id,
    amount,
    currency: settlement.currency,
    writeoff_account_id: writeoffAccountId,
    journal_entry_id: je.id,
    reason: body.reason ?? null,
    written_off_by: userId,
  } as any).select('id').single();
  if (woErr) {
    await admin.from('journal_entries').delete().eq('id', je.id);
    return json({ error: `Write-off insert failed: ${woErr.message}` }, 500);
  }

  await admin.from('settlements').update({
    status: 'written_off',
    writeoff_id: wo!.id,
    exception_reason: null,
  }).eq('id', settlement.id);

  await admin.from('settlement_audit_log').insert({
    organization_id: settlement.organization_id,
    action: 'writeoff_posted',
    details: { settlement_id: settlement.id, journal_entry_id: je.id, amount, reason: body.reason } as any,
    user_id: userId,
  } as any);

  return json({ ok: true, journal_entry_id: je.id, reference: je.reference, writeoff_id: wo!.id });
});

async function reverseWriteoff(admin: any, settlement: any, userId: string) {
  const { data: wo, error: woErr } = await admin
    .from('settlement_writeoffs')
    .select('*')
    .eq('settlement_id', settlement.id)
    .is('reversed_at', null)
    .single();
  if (woErr || !wo) return json({ error: 'No active write-off found' }, 404);

  const { data: origLines } = await admin
    .from('journal_entry_lines')
    .select('account_id, debit, credit, description, currency')
    .eq('journal_entry_id', wo.journal_entry_id)
    .order('line_order');

  const today = new Date().toISOString().slice(0, 10);
  const { data: revJe, error: jeErr } = await admin.from('journal_entries').insert({
    organization_id: settlement.organization_id,
    reference: `REV-${wo.id.slice(0, 8)}`,
    entry_date: today,
    description: `Reversal of write-off ${settlement.settlement_ref}`,
    status: 'posted',
    created_by: userId,
    posted_by: userId,
    posted_at: new Date().toISOString(),
    journal_type: 'manual',
    reversal_of: wo.journal_entry_id,
  } as any).select('id').single();
  if (jeErr || !revJe) return json({ error: `Reversal JE failed: ${jeErr?.message}` }, 500);

  await admin.from('journal_entry_lines').insert(
    (origLines ?? []).map((l: any, i: number) => ({
      journal_entry_id: revJe.id,
      account_id: l.account_id,
      description: `Reverse ${l.description ?? ''}`.trim(),
      debit: Number(l.credit ?? 0), credit: Number(l.debit ?? 0),
      line_order: i + 1,
      currency: l.currency,
    })) as any
  );

  await admin.from('settlement_writeoffs').update({
    reversed_at: new Date().toISOString(),
    reversal_journal_entry_id: revJe.id,
  }).eq('id', wo.id);

  await admin.from('settlements').update({ status: 'exception', writeoff_id: null }).eq('id', settlement.id);

  await admin.from('settlement_audit_log').insert({
    organization_id: settlement.organization_id,
    action: 'writeoff_reversed',
    details: { settlement_id: settlement.id, writeoff_id: wo.id, reversal_je: revJe.id } as any,
    user_id: userId,
  } as any);

  return json({ ok: true, reversal_journal_entry_id: revJe.id });
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
