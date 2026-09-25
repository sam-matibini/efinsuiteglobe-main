import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
}

interface Recording {
  sid: string;
  call_sid: string;
  date_created: string;
  duration: string;
  uri: string;
}

interface HealthStatus {
  success: boolean;
  configured: boolean;
  elevenLabsEnabled: boolean;
  brand: string;
}

export function useTwilioVoice() {
  const [calling, setCalling] = useState(false);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [generatingTts, setGeneratingTts] = useState(false);

  /**
   * Initiate an outbound call (Click-to-Call)
   */
  const initiateCall = async (to: string): Promise<CallResult> => {
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-voice", {
        body: { action: "initiate-call", to },
      });

      if (error) {
        console.error("Call initiation error:", error);
        toast.error("Failed to initiate call");
        return { success: false, error: error.message };
      }

      if (data.success) {
        toast.success("Call initiated successfully");
        return { success: true, callSid: data.callSid, status: data.status };
      } else {
        toast.error(data.error || "Failed to initiate call");
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      console.error("Call error:", err);
      toast.error("Failed to initiate call");
      return { success: false, error: err.message };
    } finally {
      setCalling(false);
    }
  };

  /**
   * Get voicemail recordings
   */
  const getRecordings = async (): Promise<Recording[]> => {
    setLoadingRecordings(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-voice", {
        body: { action: "get-recordings" },
      });

      if (error) {
        console.error("Recordings fetch error:", error);
        toast.error("Failed to fetch recordings");
        return [];
      }

      if (data.success) {
        return data.recordings || [];
      } else {
        toast.error(data.error || "Failed to fetch recordings");
        return [];
      }
    } catch (err: any) {
      console.error("Recordings error:", err);
      toast.error("Failed to fetch recordings");
      return [];
    } finally {
      setLoadingRecordings(false);
    }
  };

  /**
   * Get recording audio URL via proxy (avoids browser auth popup)
   */
  const getRecordingAudioUrl = (recordingSid: string): string => {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice?action=get-recording-audio&recordingSid=${recordingSid}`;
  };

  /**
   * Fetch recording audio as blob
   */
  const fetchRecordingAudio = async (recordingSid: string): Promise<Blob | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "get-recording-audio", recordingSid }),
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch recording audio:", response.status);
        return null;
      }

      return await response.blob();
    } catch (err) {
      console.error("Error fetching recording audio:", err);
      return null;
    }
  };

  /**
   * Generate text-to-speech audio using ElevenLabs
   */
  const generateTts = async (text: string, voiceId?: string): Promise<Blob | null> => {
    setGeneratingTts(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "tts", text, voiceId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("TTS generation error:", errorData);
        toast.error(errorData.error || "Failed to generate speech");
        return null;
      }

      const audioBlob = await response.blob();
      return audioBlob;
    } catch (err: any) {
      console.error("TTS error:", err);
      toast.error("Failed to generate speech");
      return null;
    } finally {
      setGeneratingTts(false);
    }
  };

  /**
   * Play text-to-speech audio
   */
  const playTts = async (text: string, voiceId?: string): Promise<void> => {
    const audioBlob = await generateTts(text, voiceId);
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
    }
  };

  /**
   * Check voice service health
   */
  const checkHealth = async (): Promise<HealthStatus | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("twilio-voice", {
        body: { action: "health-check" },
      });

      if (error) return null;
      return data as HealthStatus;
    } catch {
      return null;
    }
  };

  /**
   * Get the webhook URL for configuring Twilio
   */
  const getWebhookUrl = (): string => {
    return `https://boskmqywofwekszhgryb.supabase.co/functions/v1/twilio-voice?action=handle-inbound`;
  };

  return {
    initiateCall,
    getRecordings,
    getRecordingAudioUrl,
    fetchRecordingAudio,
    generateTts,
    playTts,
    checkHealth,
    getWebhookUrl,
    calling,
    loadingRecordings,
    generatingTts,
  };
}
