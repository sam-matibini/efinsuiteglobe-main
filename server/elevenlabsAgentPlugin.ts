import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { createElevenLabsSession, readElevenLabsApiKey } from "./elevenlabsSession.js";

/**
 * Dev-server route POST /api/elevenlabs-agent.
 * Uses the local ElevenLabs key so Talk works before the edge function is deployed.
 * The key is never written into the client bundle.
 */
export function elevenlabsAgentPlugin(): Plugin {
  return {
    name: "elevenlabs-agent",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      server.middlewares.use("/api/elevenlabs-agent", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        void serve(req, res, env).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Could not start an ElevenLabs session.";
          json(res, 500, { error: message });
        });
      });
    },
  };
}

async function serve(
  req: { on(event: string, listener: (chunk?: Buffer) => void): void },
  res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void },
  env: Record<string, string>,
) {
  const raw = await readBody(req);
  let surface = "app";
  try {
    const parsed = JSON.parse(raw || "{}") as { surface?: string };
    if (parsed?.surface === "landing") surface = "landing";
  } catch {
    json(res, 400, { error: "ElevenLabs agent expected a JSON object." });
    return;
  }
  const apiKey = readElevenLabsApiKey(env);
  const result = await createElevenLabsSession(apiKey, surface, env.ELEVENLABS_AGENT_ID || process.env.ELEVENLABS_AGENT_ID);
  json(res, result.status, result.body);
}

function readBody(req: { on(event: string, listener: (chunk?: Buffer) => void): void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk) => {
      const buffer = Buffer.from(chunk ?? []);
      size += buffer.length;
      if (size > 100_000) {
        reject(new Error("ElevenLabs agent request is too large."));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => reject(new Error("ElevenLabs agent request could not be read.")));
  });
}

function json(
  res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void },
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
