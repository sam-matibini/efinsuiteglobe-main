import { describe, expect, it } from 'vitest';
import { invoiceLogoObjectPath } from './invoiceLogoStorage';

describe('invoice logo storage path', () => {
  const organizationId = 'bbe4ce19-60a3-45b4-ad82-93e290554d3d';

  it('puts the organization id in the first folder so members can upload', () => {
    const path = invoiceLogoObjectPath(organizationId, 'brand.png', 1710000000000);
    expect(path).toBe(`${organizationId}/invoice-logos/logo-1710000000000.png`);
    expect(path.split('/')[0]).toBe(organizationId);
    expect(path.startsWith('invoice-logos/')).toBe(false);
  });

  it('keeps a safe extension when the file name has none', () => {
    expect(invoiceLogoObjectPath(organizationId, 'logo', 1)).toBe(`${organizationId}/invoice-logos/logo-1.png`);
  });
});
