export async function copyTextToClipboard(text: string): Promise<boolean> {
  // Prefer modern Clipboard API
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for environments where clipboard permissions are denied
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function tryOpenInNewTab(url: string): boolean {
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return !!w;
}

/**
 * Opens WhatsApp with a pre-filled message.
 * Uses the whatsapp:// protocol to avoid api.whatsapp.com being blocked.
 * Falls back to copying the message to clipboard if WhatsApp can't be opened.
 */
export async function openWhatsAppShare(message: string, to?: string): Promise<{ opened: boolean; copied: boolean }> {
  const encodedMessage = encodeURIComponent(message);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Clean phone number if provided
  const cleanPhone = to
    ? to.replace(/[^\d+]/g, '').replace(/^\+/, '')
    : undefined;

  // Build protocol URL (avoids blocked api.whatsapp.com domain)
  const protocolUrl = cleanPhone
    ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`
    : `whatsapp://send?text=${encodedMessage}`;

  // Mobile: navigate directly to the protocol handler
  if (isMobile) {
    window.location.href = protocolUrl;
    return { opened: true, copied: false };
  }

  // Desktop: try opening the protocol handler in a new tab/window
  const opened = tryOpenInNewTab(protocolUrl);
  if (opened) {
    return { opened: true, copied: false };
  }

  // Fallback: copy to clipboard
  const copied = await copyTextToClipboard(message);
  return { opened: false, copied };
}

/**
 * Breaks a URL to prevent WhatsApp from generating a link preview (dark banner).
 * Removes the protocol (https://) so WhatsApp doesn't recognize it as a clickable link.
 */
export function breakUrlForWhatsApp(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
