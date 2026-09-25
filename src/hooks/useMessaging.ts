import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MessageChannel = "sms" | "whatsapp" | "email";
export type EmailProvider = "sendgrid" | "mailchimp";

interface BrandingData {
  logoUrl?: string;
  displayName?: string;
  signatureHtml?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

interface SendMessageOptions {
  channel: MessageChannel;
  to: string; // E.164 phone for SMS/WhatsApp, email address for email
  message: string;
  subject?: string; // Used for email
  html?: string; // Used for email (optional, falls back to message)
  mediaUrls?: string[]; // Used for SMS MMS attachments (publicly accessible URLs)
  emailProvider?: EmailProvider; // Which email provider to use (defaults to sendgrid)
  tags?: string[]; // Used for Mailchimp email tagging
  attachments?: Array<{ url?: string; content?: string; filename?: string; mimeType?: string }>; // Email attachments
  branding?: BrandingData; // Branding data for emails
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Unified messaging hook for sending SMS, WhatsApp, and Email messages
 * via Twilio (SMS/WhatsApp) and SendGrid (Email) edge functions.
 */
export function useMessaging() {
  /**
   * Send SMS via Twilio (supports MMS with media attachments)
   */
  const sendSMS = async (to: string, message: string, mediaUrls?: string[]): Promise<SendResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("twilio-send-message", {
        body: { action: "send", channel: "sms", to, message, mediaUrls },
      });

      if (error) {
        console.error("SMS send error:", error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || "SMS send failed" };
      }

      return { success: true, messageId: data.sid };
    } catch (err: any) {
      console.error("SMS exception:", err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Send WhatsApp message via Twilio
   * @param sendLogoFirst - If true, sends brand logo image before the text message
   */
  const sendWhatsApp = async (to: string, message: string, sendLogoFirst: boolean = true, mediaUrls?: string[]): Promise<SendResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("twilio-send-message", {
        body: { action: "send", channel: "whatsapp", to, message, sendLogoFirst, mediaUrls },
      });

      if (error) {
        console.error("WhatsApp send error:", error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || "WhatsApp send failed" };
      }

      return { 
        success: true, 
        messageId: data.sid,
      };
    } catch (err: any) {
      console.error("WhatsApp exception:", err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Send Email via SendGrid (with optional attachments and branding)
   */
  const sendEmailViaSendGrid = async (
    to: string,
    subject: string,
    message: string,
    html?: string,
    attachments?: Array<{ url?: string; content?: string; filename?: string; mimeType?: string }>,
    branding?: BrandingData
  ): Promise<SendResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("resend-integration", {
        body: {
          action: "send-email",
          to,
          subject,
          message,
          html: html || `<p>${message.replace(/\n/g, "<br>")}</p>`,
          attachments,
          branding,
        },
      });

      if (error) {
        console.error("SendGrid email error:", error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || "Email send failed" };
      }

      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      console.error("SendGrid exception:", err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Send Email via Mailchimp Transactional (Mandrill)
   */
  const sendEmailViaMailchimp = async (
    to: string,
    subject: string,
    message: string,
    html?: string,
    tags?: string[]
  ): Promise<SendResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("mailchimp-transactional", {
        body: {
          action: "send-email",
          to,
          subject,
          message,
          html: html || `<p>${message.replace(/\n/g, "<br>")}</p>`,
          tags: tags || [],
        },
      });

      if (error) {
        console.error("Mailchimp email error:", error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || "Email send failed" };
      }

      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      console.error("Mailchimp exception:", err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Send Email (defaults to SendGrid, supports Mailchimp)
   */
  const sendEmail = async (
    to: string,
    subject: string,
    message: string,
    html?: string,
    provider: EmailProvider = "sendgrid",
    tags?: string[],
    attachments?: Array<{ url?: string; content?: string; filename?: string; mimeType?: string }>,
    branding?: BrandingData
  ): Promise<SendResult> => {
    if (provider === "mailchimp") {
      return sendEmailViaMailchimp(to, subject, message, html, tags);
    }
    return sendEmailViaSendGrid(to, subject, message, html, attachments, branding);
  };

  /**
   * Unified send method
   */
  const sendMessage = async (options: SendMessageOptions): Promise<SendResult> => {
    const { channel, to, message, subject, html, mediaUrls, emailProvider = "sendgrid", tags, attachments, branding } = options;

    switch (channel) {
      case "sms":
        return sendSMS(to, message, mediaUrls);
      case "whatsapp":
        return sendWhatsApp(to, message, true, mediaUrls);
      case "email":
        return sendEmail(to, subject || "Notification", message, html, emailProvider, tags, attachments, branding);
      default:
        return { success: false, error: "Invalid channel" };
    }
  };

  /**
   * Send document signing request to a signer
   */
  const sendDocumentSigningRequest = async (
    signer: {
      email: string;
      name?: string | null;
      phone_number?: string | null;
      auth_method: "email" | "sms" | "in_app" | "id_verification";
    },
    document: {
      id: string;
      title: string;
    },
    signingUrl: string
  ): Promise<SendResult[]> => {
    const results: SendResult[] = [];
    const signerName = signer.name || "Signer";

    // Build message content
    const textMessage = `Hi ${signerName},\n\nYou have been requested to sign "${document.title}".\n\nPlease click the link below to review and sign:\n${signingUrl}\n\nPowered by eFinsuite Globe`;

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Document Signing Request</h2>
        <p>Hi ${signerName},</p>
        <p>You have been requested to sign <strong>"${document.title}"</strong>.</p>
        <p>
          <a href="${signingUrl}" 
             style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Review &amp; Sign Document
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link: ${signingUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">Powered by eFinsuite Globe</p>
      </div>
    `;

    // Always send email
    const emailResult = await sendEmail(
      signer.email,
      `Action Required: Please sign "${document.title}"`,
      textMessage,
      htmlMessage
    );
    results.push({ ...emailResult, messageId: `email:${emailResult.messageId}` });

    // Send SMS if phone number available and auth_method is sms
    if (signer.phone_number && signer.auth_method === "sms") {
      const smsResult = await sendSMS(
        signer.phone_number,
        `eFinsuite: You've been requested to sign "${document.title}". Check your email for the signing link.`
      );
      results.push({ ...smsResult, messageId: `sms:${smsResult.messageId}` });
    }

    return results;
  };

  /**
   * Send reminder for pending signature
   */
  const sendSigningReminder = async (
    signer: {
      email: string;
      name?: string | null;
      phone_number?: string | null;
    },
    document: {
      id: string;
      title: string;
    },
    signingUrl: string,
    channel: MessageChannel = "email"
  ): Promise<SendResult> => {
    const signerName = signer.name || "Signer";
    const reminderText = `Hi ${signerName}, reminder: "${document.title}" is still awaiting your signature. Please sign at: ${signingUrl}`;

    if (channel === "email") {
      return sendEmail(
        signer.email,
        `Reminder: Please sign "${document.title}"`,
        reminderText,
        `<p>Hi ${signerName},</p>
         <p>This is a friendly reminder that <strong>"${document.title}"</strong> is still awaiting your signature.</p>
         <p><a href="${signingUrl}" style="color: #1e40af;">Click here to sign now</a></p>
         <p style="color: #999; font-size: 12px;">Powered by eFinsuite Globe</p>`
      );
    } else if (channel === "sms" && signer.phone_number) {
      return sendSMS(signer.phone_number, reminderText);
    } else if (channel === "whatsapp" && signer.phone_number) {
      return sendWhatsApp(signer.phone_number, reminderText);
    }

    return { success: false, error: "No valid contact method for reminder" };
  };

  /**
   * Check if messaging services are configured
   */
  const checkConfiguration = async (): Promise<{
    twilio: boolean;
    sendgrid: boolean;
    mailchimp: boolean;
  }> => {
    const [twilioCheck, sendgridCheck, mailchimpCheck] = await Promise.all([
      supabase.functions.invoke("twilio-send-message", {
        body: { action: "health-check" },
      }),
      supabase.functions.invoke("resend-integration", {
        body: { action: "health-check" },
      }),
      supabase.functions.invoke("mailchimp-transactional", {
        body: { action: "health-check" },
      }),
    ]);

    return {
      twilio: twilioCheck.data?.configured === true,
      sendgrid: sendgridCheck.data?.configured === true,
      mailchimp: mailchimpCheck.data?.configured === true,
    };
  };

  return {
    sendSMS,
    sendWhatsApp,
    sendEmail,
    sendEmailViaSendGrid,
    sendEmailViaMailchimp,
    sendMessage,
    sendDocumentSigningRequest,
    sendSigningReminder,
    checkConfiguration,
  };
}
