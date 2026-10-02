import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ALICE_VOICE_ID,
  cleanTextForTTS,
  getAliceFunctionHeaders,
  shortenForSpeech,
} from "@/lib/aliceVoice";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export function useAliceTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  // Browsers only allow playback that begins in the click. Prime the element
  // before any network wait so the later play() is allowed.
  const prime = useCallback(() => {
    const audio = ensureAudio();
    if (audio.src && !audio.src.startsWith("data:audio/wav")) return;
    if (!audio.src) audio.src = SILENT_WAV;
    audio.muted = true;
    const attempt = audio.play();
    if (attempt) {
      attempt
        .then(() => {
          if (audio.muted) {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          }
        })
        .catch(() => {
          audio.muted = false;
        });
    }
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text: string): Promise<void> => {
    prime();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const audio = ensureAudio();
    audio.pause();

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) return;

    const shortened = shortenForSpeech(cleanText);
    if (shortened.shortened) {
      toast.message("Reading a shortened version to fit voice limits.");
    }

    lastTextRef.current = text;
    setIsLoading(true);
    setIsPaused(false);
    setIsSpeaking(false);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: await getAliceFunctionHeaders(true),
        body: JSON.stringify({
          text: shortened.text,
          voiceId: ALICE_VOICE_ID,
        }),
        signal: controller.signal,
      });

      if (requestId !== requestRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as {
          error?: string;
          provider_error?: { detail?: { status?: string; message?: string } };
        }));
        const providerDetail = errorData?.provider_error?.detail;
        if (providerDetail?.status === "quota_exceeded") {
          throw new Error(providerDetail.message || "Voice quota exceeded. Please shorten the text or top up credits.");
        }
        throw new Error(errorData?.error || `Failed to generate speech (${response.status})`);
      }

      const audioBlob = await response.blob();
      if (requestId !== requestRef.current) return;
      if (audioBlob.size === 0) throw new Error("No audio data received");
      if (audioBlob.type.includes("json") || audioBlob.type.startsWith("text/")) {
        throw new Error("Voice service returned an unexpected response");
      }

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const playable = audioBlob.type
        ? audioBlob
        : new Blob([audioBlob], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(playable);
      audioUrlRef.current = audioUrl;

      audio.onended = () => {
        if (requestId !== requestRef.current) return;
        setIsSpeaking(false);
        setIsPaused(false);
      };
      audio.onerror = () => {
        if (requestId !== requestRef.current) return;
        setIsSpeaking(false);
        setIsPaused(false);
        toast.error("Audio playback failed");
      };

      audio.muted = false;
      audio.src = audioUrl;
      audio.currentTime = 0;
      setIsLoading(false);
      setIsSpeaking(true);
      try {
        await audio.play();
      } catch (playError: unknown) {
        const name = playError instanceof DOMException ? playError.name : "";
        toast.error(name === "NotAllowedError" ? "Tap Listen again to allow audio playback" : "Could not play audio");
        setIsSpeaking(false);
      }
    } catch (err: unknown) {
      if (requestId !== requestRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Failed to generate speech";
      console.error("TTS error:", message);
      toast.error(message);
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [prime]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused && !audio.ended) {
      audio.pause();
      setIsPaused(true);
      setIsSpeaking(true);
    }
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setIsPaused(false);
      setIsSpeaking(true);
    }).catch(() => {
      toast.error("Could not resume audio");
    });
  }, []);

  const replay = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audioUrlRef.current) {
      audio.currentTime = 0;
      audio.muted = false;
      setIsPaused(false);
      setIsSpeaking(true);
      try {
        await audio.play();
      } catch {
        toast.error("Could not replay audio");
        setIsSpeaking(false);
      }
      return;
    }
    if (lastTextRef.current) await speak(lastTextRef.current);
  }, [speak]);

  const toggle = useCallback(async (text: string) => {
    if (isSpeaking && !isPaused) pause();
    else if (isPaused) resume();
    else await speak(text);
  }, [isSpeaking, isPaused, pause, resume, speak]);

  return {
    speak,
    pause,
    resume,
    stop,
    replay,
    toggle,
    prime,
    isSpeaking,
    isPaused,
    isLoading,
  };
}
