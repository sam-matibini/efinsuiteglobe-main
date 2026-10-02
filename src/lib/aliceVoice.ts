import { supabase } from "@/integrations/supabase/client";

/** Sarah — the professional female voice already configured for Alice. */
export const ALICE_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export const ALICE_INTRO =
  "Hello! I'm Alice, your AI business advisor. I can help with accounting, finance, tax, payroll, and operations. Type a question, or tap the microphone and talk to me.";

export const ALICE_TTS_MAX_CHARS = 1200;

export function cleanTextForTTS(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/•/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Keep spoken replies inside the provider limit, preferring a sentence boundary. */
export function shortenForSpeech(text: string, maxChars = ALICE_TTS_MAX_CHARS): { text: string; shortened: boolean } {
  if (text.length <= maxChars) return { text, shortened: false };
  const slice = text.slice(0, maxChars);
  const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  const spoken = (lastStop > 300 ? slice.slice(0, lastStop + 1) : slice).trim();
  return { text: `${spoken} …`, shortened: true };
}

export async function getAliceFunctionHeaders(json = false): Promise<Record<string, string>> {
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const headers: Record<string, string> = { apikey: publishableKey };
  if (json) headers["Content-Type"] = "application/json";

  let token = publishableKey;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) token = data.session.access_token;
  } catch {
    token = publishableKey;
  }
  headers.Authorization = `Bearer ${token}`;
  return headers;
}
