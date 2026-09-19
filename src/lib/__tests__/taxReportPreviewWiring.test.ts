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

  it('opens on a QuickBooks-style Sales Tax overview with GST/HST reports', () => {
    const salesTax = readFileSync(join(root, 'src/pages/SalesTax.tsx'), 'utf8');
    expect(salesTax).toContain('Sales Tax overview');
    expect(salesTax).toContain('<SalesTaxOverview');
    expect(salesTax).toContain('<SalesTaxFilings');
    expect(salesTax).toContain('<GstHstSummaryReport');
    expect(salesTax).toContain('<GstHstDetailReport');
    expect(salesTax).toContain('<TaxReportPreview');
    expect(salesTax).toContain('useGstHstPeriodReport');
    expect(salesTax).not.toContain('Account Breakdown');
    expect(salesTax).not.toContain('summaryPeriod');
    expect(salesTax).not.toContain('glTaxSummary');
  });

  it('pulls posted standalone journal tax lines into the GST/HST period engine', () => {
    const hook = readFileSync(join(root, 'src/hooks/useGstHstPeriodReport.ts'), 'utf8');
    expect(hook).toContain('fetchStandaloneGstHstJournalDocuments');
    expect(hook).toContain('gstHstDocumentsFromJournalEntries');
    expect(hook).toContain('journal_entry_lines');
    expect(hook).toContain('tax_code_id');
    expect(hook).toContain('countedLinkedSources');

    const engine = readFileSync(join(root, 'src/lib/gstHstPeriodEngine.ts'), 'utf8');
    expect(engine).toContain("source: 'bank' | 'credit_card' | 'journal'");
    expect(engine).toContain("type: 'Invoice' | 'Bill' | 'Expense' | 'Bank' | 'Credit card' | 'Journal'");
    expect(engine).toContain('gstHstDocumentsFromJournalEntries');
    expect(engine).toContain("doc.source === 'journal' ? 'Journal'");
    expect(engine).toContain('if (!usedDocumentCollected)');

    const salesTax = readFileSync(join(root, 'src/pages/SalesTax.tsx'), 'utf8');
    expect(salesTax).toContain('useTaxPeriodActivity');
    expect(salesTax).toContain('journal: gstJournal');

    const journals = readFileSync(join(root, 'src/hooks/useJournalEntries.ts'), 'utf8');
    expect(journals).toContain('tax_code_id: line.tax_code_id || null');
    expect(journals).toContain("queryKey: ['gst-hst-period-documents']");

    const addDialog = readFileSync(join(root, 'src/components/journal/AddJournalEntryDialog.tsx'), 'utf8');
    expect(addDialog).toContain('tax_code_id: taxCode.id || line.tax_code_id || null');
  });
});
