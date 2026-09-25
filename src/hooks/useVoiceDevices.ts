import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Device, Call } from "@twilio/voice-sdk";

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput" | "videoinput";
}

export interface CallState {
  status: "idle" | "connecting" | "ringing" | "connected" | "ended" | "error";
  direction?: "inbound" | "outbound";
  remoteNumber?: string;
  duration: number;
  muted: boolean;
  speakerOn: boolean;
}

interface UseVoiceDevicesReturn {
  // Device states
  hasPermissions: boolean;
  micEnabled: boolean;
  speakerEnabled: boolean;
  cameraEnabled: boolean;
  
  // Available devices
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  
  // Selected devices
  selectedAudioInput: string;
  selectedAudioOutput: string;
  selectedVideoInput: string;
  
  // Call state
  callState: CallState;
  
  // Actions
  requestPermissions: () => Promise<boolean>;
  setSelectedAudioInput: (deviceId: string) => void;
  setSelectedAudioOutput: (deviceId: string) => void;
  setSelectedVideoInput: (deviceId: string) => void;
  toggleMic: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  
  // Call actions
  makeCall: (phoneNumber: string) => Promise<boolean>;
  endCall: () => void;
  answerCall: () => void;
  rejectCall: () => void;
  
  // Audio visualization
  audioLevel: number;
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  isDeviceReady: boolean;
  
  // Incoming call
  incomingCall: Call | null;
}

