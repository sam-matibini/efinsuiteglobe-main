import { useCallback, useEffect, useRef, useState } from "react";
import { getAliceFunctionHeaders } from "@/lib/aliceVoice";

function preferredMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export function useAliceDictation() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This browser cannot record audio.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = preferredMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (error) {
      releaseStream();
      throw error;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start(200);
    startedAtRef.current = Date.now();
    setDuration(0);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setIsRecording(false);
      return null;
    }
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.stop();
    });
    releaseStream();
    recorderRef.current = null;
    setIsRecording(false);
    return blob.size > 0 ? blob : null;
  }, []);

  const transcribe = useCallback(async (audio: Blob): Promise<string> => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("action", "transcribe");
      formData.append("language", "en");
      const extension = audio.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", audio, `alice.${extension}`);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`, {
        method: "POST",
        headers: await getAliceFunctionHeaders(false),
        body: formData,
      });
      const data = await response.json().catch(() => ({} as { success?: boolean; error?: string; text?: string }));
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Transcription failed (${response.status})`);
      }
      return (data.text || "").trim();
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  useEffect(() => () => {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    releaseStream();
  }, []);

  return { isRecording, isTranscribing, duration, start, stop, transcribe };
}
