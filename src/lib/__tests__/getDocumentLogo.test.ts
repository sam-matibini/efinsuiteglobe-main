import { describe, it, expect } from 'vitest';
import { getDocumentLogoUrl } from '../getDocumentLogo';
import type { Organization } from '@/hooks/useOrganization';

const baseOrg = {
  logo_url: 'https://example.com/main-logo.png',
  invoice_show_logo: true,
  invoice_logo_url: null,
  receipt_show_logo: true,
  receipt_logo_url: null,
  payroll_show_logo: true,
  payroll_logo_url: null,
  statement_show_logo: true,
  statement_logo_url: null,
} as unknown as Organization;

describe('getDocumentLogoUrl', () => {
  it('returns null when organization is null', () => {
    expect(getDocumentLogoUrl(null, 'invoice')).toBeNull();
  });

  it('returns null when organization is undefined', () => {
    expect(getDocumentLogoUrl(undefined, 'invoice')).toBeNull();
  });

  // Invoice
  it('invoice: returns null when invoice_show_logo is false', () => {
    expect(getDocumentLogoUrl({ ...baseOrg, invoice_show_logo: false } as any, 'invoice')).toBeNull();
  });

  it('invoice: returns override URL when invoice_logo_url is set', () => {
    const org = { ...baseOrg, invoice_logo_url: 'https://example.com/invoice-logo.png' } as any;
    expect(getDocumentLogoUrl(org, 'invoice')).toBe('https://example.com/invoice-logo.png');
  });

  it('invoice: falls back to logo_url when no override', () => {
    expect(getDocumentLogoUrl(baseOrg, 'invoice')).toBe('https://example.com/main-logo.png');
  });

  // Receipt
  it('receipt: returns null when receipt_show_logo is false', () => {
    expect(getDocumentLogoUrl({ ...baseOrg, receipt_show_logo: false } as any, 'receipt')).toBeNull();
  });

  it('receipt: returns override URL when set', () => {
    const org = { ...baseOrg, receipt_logo_url: 'https://example.com/receipt-logo.png' } as any;
    expect(getDocumentLogoUrl(org, 'receipt')).toBe('https://example.com/receipt-logo.png');
  });

  it('receipt: falls back to logo_url', () => {
    expect(getDocumentLogoUrl(baseOrg, 'receipt')).toBe('https://example.com/main-logo.png');
  });

  // Payroll
  it('payroll: returns null when payroll_show_logo is false', () => {
    expect(getDocumentLogoUrl({ ...baseOrg, payroll_show_logo: false } as any, 'payroll')).toBeNull();
  });

  it('payroll: falls back to logo_url', () => {
    expect(getDocumentLogoUrl(baseOrg, 'payroll')).toBe('https://example.com/main-logo.png');
  });

  // Statement
  it('statement: returns null when statement_show_logo is false', () => {
    expect(getDocumentLogoUrl({ ...baseOrg, statement_show_logo: false } as any, 'statement')).toBeNull();
  });

  it('statement: falls back to logo_url', () => {
    expect(getDocumentLogoUrl(baseOrg, 'statement')).toBe('https://example.com/main-logo.png');
  });

  // Edge cases
  it('returns null when all logo fields are empty', () => {
    const org = { ...baseOrg, logo_url: null } as any;
    expect(getDocumentLogoUrl(org, 'invoice')).toBeNull();
  });

  it('unknown document type falls back to logo_url', () => {
    expect(getDocumentLogoUrl(baseOrg, 'unknown' as any)).toBe('https://example.com/main-logo.png');
  });
});
