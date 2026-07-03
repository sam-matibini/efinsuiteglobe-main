import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type OtpPurpose = 'signing' | 'banking_mfa' | 'login' | 'verification';

interface SendOtpResult {
  success: boolean;
  message?: string;
  expiresAt?: string;
  error?: string;
}

interface VerifyOtpResult {
  success: boolean;
  message?: string;
  referenceId?: string;
  error?: string;
  attemptsRemaining?: number;
}

export function useTwilioOtp() {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendOtp = async (
    phoneNumber: string,
    purpose: OtpPurpose,
    email?: string,
    referenceId?: string
  ): Promise<SendOtpResult> => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { action: 'send', phoneNumber, purpose, email, referenceId }
      });

      if (error) {
        console.error('Twilio OTP error:', error);
        const errorMsg = error.message || 'Failed to send verification code';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (data?.error) {
        console.error('Twilio OTP data error:', data);
        const errorMsg = data.details || data.error || 'Failed to send verification code';
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Verification code sent to your phone');
      return { 
        success: true, 
        message: data.message,
        expiresAt: data.expiresAt 
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send OTP';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async (
    phoneNumber: string,
    code: string,
    purpose: OtpPurpose
  ): Promise<VerifyOtpResult> => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { action: 'verify', phoneNumber, code, purpose }
      });

      if (error) {
        toast.error('Verification failed');
        return { success: false, error: error.message };
      }

      if (data.error) {
        if (data.attemptsRemaining !== undefined) {
          toast.error(`${data.error}. ${data.attemptsRemaining} attempts remaining.`);
        } else {
          toast.error(data.error);
        }
        return { 
          success: false, 
          error: data.error,
          attemptsRemaining: data.attemptsRemaining
        };
      }

      toast.success('Verification successful');
      return { 
        success: true, 
        message: data.message,
        referenceId: data.referenceId
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setVerifying(false);
    }
  };

  return {
    sendOtp,
    verifyOtp,
    sending,
    verifying,
  };
}
