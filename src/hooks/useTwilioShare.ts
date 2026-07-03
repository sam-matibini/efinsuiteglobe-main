import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { copyTextToClipboard, openWhatsAppShare } from "@/lib/share";

type Channel = "sms" | "whatsapp";

interface UseTwilioShareOptions {
  /** Fallback behavior if backend send fails or user prefers app */
  fallbackToApp?: boolean;
}

/**
 * Provides shareSMS and shareWhatsApp that try Twilio first,
 * then fall back to opening the native app / clipboard.
 */
export function useTwilioShare(options: UseTwilioShareOptions = {}) {
  const { fallbackToApp = true } = options;

  /**
   * Attempt to send via edge function. Returns true on success.
   */
  const sendViaBackend = async (
    channel: Channel,
    to: string,
    message: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("twilio-send-message", {
        body: { action: "send", channel, to, message },
      });

      if (error || !data?.success) {
        console.warn(`Twilio ${channel} failed:`, error?.message || data?.error);
        return false;
      }

      return true;
    } catch (err) {
      console.error("Twilio invoke error:", err);
      return false;
    }
  };

  /**
   * Open the native SMS app as fallback.
   */
  const openSmsApp = (message: string, to?: string) => {
    const body = encodeURIComponent(message);
    window.location.href = to ? `sms:${to}?body=${body}` : `sms:?body=${body}`;
  };

  /**
   * Open WhatsApp as fallback using the shared helper.
   * Uses whatsapp:// protocol to avoid blocked api.whatsapp.com domain.
   */
  const openWhatsAppApp = async (message: string, to?: string) => {
    const { opened, copied } = await openWhatsAppShare(message, to);
    if (!opened) {
      toast.info(
        copied
          ? "Message copied — paste it into WhatsApp."
          : "Couldn't open WhatsApp automatically."
      );
    }
  };

  /**
   * Share via SMS. Tries Twilio, then fallback to native app.
   */
  const shareSMS = async (to: string, message: string) => {
    // Attempt backend
    const sent = await sendViaBackend("sms", to, message);
    if (sent) {
      toast.success("SMS sent successfully");
      return;
    }

    // Fallback
    if (fallbackToApp) {
      openSmsApp(message, to);
      toast.info("Opening SMS app...");
    } else {
      toast.error("Failed to send SMS");
    }
  };

  /**
   * Share via WhatsApp. Tries Twilio, then fallback to whatsapp:// or web.whatsapp.com.
   */
  const shareWhatsApp = async (to: string, message: string) => {
    const sent = await sendViaBackend("whatsapp", to, message);
    if (sent) {
      toast.success("WhatsApp message sent");
      return;
    }

    // Fallback
    if (fallbackToApp) {
      await openWhatsAppApp(message, to);
      toast.info("Opening WhatsApp...");
    } else {
      toast.error("Failed to send WhatsApp message");
    }
  };

  /**
   * Share via WhatsApp without needing a recipient (opens whatsapp for user to pick).
   */
  const shareWhatsAppNoRecipient = async (message: string) => {
    await openWhatsAppApp(message);
  };

  /**
   * Share via SMS without needing a recipient (opens sms: for user to pick).
   */
  const shareSMSNoRecipient = async (message: string) => {
    openSmsApp(message);
    const copied = await copyTextToClipboard(message);
    if (copied) toast.info("Message also copied to clipboard");
  };

  return {
    shareSMS,
    shareWhatsApp,
    shareWhatsAppNoRecipient,
    shareSMSNoRecipient,
  };
}
