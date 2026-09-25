import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

// Alice's ElevenLabs voice ID - professional female voice
const ALICE_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah - clear, professional female voice

export function useAliceTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const cleanTextForTTS = (text: string): string => {
    return text
      .replace(/\*\*/g, "") // Remove bold markers
      .replace(/\*/g, "") // Remove italic markers
      .replace(/#{1,6}\s/g, "") // Remove heading markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to just text
      .replace(/`[^`]+`/g, "") // Remove inline code
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/•/g, "") // Remove bullet points
      .replace(/\n{3,}/g, "\n\n") // Reduce excessive newlines
      .trim();
  };

  const speak = useCallback(async (text: string): Promise<void> => {
    // Stop any current speech first
    stop();

    if (!text.trim()) return;

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) return;

    // Keep TTS short to avoid provider quota errors
    const TTS_MAX_CHARS = 1200;
    let speechText = cleanText;
    if (speechText.length > TTS_MAX_CHARS) {
      const slice = speechText.slice(0, TTS_MAX_CHARS);
      const lastStop = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
      speechText = (lastStop > 300 ? slice.slice(0, lastStop + 1) : slice).trim() + " …";
      toast.message("Reading a shortened version to fit voice limits.");
    }

    lastTextRef.current = text;
    setIsLoading(true);
    setIsPaused(false);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          text: speechText,
          voiceId: ALICE_VOICE_ID,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as any));
        const providerDetail = errorData?.provider_error?.detail;

        if (providerDetail?.status === "quota_exceeded") {
          throw new Error(providerDetail?.message || "Voice quota exceeded. Please shorten the text or top up credits.");
        }

        throw new Error(errorData?.error || `Failed to generate speech (${response.status})`);
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        throw new Error("No audio data received");
      }

      // Clean up previous audio URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        setIsPaused(false);
        toast.error("Audio playback failed");
      };

      setIsLoading(false);
      setIsSpeaking(true);

      try {
        await audioRef.current.play();
      } catch (playError: any) {
        console.error("Play error:", playError);
        if (playError.name === "NotAllowedError") {
          toast.error("Please click again to enable audio playback");
        } else {
          toast.error("Could not play audio");
        }
        setIsSpeaking(false);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      console.error("TTS error:", err);
      toast.error(err.message || "Failed to generate speech");
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && isSpeaking && !isPaused) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, isPaused]);

  const resume = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play().catch((err) => {
        console.error("Resume error:", err);
        toast.error("Could not resume audio");
      });
      setIsPaused(false);
    }
  }, [isPaused]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsLoading(false);
  }, []);

  const replay = useCallback(async () => {
    if (audioRef.current && audioUrlRef.current) {
      // Replay from the beginning using existing audio
      audioRef.current.currentTime = 0;
      setIsPaused(false);
      setIsSpeaking(true);
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error("Replay error:", err);
        toast.error("Could not replay audio");
        setIsSpeaking(false);
      }
    } else if (lastTextRef.current) {
      // Re-generate audio if not available
      await speak(lastTextRef.current);
    }
  }, [speak]);

  const toggle = useCallback(async (text: string) => {
    if (isSpeaking && !isPaused) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      await speak(text);
    }
  }, [isSpeaking, isPaused, pause, resume, speak]);

  return {
    speak,
    pause,
    resume,
    stop,
    replay,
    toggle,
    isSpeaking,
    isPaused,
    isLoading,
  };
}
