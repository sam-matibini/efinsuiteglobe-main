import { createElevenLabsSession, readElevenLabsApiKey } from "../server/elevenlabsSession.js";

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
  if (!apiKey && req.headers["x-ef-probe"] === "1") {
    res.status(500).json({
      error: "ElevenLabs API key is not configured.",
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      hasAnon: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
      hasUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    });
    return;
  }
  const result = await createElevenLabsSession(apiKey, surface, process.env.ELEVENLABS_AGENT_ID);
  res.status(result.status).json(result.body);
}
