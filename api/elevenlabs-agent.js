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
  const result = await createElevenLabsSession(
    readElevenLabsApiKey(process.env),
    surface,
    process.env.ELEVENLABS_AGENT_ID,
  );
  res.status(result.status).json(result.body);
}
