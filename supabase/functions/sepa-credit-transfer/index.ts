import { createClient } from "npm:@supabase/supabase-js@2";
import SftpClient from "npm:ssh2-sftp-client@10.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildPain001(opts: {
  msgId: string; debtorName: string; debtorIban: string; debtorBic: string;
  entries: { name: string; iban: string; bic?: string; amount: number; remittance?: string }[];
}): string {
  const now = new Date().toISOString();
  const total = opts.entries.reduce((s, e) => s + e.amount, 0).toFixed(2);
  const txs = opts.entries.map((e, i) =>
    `<CdtTrfTxInf><PmtId><EndToEndId>${opts.msgId}-${i + 1}</EndToEndId></PmtId>` +
    `<Amt><InstdAmt Ccy="EUR">${e.amount.toFixed(2)}</InstdAmt></Amt>` +
    (e.bic ? `<CdtrAgt><FinInstnId><BIC>${e.bic}</BIC></FinInstnId></CdtrAgt>` : "") +
    `<Cdtr><Nm>${e.name}</Nm></Cdtr>` +
    `<CdtrAcct><Id><IBAN>${e.iban}</IBAN></Id></CdtrAcct>` +
    (e.remittance ? `<RmtInf><Ustrd>${e.remittance}</Ustrd></RmtInf>` : "") +
    `</CdtTrfTxInf>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>${opts.msgId}</MsgId><CreDtTm>${now}</CreDtTm><NbOfTxs>${opts.entries.length}</NbOfTxs><CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>${opts.debtorName}</Nm></InitgPty></GrpHdr>
    <PmtInf><PmtInfId>${opts.msgId}</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>${opts.entries.length}</NbOfTxs><CtrlSum>${total}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${now.slice(0, 10)}</ReqdExctnDt>
      <Dbtr><Nm>${opts.debtorName}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${opts.debtorIban}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${opts.debtorBic}</BIC></FinInstnId></DbtrAgt>
      ${txs}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

async function hashFile(content: string): Promise<string> {
  const buf = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: ud } = await supabase.auth.getUser();
    if (!ud?.user) return j({ error: "Unauthorized" }, 401);

    const { organization_id, rail_id, debtor_name, debtor_iban, debtor_bic, entries } = await req.json();
    if (!organization_id || !debtor_iban || !debtor_bic) return j({ error: "Missing fields" }, 400);

    const msgId = `SEPA-${Date.now()}`;
    const file = buildPain001({
      msgId, debtorName: debtor_name ?? "EFINSUITE", debtorIban: debtor_iban,
      debtorBic: debtor_bic, entries: entries ?? [],
    });
    const fileHash = await hashFile(file);
    const total = (entries ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount || 0), 0);

    const host = Deno.env.get("SEPA_SFTP_HOST");
    const user = Deno.env.get("SEPA_SFTP_USER");
    const key = Deno.env.get("SEPA_SFTP_KEY");
    let status = "simulated";
    let ack: Record<string, unknown> = { mode: "simulated", reason: "SEPA_SFTP_* secrets not configured" };

    if (host && user && key) {
      const sftp = new SftpClient();
      try {
        await sftp.connect({ host, username: user, privateKey: key, port: 22 });
        const remote = `/sepa/incoming/${msgId}.xml`;
        await sftp.put(new TextEncoder().encode(file), remote);
        ack = { mode: "live", remote_path: remote, uploaded_at: new Date().toISOString() };
        status = "submitted";
      } catch (e) {
        ack = { mode: "live", error: e instanceof Error ? e.message : "sftp failed" };
        status = "failed";
      } finally {
        try { await sftp.end(); } catch { /* ignore */ }
      }
    }

    await supabase.from("intl_payment_rail_submissions").insert({
      organization_id, rail_id, submission_type: "sepa_credit_transfer",
      file_hash: fileHash, batch_reference: msgId, status, ack,
      entry_count: (entries ?? []).length, total_amount: total, created_by: ud.user.id,
    });

    return j({ ok: true, file_format: "pain.001", file_content: file, file_hash: fileHash, batch_reference: msgId, status, entry_count: (entries ?? []).length, total_amount: total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("sepa-credit-transfer", msg);
    return j({ error: msg }, 500);
  }
});
