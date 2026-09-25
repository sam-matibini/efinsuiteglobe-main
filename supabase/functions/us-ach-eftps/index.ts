import { createClient } from "npm:@supabase/supabase-js@2";
import SftpClient from "npm:ssh2-sftp-client@10.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildNachaFile(opts: {
  immediateOrigin: string;
  immediateDestination: string;
  companyName: string;
  entries: { routing: string; account: string; amount: number; name: string }[];
}): string {
  const today = new Date();
  const yymmdd = today.toISOString().slice(2, 10).replace(/-/g, "");
  const hhmm = today.toISOString().slice(11, 16).replace(":", "");
  const fileHeader =
    `101 ${opts.immediateDestination.padStart(10)} ${opts.immediateOrigin.padStart(10)}${yymmdd}${hhmm}A094101` +
    `EFINSUITE`.padEnd(23) + opts.companyName.slice(0, 23).padEnd(23) + " ".repeat(8);
  const entries = opts.entries.map((e, i) => {
    const amt = Math.round(e.amount * 100).toString().padStart(10, "0");
    return `622${e.routing.padStart(9)}${e.account.slice(0, 17).padEnd(17)}${amt}${(i + 1).toString().padStart(15, "0")}${e.name.slice(0, 22).padEnd(22)}  0${opts.immediateOrigin.slice(0, 8).padStart(8)}${(i + 1).toString().padStart(7, "0")}`;
  });
  return [fileHeader, ...entries].join("\n");
}

function buildEftpsXml(payload: { ein: string; pin: string; password: string; amount: number; tax_form: string; payment_date: string; tax_period: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<EFTPSBatch>
  <Taxpayer>
    <EIN>${payload.ein}</EIN>
    <PIN>${payload.pin}</PIN>
    <InternetPassword>${payload.password}</InternetPassword>
  </Taxpayer>
  <Payment>
    <TaxForm>${payload.tax_form}</TaxForm>
    <TaxPeriod>${payload.tax_period}</TaxPeriod>
    <Amount>${payload.amount.toFixed(2)}</Amount>
    <SettlementDate>${payload.payment_date}</SettlementDate>
  </Payment>
</EFTPSBatch>`;
}

async function hashFile(content: string): Promise<string> {
  const buf = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: ud } = await supabase.auth.getUser();
    if (!ud?.user) return j({ error: "Unauthorized" }, 401);

    const { action, organization_id, rail_id, entries, eftps_payload } = await req.json();
    if (!organization_id || !action) return j({ error: "Missing fields" }, 400);

    const { data: rail } = await supabase
      .from("us_payment_rails").select("*").eq("id", rail_id).eq("organization_id", organization_id).maybeSingle();
    if (!rail) return j({ error: "Rail not found" }, 404);

    if (action === "generate_ach") {
      const file = buildNachaFile({
        immediateOrigin: rail.routing_number ?? "000000000",
        immediateDestination: rail.routing_number ?? "000000000",
        companyName: rail.nickname ?? "EFINSUITE",
        entries: entries ?? [],
      });
      const fileHash = await hashFile(file);
      const batchRef = `ACH-${Date.now()}`;

      const sftpHost = Deno.env.get("BANK_SFTP_HOST");
      const sftpUser = Deno.env.get("BANK_SFTP_USER");
      const sftpKey = Deno.env.get("BANK_SFTP_KEY");
      let submissionStatus = "simulated";
      let ack: Record<string, unknown> = { mode: "simulated", reason: "BANK_SFTP_* secrets not configured" };

      if (sftpHost && sftpUser && sftpKey) {
        const sftp = new SftpClient();
        try {
          await sftp.connect({ host: sftpHost, username: sftpUser, privateKey: sftpKey, port: 22 });
          const remote = `/incoming/${batchRef}.ach`;
          await sftp.put(new TextEncoder().encode(file), remote);
          ack = { mode: "live", remote_path: remote, uploaded_at: new Date().toISOString() };
          submissionStatus = "submitted";
        } catch (e) {
          ack = { mode: "live", error: e instanceof Error ? e.message : "sftp failed" };
          submissionStatus = "failed";
        } finally {
          try { await sftp.end(); } catch { /* ignore */ }
        }
      }

      await supabase.from("us_payment_rail_submissions").insert({
        organization_id, rail_id, submission_type: "nacha_ach",
        file_hash: fileHash, batch_reference: batchRef, status: submissionStatus, ack,
        created_by: ud.user.id,
      });

      return j({ ok: true, file_format: "NACHA", file_content: file, file_hash: fileHash, batch_reference: batchRef, status: submissionStatus, entry_count: (entries ?? []).length });
    }

    if (action === "submit_eftps") {
      const ein = Deno.env.get("EFTPS_EIN");
      const pin = Deno.env.get("EFTPS_PIN");
      const password = Deno.env.get("EFTPS_INTERNET_PASSWORD");
      const eftpsRef = `EFTPS-${Date.now()}`;
      let submissionStatus = "simulated";
      let ack: Record<string, unknown> = { mode: "simulated", reason: "EFTPS_* secrets not configured" };
      let providerConfirmation: string | null = null;

      if (ein && pin && password) {
        const xml = buildEftpsXml({
          ein, pin, password,
          amount: Number(eftps_payload?.amount ?? 0),
          tax_form: String(eftps_payload?.tax_form ?? "941"),
          payment_date: String(eftps_payload?.payment_date ?? new Date().toISOString().slice(0, 10)),
          tax_period: String(eftps_payload?.tax_period ?? new Date().toISOString().slice(0, 7).replace("-", "")),
        });
        try {
          const resp = await fetch("https://www.eftps.gov/eftps/batch/submit", {
            method: "POST",
            headers: { "Content-Type": "application/xml" },
            body: xml,
          });
          const text = (await resp.text()).slice(0, 4000);
          providerConfirmation = text.match(/<ConfirmationNumber>([^<]+)<\/ConfirmationNumber>/)?.[1] ?? null;
          submissionStatus = resp.ok ? "submitted" : "failed";
          ack = { mode: "live", status: resp.status, response: text };
        } catch (e) {
          ack = { mode: "live", error: e instanceof Error ? e.message : "eftps failed" };
          submissionStatus = "failed";
        }
      }

      await supabase.from("us_payment_rail_submissions").insert({
        organization_id, rail_id, submission_type: "eftps",
        batch_reference: providerConfirmation ?? eftpsRef,
        status: submissionStatus, ack, created_by: ud.user.id,
      });

      return j({
        ok: true,
        eftps_reference: providerConfirmation ?? eftpsRef,
        amount: eftps_payload?.amount ?? 0,
        tax_form: eftps_payload?.tax_form ?? "941",
        scheduled_for: eftps_payload?.payment_date ?? new Date().toISOString().slice(0, 10),
        status: submissionStatus,
      });
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("us-ach-eftps", msg);
    return j({ error: msg }, 500);
  }
});
