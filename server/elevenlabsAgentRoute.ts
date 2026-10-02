import fs from "fs";
import os from "os";
import path from "path";
import { elevenLabsKeyFromText, explainElevenLabsFailure, pickAgentId, type ListedAgent } from "../src/lib/elevenlabsAgent";

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
  platform_settings: {
    overrides: {
      conversation_config_override: {
        agent: {
          first_message: true,
          language: true,
          prompt: { prompt: true },
        },
        tts: { voice_id: true },
      },
    },
  },
};

export function readElevenLabsApiKey(env: Record<string, string>): string {
  const fromEnv = (env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const file = path.join(os.homedir(), "Desktop", "efinmoney-token.txt");
    return elevenLabsKeyFromText(fs.readFileSync(file, "utf8"));
  } catch {
    return "";
  }
}

type FetchLike = typeof fetch;

async function elevenFetch(apiKey: string, requestPath: string, fetchImpl: FetchLike, init?: RequestInit) {
  const response = await fetchImpl(`https://api.elevenlabs.io${requestPath}`, {
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
    body = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    body = { message: text.slice(0, 180) };
  }
  return { ok: response.ok, status: response.status, body };
}

async function resolveAgentId(apiKey: string, configured: string | undefined, fetchImpl: FetchLike): Promise<string> {
  const explicit = pickAgentId([], configured);
  if (explicit) return explicit;

  const listed = await elevenFetch(apiKey, "/v1/convai/agents?page_size=30", fetchImpl);
  if (!listed.ok) {
    throw new Error(explainElevenLabsFailure(listed.body));
  }
  const agents = Array.isArray(listed.body.agents) ? listed.body.agents as ListedAgent[] : [];
  const existing = pickAgentId(agents);
  if (existing) return existing;

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
  if (!created.ok || !agentId) {
    throw new Error(explainElevenLabsFailure(created.body));
  }
  return agentId;
}

export async function createElevenLabsSession(
  apiKey: string,
  surface: string,
  configuredAgentId: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const safeSurface = surface === "landing" ? "landing" : "app";
  if (!apiKey) {
    return { status: 500, body: { error: "ElevenLabs API key is not configured." } };
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
    const detail = explainElevenLabsFailure(token.ok ? signed.body : token.body);
    return { status: token.status || 502, body: { error: detail } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start an ElevenLabs session.";
    return { status: 502, body: { error: message } };
  }
}
