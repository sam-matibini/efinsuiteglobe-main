import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyTextToClipboard, tryOpenInNewTab, openWhatsAppShare, breakUrlForWhatsApp } from '../share';

describe('copyTextToClipboard', () => {
  it('uses navigator.clipboard.writeText when available', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const result = await copyTextToClipboard('hello');
    expect(result).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false when clipboard is unavailable and execCommand fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    document.execCommand = vi.fn().mockReturnValue(false);
    const result = await copyTextToClipboard('hello');
    expect(result).toBe(false);
  });
});

describe('tryOpenInNewTab', () => {
  it('returns true when window.open succeeds', () => {
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(tryOpenInNewTab('https://example.com')).toBe(true);
  });

  it('returns false when window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(tryOpenInNewTab('https://example.com')).toBe(false);
  });
});

describe('openWhatsAppShare', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Desktop Chrome', configurable: true });
  });

  it('opens protocol URL on desktop', async () => {
    vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const result = await openWhatsAppShare('Test message');
    expect(result.opened).toBe(true);
  });

  it('includes phone number in URL when provided', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await openWhatsAppShare('Hello', '+1234567890');
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('phone=1234567890'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('falls back to clipboard when window.open fails', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const result = await openWhatsAppShare('Test');
    expect(result.opened).toBe(false);
    expect(result.copied).toBe(true);
  });
});

describe('breakUrlForWhatsApp', () => {
  it('removes https:// protocol', () => {
    expect(breakUrlForWhatsApp('https://example.com/path')).toBe('example.com/path');
  });

  it('removes http:// protocol', () => {
    expect(breakUrlForWhatsApp('http://example.com')).toBe('example.com');
  });
});
