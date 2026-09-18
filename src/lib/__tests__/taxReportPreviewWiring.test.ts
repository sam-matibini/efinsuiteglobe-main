import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../..');

describe('tax report preview wiring', () => {
  it('loads period tax movements instead of lifetime account balances', () => {
    const preview = readFileSync(join(root, 'src/components/tax/TaxReportPreview.tsx'), 'utf8');
    expect(preview).toContain('useGstHstPeriodReport');
    expect(preview).toContain('GstHstSupportReport');
    expect(preview).toContain('Taxable sales (line 90A)');
    expect(preview).toContain('Exempt / zero-rated sales');
    expect(preview).toContain('GST/HST collected (line 103)');
    expect(preview).toContain('Input tax credits (line 106)');
    expect(preview).not.toContain('current_balance');
    expect(preview).not.toContain("filter(j => j.account_name.toLowerCase().includes('collected'))");
    expect(preview).not.toContain('{false &&');
    expect(preview).toContain('sanitizeComparePeriodCountInput');
    expect(preview).toContain('draftCompareCount');
    expect(preview).not.toContain('max={5}');
    expect(preview).not.toContain('Math.min(5, Math.max(1, parseInt(e.target.value) || 1))');
  });

  it('uses a Zoho-style Date Range + From + To + Run Report bar', () => {
    const bar = readFileSync(join(root, 'src/components/tax/TaxDateRangeBar.tsx'), 'utf8');
    expect(bar).toContain('Date Range');
    expect(bar).toContain('From');
    expect(bar).toContain('To');
    expect(bar).toContain('Run Report');
    expect(bar).toContain('TAX_DATE_PRESET_OPTIONS');
  });

  it('keeps Tax Summary on period activity, not lifetime GL balances', () => {
    const salesTax = readFileSync(join(root, 'src/pages/SalesTax.tsx'), 'utf8');
    expect(salesTax).toContain('<TaxReportPreview');
    expect(salesTax).toContain('defaultValue="summary"');
    expect(salesTax).not.toContain('Account Breakdown');
    expect(salesTax).not.toContain('summaryPeriod');
    expect(salesTax).not.toContain('glTaxSummary');
  });
});
