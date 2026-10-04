import { describe, expect, it } from 'vitest';
import { noTaxMatches, taxCodeMatches, taxOptionMatches } from './taxCodeSearch';

const manitoba = {
  code: 'MB',
  name: 'Manitoba',
  provinceCode: 'MB',
  taxModel: 'GST_PST',
  combinedRate: 12,
  breakdown: [
    { code: 'GST', rate: 5, authority: 'CRA' },
    { code: 'PST', rate: 7, authority: 'MB' },
  ],
};

const ontario = {
  code: 'ON',
  name: 'Ontario',
  provinceCode: 'ON',
  taxModel: 'HST',
  combinedRate: 13,
  breakdown: [{ code: 'HST', rate: 13, authority: 'CRA' }],
};

describe('tax code search', () => {
  it('matches GST on both collected and ITC Manitoba codes', () => {
    expect(taxOptionMatches(manitoba, 'gst', 'collected')).toBe(true);
    expect(taxOptionMatches({ ...manitoba, name: 'Manitoba — GST Paid (ITC) + PST Paid' }, 'gst', 'paid')).toBe(true);
  });

  it('keeps HST provinces out of a GST search', () => {
    expect(taxOptionMatches(ontario, 'gst', 'collected')).toBe(false);
    expect(taxOptionMatches({ ...ontario, name: 'Ontario — HST Paid (ITC)' }, 'gst', 'paid')).toBe(false);
    expect(taxOptionMatches(ontario, 'hst', 'collected')).toBe(true);
  });

  it('finds ITC codes without listing every paid province', () => {
    expect(taxOptionMatches(manitoba, 'itc', 'paid')).toBe(true);
    expect(taxOptionMatches(manitoba, 'itc', 'collected')).toBe(false);
    expect(taxOptionMatches(manitoba, 'manitoba', 'collected')).toBe(true);
    expect(taxOptionMatches(manitoba, '12', 'collected')).toBe(true);
  });

  it('hides No Tax while a GST search is typed', () => {
    expect(noTaxMatches('')).toBe(true);
    expect(noTaxMatches('gst')).toBe(false);
    expect(noTaxMatches('no tax')).toBe(true);
  });

  it('searches saved tax codes by code and side', () => {
    expect(taxCodeMatches({ code: 'GST-ITC', name: 'GST Paid (ITC)', rate: 5, applies_to: 'purchases' }, 'gst')).toBe(true);
    expect(taxCodeMatches({ code: 'GST', name: 'GST Collected', rate: 5, applies_to: 'sales' }, 'collected')).toBe(true);
    expect(taxCodeMatches({ code: 'HST-ON', name: 'HST Ontario', rate: 13 }, 'gst')).toBe(false);
  });
});
