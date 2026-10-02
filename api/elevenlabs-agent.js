import { createElevenLabsSession, readElevenLabsApiKey } from "../server/elevenlabsSession.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://boskmqywofwekszhgryb.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ttcXl3b2Z3ZWtzemhncnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQ5NDYsImV4cCI6MjA5ODQzMDk0Nn0.6wATXwVNUsIPvNyqllvZAQWXQMTlLXGCSQIzi-jmlaE";

async function sessionFromEdge(surface) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-agent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ surface }),
  });
  const body = await response.json().catch(() => ({ error: "ElevenLabs Agents did not respond." }));
  return { status: response.status, body };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let surface = "app";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
    if (body?.surface === "landing") surface = "landing";
  } catch {
    res.status(400).json({ error: "ElevenLabs agent expected a JSON object." });
    return;
  }
  const apiKey = readElevenLabsApiKey(process.env);
  const result = apiKey
    ? await createElevenLabsSession(apiKey, surface, process.env.ELEVENLABS_AGENT_ID)
    : await sessionFromEdge(surface);
  res.status(result.status).json(result.body);
}
