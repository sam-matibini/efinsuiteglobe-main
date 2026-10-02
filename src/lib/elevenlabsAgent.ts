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
  const preferred = listed.find((agent) => /alice|efinsuite/i.test(agent.name));
  return preferred?.id || listed[0]?.id || "";
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
