import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../..');

describe('tax report preview wiring', () => {
  it('loads period tax movements instead of lifetime account balances', () => {
    const preview = readFileSync(join(root, 'src/components/tax/TaxReportPreview.tsx'), 'utf8');
    expect(preview).toContain('get_tax_movements_by_code');
    expect(preview).toContain('summarizeTaxMovements');
    expect(preview).toContain('Period activity');
    expect(preview).toContain('Tax liability by tax code');
    expect(preview).toContain('Date range');
    expect(preview).toContain('Transaction detail');
    expect(preview).toContain('mergePeriodSummary');
    expect(preview).toContain('journal_entries!inner');
    expect(preview).not.toContain('balance: Math.abs(Number(acc.current_balance || 0))');
    expect(preview).not.toContain("filter(j => j.account_name.toLowerCase().includes('collected'))");
  });
});
