// Reconciliation + Compliance AI Copilot — Lovable AI Gateway
// Skills: explain_variance, suggest_matches, draft_writeoff_memo,
//         draft_str_narrative, summarise_audit_period
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "npm:ai@4";
import { createLovableAiGatewayProvider, corsHeaders } from "../_shared/ai-gateway.ts";

type Skill =
  | 'explain_variance'
  | 'suggest_matches'
  | 'draft_writeoff_memo'
  | 'draft_str_narrative'
  | 'summarise_audit_period';

interface Body {
  skill: Skill;
  organization_id: string;
  settlement_id?: string;
  transaction_id?: string;
  flags?: string[];
  reason?: string;
  start?: string;
  end?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'Missing LOVABLE_API_KEY' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as Body;
    if (!body.organization_id) return json({ error: 'organization_id required' }, 400);

    // Verify org membership
    const { data: isMember } = await supa.rpc('is_org_member', {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (!isMember) return json({ error: 'Forbidden' }, 403);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway('google/gemini-3-flash-preview');

    let prompt = '';
    let system = 'You are a senior accounting/compliance assistant. Be concise, factual, and audit-ready. Use bullet points.';

    if (body.skill === 'explain_variance' || body.skill === 'suggest_matches') {
      if (!body.settlement_id) return json({ error: 'settlement_id required' }, 400);
      const { data: s } = await supa.from('settlements').select('*').eq('id', body.settlement_id).maybeSingle();
      if (!s) return json({ error: 'settlement not found' }, 404);
      const expected = s.expected_deposit_date ?? s.settlement_date;
      const window = 7;
      const { data: cands } = await supa
        .from('bank_transactions')
        .select('id, transaction_date, amount, description, reference_number:reference, status')
        .gte('transaction_date', addDays(expected, -window))
        .lte('transaction_date', addDays(expected, window))
        .order('transaction_date', { ascending: false })
        .limit(20);
      prompt = body.skill === 'explain_variance'
        ? `Explain plain-English reasons why this settlement may not have auto-matched:\nSETTLEMENT: ${JSON.stringify(s)}\nCANDIDATE BANK TRANSACTIONS: ${JSON.stringify(cands ?? [])}\nReturn: (1) likely root cause, (2) which candidate is closest and why, (3) suggested next action.`
        : `Suggest the best bank transaction match for this settlement. Rank top 3 with brief justification per row.\nSETTLEMENT: ${JSON.stringify(s)}\nCANDIDATES: ${JSON.stringify(cands ?? [])}`;
    } else if (body.skill === 'draft_writeoff_memo') {
      if (!body.settlement_id || !body.reason) return json({ error: 'settlement_id + reason required' }, 400);
      const { data: s } = await supa.from('settlements').select('*').eq('id', body.settlement_id).maybeSingle();
      prompt = `Draft an audit-grade write-off memo for the following settlement. Include: settlement reference, amount, currency, reason, accounting impact (debit/credit), proposed approver, and a one-line justification.\nSETTLEMENT: ${JSON.stringify(s)}\nREASON: ${body.reason}`;
    } else if (body.skill === 'draft_str_narrative') {
      if (!body.transaction_id) return json({ error: 'transaction_id required' }, 400);
      const { data: tx } = await supa.from('bank_transactions').select('*').eq('id', body.transaction_id).maybeSingle();
      system += ' Draft FINTRAC Suspicious Transaction Report (STR) narratives in the standard PCMLTFA format: (1) what was observed, (2) why suspicious, (3) ML/TF indicators triggered, (4) action taken. DO NOT fabricate facts.';
      prompt = `Draft an STR narrative for officer review.\nTRANSACTION: ${JSON.stringify(tx)}\nRISK FLAGS: ${JSON.stringify(body.flags ?? [])}\nMark unverified claims with [VERIFY].`;
    } else if (body.skill === 'summarise_audit_period') {
      if (!body.start || !body.end) return json({ error: 'start + end required' }, 400);
      const { data: settle } = await supa.from('settlements').select('status, net_amount, currency, settlement_date')
        .gte('settlement_date', body.start).lte('settlement_date', body.end).limit(1000);
      const { data: writeoffs } = await supa.from('settlement_writeoffs').select('*')
        .gte('created_at', body.start).lte('created_at', body.end).limit(200);
      prompt = `Produce an audit-ready summary memo for the period ${body.start} → ${body.end}.\nSETTLEMENTS (sample): ${JSON.stringify(settle ?? [])}\nWRITE-OFFS: ${JSON.stringify(writeoffs ?? [])}\nInclude: volumes, matched %, total written off, top exceptions, control observations.`;
    } else {
      return json({ error: 'unknown skill' }, 400);
    }

    const { text } = await generateText({ model, system, prompt });
    return json({ result: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('copilot error', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function addDays(iso: string, n: number) {
  const d = new Date(iso); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
