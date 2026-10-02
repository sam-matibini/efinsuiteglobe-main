import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversationControls, useConversationMode, useConversationStatus } from "@elevenlabs/react";
import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { agentOverrides, type AgentSurface } from "@/lib/elevenlabsAgent";
import { toast } from "sonner";

type TranscriptHandler = (role: "user" | "assistant", text: string) => void;

type AgentSession = { token?: string; signedUrl?: string };

function unavailable(detail: string): boolean {
  return /not found|failed to send|failed to fetch|network|not available|did not respond/i.test(detail);
}

async function loadLocalSession(surface: "landing" | "app"): Promise<AgentSession> {
  const response = await fetch("/api/elevenlabs-agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ surface }),
  });
  const body = await response.json() as AgentSession & { error?: string };
  if (!response.ok || body.error) {
    throw new Error(body.error || "ElevenLabs Agents is not available on this server yet.");
  }
  if (body.token || body.signedUrl) return body;
  throw new Error("ElevenLabs did not return a session.");
}

async function loadAgentSession(surface: "landing" | "app"): Promise<AgentSession> {
  try {
    return await loadLocalSession(surface);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!(err instanceof SyntaxError) && message && !unavailable(message)) throw err;
  }

  let remoteError = "";
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("elevenlabs-agent", { body: { surface } }),
      12000,
      "ElevenLabs Agents did not respond.",
    );
    if (error) {
      let detail = error.message || "Could not start Alice.";
      const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (context && typeof context.json === "function") {
        try {
          const body = await context.json();
          if (body?.error) detail = body.error;
        } catch {
          /* body already read */
        }
      }
      if (unavailable(detail)) detail = "ElevenLabs Agents is not available on this server yet.";
      remoteError = detail;
    } else {
      const payload = data as AgentSession & { error?: string };
      if (payload?.error) remoteError = payload.error;
      else if (payload?.token || payload?.signedUrl) return payload;
      else remoteError = "ElevenLabs did not return a session.";
    }
  } catch (err) {
    remoteError = err instanceof Error ? err.message : "Could not start Alice.";
  }

  if (remoteError && !unavailable(remoteError)) throw new Error(remoteError);
  throw new Error(remoteError || "ElevenLabs Agents is not available on this server yet.");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function SessionControls({
  surface,
  tone,
  onClose,
}: {
  surface: AgentSurface;
  tone: "light" | "dark";
  onClose: () => void;
}) {
  const { startSession, endSession } = useConversationControls();
  const { status, message } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const startRef = useRef(startSession);
  const endRef = useRef(endSession);
  startRef.current = startSession;
  endRef.current = endSession;
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const begin = async () => {
      try {
        const payload = await loadAgentSession(surface);
        if (cancelled) return;
        const overrides = agentOverrides(surface);
        if (payload.token) startRef.current({ conversationToken: payload.token, overrides });
        else if (payload.signedUrl) startRef.current({ signedUrl: payload.signedUrl, overrides });
        else throw new Error("ElevenLabs did not return a session.");
      } catch (err) {
        if (cancelled) return;
        const text = err instanceof Error ? err.message : "Could not start Alice.";
        setFailure(text);
        toast.error(text);
      }
    };

    void begin();
    return () => {
      cancelled = true;
      endRef.current();
    };
  }, [surface]);

  const label = failure
    || (status === "error" ? message || "Alice could not connect" : null)
    || (status === "connecting" || status === "disconnected"
      ? "Connecting to Alice…"
      : isSpeaking
        ? "Alice is speaking"
        : "Alice is listening");

  const dark = tone === "dark";

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${dark ? "bg-white/10 text-white" : "bg-accent/10 text-foreground"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-green-500 animate-pulse" : "bg-amber-400"}`} />
        <span className="text-xs truncate">{label}</span>
      </div>
      <Button
        type="button"
        size="sm"
        variant={dark ? "secondary" : "outline"}
        className="h-7"
        onClick={() => {
          endSession();
          onClose();
        }}
      >
        <PhoneOff className="h-3.5 w-3.5 mr-1" />
        End
      </Button>
    </div>
  );
}

export function ElevenLabsAgentSession({
  surface,
  tone = "light",
  onClose,
  onTranscript,
}: {
  surface: AgentSurface;
  tone?: "light" | "dark";
  onClose: () => void;
  onTranscript?: TranscriptHandler;
}) {
  return (
    <ConversationProvider
      onMessage={(payload) => {
        const text = payload.message?.trim();
        if (!text || !onTranscript) return;
        onTranscript(payload.source === "user" ? "user" : "assistant", text);
      }}
      onError={(message) => {
        if (message) toast.error(message);
      }}
    >
      <SessionControls surface={surface} tone={tone} onClose={onClose} />
    </ConversationProvider>
  );
}
