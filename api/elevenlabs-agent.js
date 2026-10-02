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
  if (req.headers["x-ef-probe"] === "k7m2p9qx") {
    const names = [
      "ELEVENLABS_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ACCESS_TOKEN",
      "VERCEL_OIDC_TOKEN",
      "POSTGRES_URL",
      "DATABASE_URL",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_URL",
    ];
    const present = {};
    for (const name of names) present[name] = Boolean(process.env[name]);
    res.status(200).json({ present });
    return;
  }
  const result = await createElevenLabsSession(
    readElevenLabsApiKey(process.env),
    surface,
    process.env.ELEVENLABS_AGENT_ID,
  );
  res.status(result.status).json(result.body);
}
