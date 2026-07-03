import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
}

export function useVoiceRecording() {
  const { toast } = useToast();
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
  });
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob,
          audioUrl,
        }));

        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

      setState(prev => ({ ...prev, isRecording: true, duration: 0, audioBlob: null, audioUrl: null }));
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: 'destructive',
        title: 'Recording Failed',
        description: 'Could not access microphone. Please check permissions.',
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
    });
  }, [state.audioUrl]);

  const transcribeAudio = useCallback(async (): Promise<string | null> => {
    if (!state.audioBlob) {
      toast({
        variant: 'destructive',
        title: 'No Audio',
        description: 'Please record audio first.',
      });
      return null;
    }

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('action', 'transcribe');
      formData.append('audio', state.audioBlob, 'recording.webm');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Transcription failed');
      }

      return data.text;
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast({
        variant: 'destructive',
        title: 'Transcription Failed',
        description: error.message || 'Could not transcribe audio.',
      });
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [state.audioBlob, toast]);

  const sendVoiceToWhatsApp = useCallback(async (to: string, asText: boolean = false): Promise<boolean> => {
    if (!state.audioBlob) {
      toast({
        variant: 'destructive',
        title: 'No Audio',
        description: 'Please record audio first.',
      });
      return false;
    }

    setIsSending(true);
    try {
      if (asText) {
        // Transcribe and send as text
        const formData = new FormData();
        formData.append('action', 'transcribe-and-send');
        formData.append('to', to);
        formData.append('audio', state.audioBlob, 'recording.webm');

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
          {
            method: 'POST',
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          }
        );

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to send voice message');
        }

        toast({
          title: 'Voice Message Sent',
          description: `Transcribed and sent to WhatsApp: "${data.transcribedText.substring(0, 50)}..."`,
        });

        clearRecording();
        return true;
      } else {
        // Send as audio (requires pre-uploaded URL)
        toast({
          variant: 'destructive',
          title: 'Not Implemented',
          description: 'Direct audio sending requires storage upload. Use voice-to-text instead.',
        });
        return false;
      }
    } catch (error: any) {
      console.error('Send voice error:', error);
      toast({
        variant: 'destructive',
        title: 'Send Failed',
        description: error.message || 'Could not send voice message.',
      });
      return false;
    } finally {
      setIsSending(false);
    }
  }, [state.audioBlob, toast, clearRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    isTranscribing,
    isSending,
    startRecording,
    stopRecording,
    clearRecording,
    transcribeAudio,
    sendVoiceToWhatsApp,
  };
}
