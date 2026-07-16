// Shared Google Gemini client for eFinsuite edge functions (Phase 1.2).
// Talks directly to Google AI Studio's generateContent endpoint.
// All AI calls in the app should route through this wrapper.

export interface GeminiInlineImage {
  mimeType: string;
  data: string; // base64 (no data: prefix)
}

export interface GeminiMessage {
  role: "user" | "model";
  text?: string;
  images?: GeminiInlineImage[];
}

export interface CallGeminiOptions {
  model: string;
  system?: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, forces JSON output matching this schema (Gemini responseSchema shape). */
  jsonSchema?: Record<string, unknown>;
  /** Optional Gemini function-calling tools. */
  tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
}

export interface GeminiResponse {
  text: string;
  json?: unknown;
  raw: unknown;
}

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey(): string {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) {
    throw new Error(
      "GOOGLE_AI_API_KEY is not configured. Add it in project secrets.",
    );
  }
  return key;
}

function buildContents(messages: GeminiMessage[]) {
  return messages.map((m) => {
    const parts: Array<Record<string, unknown>> = [];
    if (m.text) parts.push({ text: m.text });
    if (m.images) {
      for (const img of m.images) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    }
    return { role: m.role, parts };
  });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callGemini(
  options: CallGeminiOptions,
): Promise<GeminiResponse> {
  const apiKey = getApiKey();
  const url = `${GEMINI_API_BASE}/${options.model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: buildContents(options.messages),
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
    },
  };

  if (options.system) {
    body.systemInstruction = { role: "system", parts: [{ text: options.system }] };
  }

  if (options.jsonSchema) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
    (body.generationConfig as Record<string, unknown>).responseSchema =
      options.jsonSchema;
  }

  if (options.tools) {
    body.tools = options.tools;
  }

  // Retry once on 429/5xx with backoff.
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const raw = await res.json();
      const parts = raw?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map((p: { text?: string }) => p?.text ?? "")
        .join("")
        .trim();
      let json: unknown;
      if (options.jsonSchema && text) {
        try {
          json = JSON.parse(text);
        } catch {
          // leave undefined; caller can inspect .text
        }
      }
      return { text, json, raw };
    }

    const errBody = await res.text();
    lastError = `Gemini ${res.status}: ${errBody}`;
    if (res.status === 429 || res.status >= 500) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    // Non-retryable — surface immediately.
    throw new Error(lastError);
  }
  throw new Error(lastError || "Gemini request failed");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
