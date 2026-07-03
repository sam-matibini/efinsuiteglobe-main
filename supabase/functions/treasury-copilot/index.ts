import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are the efinsuite Treasury Copilot — an analyst inside a Canadian/US accounting platform.

Your job: answer questions about cash flow, remittances, anomalies, filings, period close, scheduled jobs, alerts and US payment rails using the available read-only tools. Never invent numbers. If a tool returns no data, say so. Cite period/authority when relevant. Keep answers short and decision-oriented.

Privacy: never echo SINs, EINs, or bank account numbers. If asked, refuse.`;

const TOOLS = [
  { type: "function", function: { name: "get_org_snapshot", description: "Counts of open anomalies, open period closes, pending filings, draft vendor slips.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "list_anomalies", description: "List recent treasury anomalies. status: open|acknowledged|dismissed", parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_filings", description: "List recent CRA filings. status: draft|submitted|accepted|rejected", parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_period_close", description: "Remittance periods and close status.", parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_job_runs", description: "Recent scheduled job runs (status, duration). job_name optional filter.", parameters: { type: "object", properties: { job_name: { type: "string" }, status: { type: "string" }, limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_alerts", description: "Recent treasury alerts. severity: low|medium|high|critical", parameters: { type: "object", properties: { severity: { type: "string" }, acknowledged: { type: "boolean" }, limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "list_us_rail_submissions", description: "Recent US payment rail submissions (NACHA / EFTPS).", parameters: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } }, additionalProperties: false } } },
];

type ToolTraceEntry = { name: string; args: unknown; ms: number; rows: number };

async function callTool(supabase: any, orgId: string, name: string, args: any): Promise<{ data: unknown; rows: number }> {
  const limit = args?.limit ?? 20;
  if (name === "get_org_snapshot") {
    const { data } = await supabase.rpc("copilot_org_snapshot", { _org_id: orgId });
    return { data: data ?? {}, rows: 1 };
  }
  if (name === "list_anomalies") {
    let q = supabase.from("treasury_anomalies").select("id, severity, category, status, created_at, payload").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  if (name === "list_filings") {
    let q = supabase.from("cra_filings").select("id, filing_type, tax_year, period, status, submitted_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  if (name === "list_period_close") {
    let q = supabase.from("treasury_period_close").select("id, authority, period_start, period_end, status, due_date").eq("organization_id", orgId).order("due_date").limit(limit);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  if (name === "list_job_runs") {
    let q = supabase.from("treasury_job_runs").select("id, job_name, status, started_at, finished_at, duration_ms, error").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(limit);
    if (args.job_name) q = q.eq("job_name", args.job_name);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  if (name === "list_alerts") {
    let q = supabase.from("treasury_alerts").select("id, severity, category, title, body, acknowledged_at, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit);
    if (args.severity) q = q.eq("severity", args.severity);
    if (args.acknowledged === false) q = q.is("acknowledged_at", null);
    if (args.acknowledged === true) q = q.not("acknowledged_at", "is", null);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  if (name === "list_us_rail_submissions") {
    let q = supabase.from("us_payment_rail_submissions").select("id, submission_type, batch_reference, status, submitted_at, ack").eq("organization_id", orgId).order("submitted_at", { ascending: false }).limit(limit);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q; return { data: data ?? [], rows: (data ?? []).length };
  }
  return { data: { error: `Unknown tool ${name}` }, rows: 0 };
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { organization_id, messages, conversation_id, model, stream } = body;
    if (!organization_id || !messages) return j({ error: "Missing fields" }, 400);

    const sanitized = messages.map((m: { role: string; content: unknown }) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[REDACTED-ID]") : m.content,
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return j({ error: "LOVABLE_API_KEY not configured" }, 500);
    const selectedModel = model || "google/gemini-2.5-flash";

    const convo: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...sanitized];
    const trace: ToolTraceEntry[] = [];

    // -------- Non-streaming path (tool loop, then return) --------
    if (!stream) {
      for (let iter = 0; iter < 5; iter++) {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: selectedModel, messages: convo, tools: TOOLS, stream: false }),
        });
        if (resp.status === 429) return j({ error: "Rate limited" }, 429);
        if (resp.status === 402) return j({ error: "Credits exhausted" }, 402);
        if (!resp.ok) return j({ error: `Gateway error ${resp.status}` }, 500);
        const data = await resp.json();
        const msg = data.choices?.[0]?.message;
        if (!msg) return j({ error: "Empty response" }, 500);

        if (msg.tool_calls?.length) {
          convo.push(msg);
          for (const tc of msg.tool_calls) {
            const args = JSON.parse(tc.function.arguments || "{}");
            const t0 = Date.now();
            const { data: result, rows } = await callTool(supabase, organization_id, tc.function.name, args);
            trace.push({ name: tc.function.name, args, ms: Date.now() - t0, rows });
            convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
          }
          continue;
        }

        if (conversation_id) {
          const userMsg = sanitized[sanitized.length - 1];
          await supabase.from("copilot_messages").insert([
            { conversation_id, organization_id, user_id: userData.user.id, role: userMsg.role, content: userMsg.content },
            { conversation_id, organization_id, user_id: userData.user.id, role: "assistant", content: msg.content ?? "", tool_trace: trace },
          ]);
        }
        return j({ ok: true, message: msg.content ?? "", tool_trace: trace });
      }
      return j({ error: "Tool loop exceeded" }, 500);
    }

    // -------- Streaming path (SSE) --------
    const sseStream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const emit = (event: string, data: unknown) =>
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        let finalText = "";
        try {
          for (let iter = 0; iter < 5; iter++) {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: selectedModel, messages: convo, tools: TOOLS, stream: true }),
            });
            if (!resp.ok || !resp.body) { emit("error", { error: `Gateway ${resp.status}` }); break; }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let toolCalls: any[] = [];
            let assistantContent = "";

            outer: while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split("\n");
              buffer = parts.pop() ?? "";
              for (const line of parts) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const chunk = JSON.parse(payload);
                  const delta = chunk.choices?.[0]?.delta;
                  if (!delta) continue;
                  if (delta.content) {
                    assistantContent += delta.content;
                    emit("delta", { content: delta.content });
                  }
                  if (delta.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      toolCalls[idx] ??= { id: tc.id, type: "function", function: { name: "", arguments: "" } };
                      if (tc.id) toolCalls[idx].id = tc.id;
                      if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                      if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                    }
                  }
                  if (chunk.choices?.[0]?.finish_reason) break outer;
                } catch { /* ignore parse */ }
              }
            }

            if (toolCalls.length) {
              convo.push({ role: "assistant", content: assistantContent || null, tool_calls: toolCalls });
              for (const tc of toolCalls) {
                const args = JSON.parse(tc.function.arguments || "{}");
                const t0 = Date.now();
                const { data: result, rows } = await callTool(supabase, organization_id, tc.function.name, args);
                const entry = { name: tc.function.name, args, ms: Date.now() - t0, rows };
                trace.push(entry);
                emit("tool", entry);
                convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 8000) });
              }
              continue; // next iteration to get final answer
            }

            finalText = assistantContent;
            break;
          }

          if (conversation_id) {
            const userMsg = sanitized[sanitized.length - 1];
            await supabase.from("copilot_messages").insert([
              { conversation_id, organization_id, user_id: userData.user.id, role: userMsg.role, content: userMsg.content },
              { conversation_id, organization_id, user_id: userData.user.id, role: "assistant", content: finalText, tool_trace: trace },
            ]);
          }
          emit("done", { tool_trace: trace });
        } catch (e) {
          emit("error", { error: e instanceof Error ? e.message : "stream failed" });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(sseStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("treasury-copilot", e);
    return j({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
