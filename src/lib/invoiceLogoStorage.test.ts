import { describe, expect, it } from 'vitest';
import { invoiceLogoObjectPath, logoObjectPathFromPublicUrl, organizationLogoObjectPath } from './invoiceLogoStorage';
import { logoDrawSize, logoFileAllowed, logoNeedsNormalize, logoUploadErrorMessage } from './logoUpload';

describe('invoice logo storage path', () => {
  const organizationId = 'bbe4ce19-60a3-45b4-ad82-93e290554d3d';

  it('puts the organization id in the first folder so members can upload', () => {
    const path = invoiceLogoObjectPath(organizationId, 'brand.png', 1710000000000);
    expect(path).toBe(`${organizationId}/invoice-logo-1710000000000.png`);
    expect(path.split('/')).toEqual([organizationId, 'invoice-logo-1710000000000.png']);
    expect(path.startsWith('invoice-logos/')).toBe(false);
  });

  it('keeps a safe extension when the file name has none', () => {
    expect(invoiceLogoObjectPath(organizationId, 'logo', 1)).toBe(`${organizationId}/invoice-logo-1.png`);
  });

  it('stores the organization logo beside the invoice logo, still under the organization id', () => {
    expect(organizationLogoObjectPath(organizationId, 'logo.png', 5)).toBe(`${organizationId}/logo-5.png`);
  });

  it('reads an existing object path without its cache-busting query', () => {
    const url = `https://example.supabase.co/storage/v1/object/public/organization-logos/${organizationId}/logo-5.png?t=1`;
    expect(logoObjectPathFromPublicUrl(url)).toBe(`${organizationId}/logo-5.png`);
  });
});

describe('logo file rules', () => {
  it('accepts the HSDE globe, which is under 2MB but over a 1MB bucket cap', () => {
    const hsdeGlobeBytes = 1_233_616;
    expect(logoFileAllowed({ name: 'hsde-logo.png', type: 'image/png', size: hsdeGlobeBytes })).toEqual({ ok: true });
    expect(logoNeedsNormalize({ size: hsdeGlobeBytes, width: 2000, height: 1918 })).toBe(true);
    expect(logoDrawSize(2000, 1918)).toEqual({ width: 1024, height: 982 });
  });

  it('leaves a small logo alone', () => {
    expect(logoNeedsNormalize({ size: 20_000, width: 400, height: 400 })).toBe(false);
  });

  it('rejects a non-image and a file over 2MB', () => {
    expect(logoFileAllowed({ name: 'notes.pdf', type: 'application/pdf', size: 1000 })).toEqual({ ok: false, reason: 'type' });
    expect(logoFileAllowed({ name: 'huge.png', type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toEqual({ ok: false, reason: 'size' });
  });

  it('accepts a png whose browser did not set a mime type', () => {
    expect(logoFileAllowed({ name: 'HSDE Logo.PNG', type: '', size: 50_000 })).toEqual({ ok: true });
  });

  it('explains a storage size or permission failure', () => {
    expect(logoUploadErrorMessage({ message: 'The object exceeded the maximum allowed size' })).toBe('Image must be smaller than 2MB');
    expect(logoUploadErrorMessage({ message: 'new row violates row-level security policy' })).toBe(
      'You do not have permission to upload a logo for this organization',
    );
    expect(logoUploadErrorMessage({ message: 'invalid input syntax for type uuid: "invoice-logos"' })).toBe(
      'You do not have permission to upload a logo for this organization',
    );
  });
});