export function useVoiceDevices(): UseVoiceDevicesReturn {
  const [hasPermissions, setHasPermissions] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("");
  const [selectedVideoInput, setSelectedVideoInput] = useState("");
  
  const [audioLevel, setAudioLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  
  const [callState, setCallState] = useState<CallState>({
    status: "idle",
    duration: 0,
    muted: false,
    speakerOn: true,
  });
  
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate a unique identity for this browser client
  const getClientIdentity = useCallback(() => {
    let identity = localStorage.getItem("twilio-voice-identity");
    if (!identity) {
      identity = `browser-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      localStorage.setItem("twilio-voice-identity", identity);
    }
    return identity;
  }, []);

  // Initialize Twilio Device
  const initializeTwilioDevice = useCallback(async () => {
    try {
      const identity = getClientIdentity();
      
      // Get access token from edge function
      const { data, error } = await supabase.functions.invoke("twilio-voice-token", {
        body: { action: "get-token", identity },
      });

      if (error || !data?.success) {
        console.error("Failed to get voice token:", error || data?.error);
        return false;
      }

      // Create and configure the Twilio Device
      const device = new Device(data.token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        allowIncomingWhileBusy: false,
      });

      // Set up device event handlers
      device.on("registered", () => {
        console.log("Twilio Device registered for calls");
        setIsDeviceReady(true);
      });

      device.on("unregistered", () => {
        console.log("Twilio Device unregistered");
        setIsDeviceReady(false);
      });

      device.on("error", (err) => {
        console.error("Twilio Device error:", err);
        toast.error(`Voice error: ${err.message}`);
        setCallState((prev) => ({ ...prev, status: "error" }));
      });

      device.on("incoming", (call: Call) => {
        console.log("Incoming call from:", call.parameters.From);
        setIncomingCall(call);
        setCallState({
          status: "ringing",
          direction: "inbound",
          remoteNumber: call.parameters.From || "Unknown",
          duration: 0,
          muted: false,
          speakerOn: true,
        });
        
        toast.info(`Incoming call from ${call.parameters.From || "Unknown"}`);
        
        // Set up call event handlers for incoming
        setupCallEventHandlers(call);
      });

      device.on("tokenWillExpire", async () => {
        console.log("Token expiring, refreshing...");
        const { data: refreshData } = await supabase.functions.invoke("twilio-voice-token", {
          body: { action: "get-token", identity },
        });
        if (refreshData?.success && refreshData.token) {
          device.updateToken(refreshData.token);
        }
      });

      // Register the device to receive calls
      await device.register();
      
      deviceRef.current = device;
      return true;
    } catch (err) {
      console.error("Error initializing Twilio Device:", err);
      return false;
    }
  }, [getClientIdentity]);

  // Set up call event handlers
  const setupCallEventHandlers = useCallback((call: Call) => {
    activeCallRef.current = call;

    call.on("accept", () => {
      console.log("Call accepted/connected");
      setCallState((prev) => ({
        ...prev,
        status: "connected",
      }));
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setCallState((p) => ({ ...p, duration: p.duration + 1 }));
      }, 1000);
    });

    call.on("ringing", () => {
      console.log("Call ringing");
      setCallState((prev) => ({ ...prev, status: "ringing" }));
    });

    call.on("disconnect", () => {
      console.log("Call disconnected");
      cleanupCall();
      toast.info("Call ended");
    });

    call.on("cancel", () => {
      console.log("Call cancelled");
      cleanupCall();
    });

    call.on("reject", () => {
      console.log("Call rejected");
      cleanupCall();
    });

    call.on("error", (err) => {
      console.error("Call error:", err);
      toast.error(`Call error: ${err.message}`);
      setCallState((prev) => ({ ...prev, status: "error" }));
    });

    // Monitor audio levels
    call.on("volume", (inputVolume: number) => {
      setAudioLevel(inputVolume);
    });
  }, []);

  // Clean up after call ends
  const cleanupCall = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    activeCallRef.current = null;
    setIncomingCall(null);
    setAudioLevel(0);
    
    setCallState({
      status: "ended",
      duration: 0,
      muted: false,
      speakerOn: true,
    });
    
    // Reset to idle after a moment
    setTimeout(() => {
      setCallState({
        status: "idle",
        duration: 0,
        muted: false,
        speakerOn: true,
      });
    }, 2000);
  }, []);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const audioInputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: "audioinput" as const,
        }));
      
      const audioOutputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: "audiooutput" as const,
        }));
      
      const videoInputs = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: "videoinput" as const,
        }));
      
      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoInputDevices(videoInputs);
      
      // Set defaults if not already set
      if (!selectedAudioInput && audioInputs.length > 0) {
        setSelectedAudioInput(audioInputs[0].deviceId);
      }
      if (!selectedAudioOutput && audioOutputs.length > 0) {
        setSelectedAudioOutput(audioOutputs[0].deviceId);
      }
      if (!selectedVideoInput && videoInputs.length > 0) {
        setSelectedVideoInput(videoInputs[0].deviceId);
      }
      
      setIsInitialized(true);
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedAudioInput, selectedAudioOutput, selectedVideoInput]);

  // Request permissions and initialize Twilio
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        video: cameraEnabled ? (selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true) : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      // Set up audio analysis for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Start audio level monitoring for preview
      const updateAudioLevel = () => {
        if (analyserRef.current && callState.status === "idle") {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();
      
      setHasPermissions(true);
      setMicEnabled(true);
      await enumerateDevices();
      
      // Initialize Twilio Device for WebRTC calls
      const deviceInitialized = await initializeTwilioDevice();
      if (deviceInitialized) {
        toast.success("Voice calling ready");
      } else {
        toast.warning("Voice enabled but WebRTC not configured");
      }
      
      return true;
    } catch (err) {
      console.error("Permission request error:", err);
      toast.error("Could not access microphone. Please check permissions.");
      setHasPermissions(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedAudioInput, selectedVideoInput, cameraEnabled, enumerateDevices, initializeTwilioDevice, callState.status]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (activeCallRef.current) {
      const isMuted = activeCallRef.current.isMuted();
      activeCallRef.current.mute(!isMuted);
      setMicEnabled(isMuted);
      setCallState((prev) => ({ ...prev, muted: !isMuted }));
    } else if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicEnabled(audioTracks[0]?.enabled ?? false);
    }
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setSpeakerEnabled((prev) => !prev);
    setCallState((prev) => ({ ...prev, speakerOn: !prev.speakerOn }));
    
    // Note: Actual speaker control is limited in browsers
    // This primarily affects UI state
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((track) => track.stop());
      }
      setCameraEnabled(false);
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
        });
        if (localStreamRef.current) {
          videoStream.getVideoTracks().forEach((track) => {
            localStreamRef.current?.addTrack(track);
          });
        }
        setCameraEnabled(true);
        toast.success("Camera enabled");
      } catch (err) {
        console.error("Camera access error:", err);
        toast.error("Could not access camera");
      }
    }
  }, [cameraEnabled, selectedVideoInput]);

  // Make a call using Twilio Voice SDK
  const makeCall = useCallback(async (phoneNumber: string): Promise<boolean> => {
    // Ensure permissions and device are ready
    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) return false;
    }

    if (!deviceRef.current) {
      // Try to initialize if not ready
      const initialized = await initializeTwilioDevice();
      if (!initialized) {
        toast.error("Voice device not ready. Please try again.");
        return false;
      }
    }

    setCallState({
      status: "connecting",
      direction: "outbound",
      remoteNumber: phoneNumber,
      duration: 0,
      muted: false,
      speakerOn: true,
    });

    try {
      // Make the call through Twilio Voice SDK
      const call = await deviceRef.current!.connect({
        params: {
          To: phoneNumber,
        },
      });

      // Set up event handlers
      setupCallEventHandlers(call);

      toast.success("Connecting call...");
      return true;
    } catch (err) {
      console.error("Make call error:", err);
      toast.error("Failed to make call");
      setCallState((prev) => ({ ...prev, status: "error" }));
      return false;
    }
  }, [hasPermissions, requestPermissions, initializeTwilioDevice, setupCallEventHandlers]);

  // Answer incoming call
  const answerCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.accept();
      setIncomingCall(null);
    }
  }, [incomingCall]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.reject();
      setIncomingCall(null);
      cleanupCall();
    }
  }, [incomingCall, cleanupCall]);

  // End call
  const endCall = useCallback(() => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
    cleanupCall();
  }, [cleanupCall]);

  // Initialize on mount
  useEffect(() => {
    enumerateDevices();
    
    // Listen for device changes
    const handleDeviceChange = () => enumerateDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      
      // Cleanup on unmount
      if (deviceRef.current) {
        deviceRef.current.unregister();
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [enumerateDevices]);

  return {
    hasPermissions,
    micEnabled,
    speakerEnabled,
    cameraEnabled,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    callState,
    requestPermissions,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
    toggleMic,
    toggleSpeaker,
    toggleCamera,
    makeCall,
    endCall,
    answerCall,
    rejectCall,
    audioLevel,
    isLoading,
    isInitialized,
    isDeviceReady,
    incomingCall,
  };
}
