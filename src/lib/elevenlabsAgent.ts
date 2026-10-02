export const ALICE_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export type AgentSurface = "landing" | "app";

export type ListedAgent = {
  agent_id?: string;
  agentId?: string;
  name?: string;
};

const LANDING_PROMPT = `You are Alice, the voice assistant on the efinsuite Globe website.
Help visitors understand the accounting, bookkeeping, multi-currency, and AI features.
Countries supported: Canada, USA, Zambia, Kenya, Burundi, and Uganda.
Keep answers to a few sentences. For pricing, demos, contracts, or migrations, invite them to email info@efintax.biz.
Do not invent account balances, filings, or prices.`;

const APP_PROMPT = `You are Alice, the AI business advisor inside efinsuite Globe.
Help the signed-in user with accounting, finance, tax, payroll, and day-to-day operations.
You cannot change the books, send payments, or file a return. Do not invent balances, dates, or filings.
If you are unsure, say so and point them to the page in the app.`;

export function agentOverrides(surface: AgentSurface) {
  const landing = surface === "landing";
  return {
    agent: {
      firstMessage: landing
        ? "Hi, I'm Alice. I can walk you through efinsuite Globe. What would you like to know?"
        : "Hi, I'm Alice. Ask me about your books, tax, or how to get something done in efinsuite.",
      prompt: { prompt: landing ? LANDING_PROMPT : APP_PROMPT },
    },
    tts: { voiceId: ALICE_VOICE_ID },
  };
}

export function pickAgentId(agents: ListedAgent[], configured?: string | null): string {
  const explicit = (configured || "").trim();
  if (explicit) return explicit;
  const listed = agents
    .map((agent) => ({
      id: (agent.agent_id || agent.agentId || "").trim(),
      name: agent.name || "",
    }))
    .filter((agent) => agent.id);
  const globe = listed.find((agent) => /efinsuite|globe/i.test(agent.name));
  if (globe) return globe.id;
  const alice = listed.find((agent) => /alice/i.test(agent.name));
  return alice?.id || listed[0]?.id || "";
}

/** Pull an ElevenLabs API key out of a local notes file. Never log the result. */
export function elevenLabsKeyFromText(text: string): string {
  const named = text.match(/^ELEVENLABS_API_KEY=(.*)$/m);
  const namedValue = (named?.[1] || "").trim().replace(/^["']|["']$/g, "");
  if (/^sk_[A-Za-z0-9]+$/.test(namedValue)) return namedValue;
  const line = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .find((item) => /^sk_[A-Za-z0-9]+$/.test(item));
  return line || "";
}

function elevenLabsDetail(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const nested = detail as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
    if (nested.status === "missing_permissions") return "missing_permissions";
  }
  if (typeof record.message === "string") return record.message;
  if (record.status === "missing_permissions") return "missing_permissions";
  return "";
}

/** Turn an ElevenLabs error into a sentence the user can act on. */
export function explainElevenLabsFailure(body: unknown): string {
  const message = elevenLabsDetail(body);
  if (/convai_write|missing_permissions|missing the permission/i.test(message)) {
    return "This ElevenLabs API key can see agents but cannot start a conversation. In ElevenLabs, create a key with the Conversational AI write permission and save it again.";
  }
  return message || "Could not start an ElevenLabs session.";
}

export function readAgentUtterance(message: { source?: string; role?: string; message?: string }): {
  role: "user" | "assistant";
  text: string;
} | null {
  const text = (message.message || "").trim();
  if (!text) return null;
  const source = message.source || message.role || "";
  return { role: source === "user" ? "user" : "assistant", text };
}
