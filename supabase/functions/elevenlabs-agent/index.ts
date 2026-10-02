import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type ListedAgent = { agent_id?: string; name?: string };

function pickAgentId(agents: ListedAgent[], configured?: string | null): string {
  const explicit = (configured || "").trim();
  if (explicit) return explicit;
  const listed = agents
    .map((agent) => ({ id: (agent.agent_id || "").trim(), name: agent.name || "" }))
    .filter((agent) => agent.id);
  const globe = listed.find((agent) => /efinsuite|globe/i.test(agent.name));
  if (globe) return globe.id;
  const alice = listed.find((agent) => /alice/i.test(agent.name));
  return alice?.id || listed[0]?.id || "";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALICE_AGENT = {
  name: "Alice — efinsuite Globe",
  conversation_config: {
    agent: {
      first_message: "Hi, I'm Alice. How can I help you with efinsuite Globe?",
      language: "en",
      prompt: {
        prompt: "You are Alice, the AI business advisor for efinsuite Globe. Help with accounting, finance, tax, and operations. Do not invent balances or filings. For pricing or demos, point visitors to info@efintax.biz.",
      },
    },
    tts: { voice_id: "EXAVITQu4vr4xnSDxMaL" },
  },
};

function explainFailure(body: Record<string, unknown>): string {
  const detail = body.detail;
  const nested = detail && typeof detail === "object" ? detail as Record<string, unknown> : null;
  const message = typeof detail === "string"
    ? detail
    : typeof nested?.message === "string"
      ? nested.message
      : typeof body.message === "string"
        ? body.message
        : nested?.status === "missing_permissions" || body.status === "missing_permissions"
          ? "missing_permissions"
          : "";
  if (/convai_write|missing_permissions|missing the permission/i.test(message)) {
    return "This ElevenLabs API key can see agents but cannot start a conversation. In ElevenLabs, create a key with the Conversational AI write permission and save it again.";
  }
  return message || "Could not start an ElevenLabs session.";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function elevenFetch(apiKey: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 180) };
  }
  return { ok: response.ok, status: response.status, body };
}

async function resolveAgentId(apiKey: string): Promise<string> {
  const configured = pickAgentId([], Deno.env.get("ELEVENLABS_AGENT_ID"));
  if (configured) return configured;

  const listed = await elevenFetch(apiKey, "/v1/convai/agents?page_size=30");
  if (!listed.ok) {
    throw new Error(explainFailure(listed.body));
  }
  const agents = Array.isArray(listed.body.agents) ? listed.body.agents as ListedAgent[] : [];
  const existing = pickAgentId(agents);
  if (existing) return existing;

  const created = await elevenFetch(apiKey, "/v1/convai/agents/create", {
    method: "POST",
    body: JSON.stringify(ALICE_AGENT),
  });
  const agentId = String(created.body.agent_id || "");
  if (!created.ok || !agentId) {
    throw new Error(explainFailure(created.body));
  }
  return agentId;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = (Deno.env.get("ELEVENLABS_API_KEY") || "").trim();
  if (!apiKey) return json({ error: "ElevenLabs API key is not configured." }, 500);

  try {
    const payload = await req.json().catch(() => ({}));
    const surface = payload?.surface === "landing" ? "landing" : "app";
    const agentId = await resolveAgentId(apiKey);
    const token = await elevenFetch(
      apiKey,
      `/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    );
    if (token.ok && typeof token.body.token === "string") {
      return json({ token: token.body.token, agentId, surface });
    }
    const signed = await elevenFetch(
      apiKey,
      `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    );
    if (signed.ok && typeof signed.body.signed_url === "string") {
      return json({ signedUrl: signed.body.signed_url, agentId, surface });
    }
    return json({ error: explainFailure(token.ok ? signed.body : token.body) }, token.status || 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start an ElevenLabs session.";
    return json({ error: message }, 502);
  }
});
