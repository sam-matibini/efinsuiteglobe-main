import fs from "fs";
import os from "os";
import path from "path";

const ALICE_AGENT = {
  name: "Alice — efinsuite Globe",
  conversation_config: {
    agent: {
      first_message: "Hi, I'm Alice. How can I help you with efinsuite Globe?",
      language: "en",
      prompt: {
        prompt: "You are Alice, the AI business advisor for efinsuite Globe, the accounting, payroll, tax, and treasury platform. Help with accounting, bookkeeping, finance, tax, payroll, and operations in Canada, the USA, Zambia, Kenya, Burundi, and Uganda. You cannot change the books, send payments, or file a return. Do not invent balances, dates, or filings. For pricing, demos, or migrations, invite them to email info@efintax.biz.",
      },
    },
    tts: { voice_id: "EXAVITQu4vr4xnSDxMaL" },
  },
  platform_settings: {
    overrides: {
      conversation_config_override: {
        agent: {
          first_message: true,
        },
      },
    },
  },
};

function keyFromText(text) {
  const named = text.match(/^ELEVENLABS_API_KEY=(.*)$/m);
  const namedValue = (named?.[1] || "").trim().replace(/^["']|["']$/g, "");
  if (/^sk_[A-Za-z0-9]+$/.test(namedValue)) return namedValue;
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .find((item) => /^sk_[A-Za-z0-9]+$/.test(item));
  return line || "";
}

export function readElevenLabsApiKey(env = process.env) {
  const fromEnv = String(env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const file = path.join(os.homedir(), "Desktop", "efinmoney-token.txt");
    return keyFromText(fs.readFileSync(file, "utf8"));
  } catch {
    return "";
  }
}

function explainFailure(body) {
  const detail = body && typeof body === "object" ? body.detail : undefined;
  const nested = detail && typeof detail === "object" ? detail : null;
  const message = typeof detail === "string"
    ? detail
    : typeof nested?.message === "string"
      ? nested.message
      : typeof body?.message === "string"
        ? body.message
        : nested?.status === "missing_permissions" || body?.status === "missing_permissions"
          ? "missing_permissions"
          : "";
  if (/convai_write|missing_permissions|missing the permission/i.test(message)) {
    return "This ElevenLabs API key can see agents but cannot start a conversation. In ElevenLabs, create a key with the Conversational AI write permission and save it again.";
  }
  return message || "Could not start an ElevenLabs session.";
}

function pickAgentId(agents, configured) {
  const explicit = String(configured || "").trim();
  if (explicit) return explicit;
  const listed = (agents || [])
    .map((agent) => ({
      id: String(agent.agent_id || agent.agentId || "").trim(),
      name: agent.name || "",
    }))
    .filter((agent) => agent.id);
  const globe = listed.find((agent) => /efinsuite|globe/i.test(agent.name));
  if (globe) return globe.id;
  const alice = listed.find((agent) => /alice/i.test(agent.name));
  return alice?.id || listed[0]?.id || "";
}

async function elevenFetch(apiKey, requestPath, fetchImpl, init) {
  const response = await fetchImpl(`https://api.elevenlabs.io${requestPath}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 180) };
  }
  return { ok: response.ok, status: response.status, body };
}

async function resolveAgentId(apiKey, configured, fetchImpl) {
  const explicit = pickAgentId([], configured);
  if (explicit) return explicit;
  const listed = await elevenFetch(apiKey, "/v1/convai/agents?page_size=30", fetchImpl);
  if (!listed.ok) throw new Error(explainFailure(listed.body));
  const agents = Array.isArray(listed.body.agents) ? listed.body.agents : [];
  const globe = pickAgentId(agents.filter((agent) => /efinsuite|globe/i.test(agent.name || "")));
  if (globe) return globe;
  let created = await elevenFetch(apiKey, "/v1/convai/agents/create", fetchImpl, {
    method: "POST",
    body: JSON.stringify(ALICE_AGENT),
  });
  if (!created.ok) {
    created = await elevenFetch(apiKey, "/v1/convai/agents/create", fetchImpl, {
      method: "POST",
      body: JSON.stringify({ name: ALICE_AGENT.name, conversation_config: ALICE_AGENT.conversation_config }),
    });
  }
  const agentId = String(created.body.agent_id || "");
  if (!created.ok || !agentId) throw new Error(explainFailure(created.body));
  return agentId;
}

export async function createElevenLabsSession(apiKey, surface, configuredAgentId, fetchImpl = fetch) {
  const safeSurface = surface === "landing" ? "landing" : "app";
  if (!apiKey) {
    return { status: 500, body: { error: "ElevenLabs API key is not configured on the server. Add a key with Conversational AI write permission." } };
  }
  try {
    const agentId = await resolveAgentId(apiKey, configuredAgentId, fetchImpl);
    const token = await elevenFetch(
      apiKey,
      `/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      fetchImpl,
    );
    if (token.ok && typeof token.body.token === "string") {
      return { status: 200, body: { token: token.body.token, agentId, surface: safeSurface } };
    }
    const signed = await elevenFetch(
      apiKey,
      `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      fetchImpl,
    );
    if (signed.ok && typeof signed.body.signed_url === "string") {
      return { status: 200, body: { signedUrl: signed.body.signed_url, agentId, surface: safeSurface } };
    }
    return { status: token.status || 502, body: { error: explainFailure(token.ok ? signed.body : token.body) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start an ElevenLabs session.";
    return { status: 502, body: { error: message } };
  }
}
