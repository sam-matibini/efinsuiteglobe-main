import { describe, expect, it } from 'vitest';
import { COMMUNICATION_NAV, navHrefMatches } from './hubNav';

describe('communication hub navigation', () => {
  it('keeps the AI receptionist inside the communication tabs', () => {
    expect(COMMUNICATION_NAV.map((item) => item.label)).toEqual([
      'Compose',
      'Inbox',
      'Contacts',
      'Voice',
      'Branding',
      'AI Receptionist',
    ]);
    expect(COMMUNICATION_NAV.find((item) => item.label === 'AI Receptionist')?.href).toBe('/communication?tab=receptionist');
  });

  it('matches a tab query without highlighting the other hub tabs', () => {
    expect(navHrefMatches('/communication?tab=receptionist', '/communication', '?tab=receptionist')).toBe(true);
    expect(navHrefMatches('/communication', '/communication', '?tab=receptionist')).toBe(false);
    expect(navHrefMatches('/communication?tab=inbox', '/communication', '?tab=receptionist')).toBe(false);
    expect(navHrefMatches('/communication', '/communication', '')).toBe(true);
    expect(navHrefMatches('/communication', '/communication', '?tab=compose')).toBe(true);
    expect(navHrefMatches('/sales/invoices', '/sales/invoices', '')).toBe(true);
    expect(navHrefMatches('/sales/invoices', '/sales/customers', '')).toBe(false);
  });
});
