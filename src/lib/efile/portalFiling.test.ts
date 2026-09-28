import { describe, expect, it } from 'vitest';
import { buildCraGstHstPacket } from './craPacket';
import { authorityConfirmation, isDirectEfile } from './portalFiling';
import type { FilingFormResult } from '@/lib/filings/types';

const form: FilingFormResult = {
  formCode: 'GST34',
  formName: 'GST/HST Return (GST34)',
  authority: 'Canada GST',
  periodStart: '2026-07-01',
  periodEnd: '2026-07-31',
  currency: 'CAD',
  lines: [
    { code: '101', label: 'Sales', amount: 1000, category: 'sales' },
    { code: '103', label: 'Collected', amount: 130, category: 'tax_collected' },
    { code: '106', label: 'ITCs', amount: 40, category: 'itc' },
  ],
  netPayable: 368.76,
};

describe('CRA GST/HST packet', () => {
  it('prepares a portal packet and does not send a Web Access Code', () => {
    const packet = buildCraGstHstPacket(form, {
      businessNumber: '123456789RT0001',
      webAccessCode: 'SECRET-WAC',
    });
    expect(isDirectEfile(packet)).toBe(false);
    expect(packet.channel).toBe('cra_packet');
    expect(packet.portalUrl).toMatch(/^https:\/\/www\.canada\.ca\//);
    expect(packet.contents).toContain('368.76');
    expect(packet.contents).not.toContain('SECRET-WAC');
    expect(packet.contents).not.toContain('WebAccessCode');
  });

  it('accepts a CRA confirmation and refuses a placeholder', () => {
    expect(authorityConfirmation('RC-482193')).toBe('RC-482193');
    expect(authorityConfirmation('ok')).toBeNull();
    expect(authorityConfirmation('')).toBeNull();
  });
});
