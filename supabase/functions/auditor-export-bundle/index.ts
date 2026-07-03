import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

// Minimal ZIP (STORE method, no compression) — produces a valid .zip from in-memory entries
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  // CRC32
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[i] = c >>> 0;
  }
  const crc32 = (buf: Uint8Array) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method = store
    dv.setUint16(10, 0, true); // time
    dv.setUint16(12, 0, true); // date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, f.data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);
    cdv.setUint16(6, 20, true);
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, 0, true);
    cdv.setUint16(12, 0, true);
    cdv.setUint16(14, 0, true);
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true);
    cdv.setUint16(32, 0, true);
    cdv.setUint16(34, 0, true);
    cdv.setUint16(36, 0, true);
    cdv.setUint32(38, 0, true);
    cdv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + size;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, files.length, true);
  edv.setUint16(10, files.length, true);
  edv.setUint32(12, centralSize, true);
  edv.setUint32(16, offset, true);

  const total = chunks.reduce((a, c) => a + c.length, 0) + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  for (const c of central) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
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

    const { organization_id, period_start, period_end } = await req.json();
    if (!organization_id || !period_start || !period_end) return j({ error: "Missing fields" }, 400);

    const { data: run, error: runErr } = await supabase
      .from("auditor_export_runs")
      .insert({ organization_id, period_start, period_end, status: "running", requested_by: ud.user.id })
      .select()
      .single();
    if (runErr || !run) return j({ error: runErr?.message ?? "run insert failed" }, 500);

    try {
      // Pull data
      const { data: jeLines } = await supabase
        .from("journal_entry_lines")
        .select("id, journal_entry_id, account_id, debit, credit, description")
        .limit(5000);
      const { data: jes } = await supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, status")
        .eq("organization_id", organization_id)
        .gte("entry_date", period_start)
        .lte("entry_date", period_end)
        .limit(5000);
      const { data: alerts } = await supabase
        .from("treasury_alerts")
        .select("severity, category, title, body, created_at")
        .eq("organization_id", organization_id)
        .gte("created_at", period_start);

      const enc = new TextEncoder();
      const files: { name: string; data: Uint8Array }[] = [
        { name: "INDEX.txt", data: enc.encode(
          `efinsuite Auditor Export Bundle\nOrganization: ${organization_id}\nPeriod: ${period_start} → ${period_end}\nGenerated: ${new Date().toISOString()}\n\nContents:\n- journal_entries.csv\n- journal_entry_lines.csv\n- anomaly_alerts.csv\n`)
        },
        { name: "journal_entries.csv", data: enc.encode(toCsv((jes ?? []) as Record<string, unknown>[])) },
        { name: "journal_entry_lines.csv", data: enc.encode(toCsv((jeLines ?? []) as Record<string, unknown>[])) },
        { name: "anomaly_alerts.csv", data: enc.encode(toCsv((alerts ?? []) as Record<string, unknown>[])) },
      ];
      const zip = buildZip(files);

      const path = `${organization_id}/${period_start}_${period_end}_${run.id}.zip`;
      const { error: upErr } = await supabase.storage
        .from("auditor-bundles")
        .upload(path, zip, { contentType: "application/zip", upsert: true });
      if (upErr) throw upErr;

      await supabase
        .from("auditor_export_runs")
        .update({ status: "completed", bundle_path: path, completed_at: new Date().toISOString() })
        .eq("id", run.id);

      return j({ ok: true, run_id: run.id, bundle_path: path, size_bytes: zip.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown";
      await supabase.from("auditor_export_runs").update({ status: "failed", error: msg }).eq("id", run.id);
      return j({ error: msg }, 500);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return j({ error: msg }, 500);
  }
});
