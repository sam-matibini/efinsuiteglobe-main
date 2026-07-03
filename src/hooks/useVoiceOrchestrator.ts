import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceWallet {
  id: string;
  organization_id: string;
  balance: number;
  currency: string;
  low_balance_threshold: number;
  auto_recharge_enabled: boolean;
}

interface CallSession {
  id: string;
  organization_id: string;
  source_number: string;
  destination_number: string;
  source_country_code: string;
  destination_country_code: string;
  call_status: string;
  initiated_at: string;
  ended_at: string | null;
  duration_seconds: number;
  billable_seconds: number;
  estimated_cost: number;
  final_cost: number | null;
  rate_applied: number;
  currency: string;
  recording_enabled: boolean;
}

interface VoiceRate {
  id: string;
  provider_id: string;
  country_code: string;
  rate_per_minute: number;
  billing_increment_seconds: number;
  currency: string;
  provider?: {
    code: string;
    name: string;
  };
}

interface VoiceProvider {
  id: string;
  code: string;
  name: string;
  provider_type: string;
  is_active: boolean;
  priority: number;
}

interface ProviderRoute {
  id: string;
  country_code: string;
  country_name: string;
  region: string;
  routing_strategy: string;
  primary_provider?: { code: string; name: string };
  secondary_provider?: { code: string; name: string };
  failover_provider?: { code: string; name: string };
}

interface InitiateCallResult {
  success: boolean;
  sessionId?: string;
  callSid?: string;
  estimatedCost?: number;
  ratePerMinute?: number;
  provider?: string;
  error?: string;
}

export function useVoiceOrchestrator() {
  const [loading, setLoading] = useState(false);
  const [initiatingCall, setInitiatingCall] = useState(false);
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [wallet, setWallet] = useState<VoiceWallet | null>(null);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [rates, setRates] = useState<VoiceRate[]>([]);
  const [providers, setProviders] = useState<VoiceProvider[]>([]);
  const [routes, setRoutes] = useState<ProviderRoute[]>([]);

  /**
   * Check orchestrator health
   */
  const checkHealth = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "health" },
      });
      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error("Health check error:", err);
      return null;
    }
  }, []);

  /**
   * Get voice wallet for organization
   */
  const getWallet = useCallback(async (organizationId: string): Promise<VoiceWallet | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "get-wallet", organizationId },
      });
      if (error) throw error;
      
      if (data.success && data.wallet) {
        setWallet(data.wallet);
        return data.wallet;
      }
      return null;
    } catch (err: any) {
      console.error("Get wallet error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get call history for organization
   */
  const getCallHistory = useCallback(async (organizationId: string, limit = 50): Promise<CallSession[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "get-call-history", organizationId, limit },
      });
      if (error) throw error;
      
      if (data.success) {
        setCallHistory(data.sessions || []);
        return data.sessions || [];
      }
      return [];
    } catch (err: any) {
      console.error("Get call history error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get call rates
   */
  const getRates = useCallback(async (countryCode?: string): Promise<VoiceRate[]> => {
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "get-rates", countryCode },
      });
      if (error) throw error;
      
      if (data.success) {
        setRates(data.rates || []);
        return data.rates || [];
      }
      return [];
    } catch (err: any) {
      console.error("Get rates error:", err);
      return [];
    }
  }, []);

  /**
   * Get providers
   */
  const getProviders = useCallback(async (): Promise<VoiceProvider[]> => {
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "get-providers" },
      });
      if (error) throw error;
      
      if (data.success) {
        setProviders(data.providers || []);
        return data.providers || [];
      }
      return [];
    } catch (err: any) {
      console.error("Get providers error:", err);
      return [];
    }
  }, []);

  /**
   * Get routing configuration
   */
  const getRoutes = useCallback(async (): Promise<ProviderRoute[]> => {
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: { action: "get-routing" },
      });
      if (error) throw error;
      
      if (data.success) {
        setRoutes(data.routes || []);
        return data.routes || [];
      }
      return [];
    } catch (err: any) {
      console.error("Get routes error:", err);
      return [];
    }
  }, []);

  /**
   * Initiate a hybrid PSTN-to-PSTN call
   */
  const initiateHybridCall = useCallback(async (
    organizationId: string,
    userId: string,
    sourceNumber: string,
    destinationNumber: string,
    enableRecording = false
  ): Promise<InitiateCallResult> => {
    setInitiatingCall(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
        body: {
          action: "initiate-hybrid-call",
          organizationId,
          userId,
          sourceNumber,
          destinationNumber,
          enableRecording,
        },
      });

      if (error) {
        console.error("Initiate call error:", error);
        toast.error("Failed to initiate call");
        return { success: false, error: error.message };
      }

      if (data.success) {
        toast.success(`Calling ${sourceNumber}...`);
        
        // Poll for session updates
        if (data.sessionId) {
          pollSessionStatus(data.sessionId);
        }
        
        return {
          success: true,
          sessionId: data.sessionId,
          callSid: data.callSid,
          estimatedCost: data.estimatedCost,
          ratePerMinute: data.ratePerMinute,
          provider: data.provider,
        };
      } else {
        toast.error(data.error || "Failed to initiate call");
        return { success: false, error: data.error };
      }
    } catch (err: any) {
      console.error("Initiate call exception:", err);
      toast.error("Failed to initiate call");
      return { success: false, error: err.message };
    } finally {
      setInitiatingCall(false);
    }
  }, []);

  /**
   * Poll session status
   */
  const pollSessionStatus = useCallback(async (sessionId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 1 minute max polling
    
    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log("Polling stopped - max attempts reached");
        return;
      }
      
      try {
        const { data, error } = await supabase.functions.invoke("voice-orchestrator", {
          body: { action: "get-session", sessionId },
        });

        if (error) {
          console.error("Session poll error:", error);
          return;
        }

        if (data.success && data.session) {
          setCurrentSession(data.session);
          
          // Check if call is still in progress
          const status = data.session.call_status;
          if (["completed", "failed", "cancelled", "no_answer", "busy"].includes(status)) {
            console.log("Call ended:", status);
            
            if (status === "completed") {
              toast.success(`Call completed. Duration: ${formatDuration(data.session.duration_seconds)}`);
            } else if (status === "failed") {
              toast.error(`Call failed: ${data.session.failure_reason || "Unknown error"}`);
            }
            return;
          }

          // Continue polling
          attempts++;
          setTimeout(poll, 1000);
        }
      } catch (err) {
        console.error("Poll exception:", err);
      }
    };

    poll();
  }, []);

  /**
   * Format duration in MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: number, currency = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  return {
    // State
    loading,
    initiatingCall,
    currentSession,
    wallet,
    callHistory,
    rates,
    providers,
    routes,
    
    // Actions
    checkHealth,
    getWallet,
    getCallHistory,
    getRates,
    getProviders,
    getRoutes,
    initiateHybridCall,
    
    // Utilities
    formatDuration,
    formatCurrency,
  };
}
