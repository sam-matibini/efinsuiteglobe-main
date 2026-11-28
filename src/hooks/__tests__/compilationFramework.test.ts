import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { frameworkDisplayName, getFrameworkNoteTemplates, nigeriaFrameworkFor } from '../useCompilationReports';

const note = (fw: string, id: string, country?: string) => getFrameworkNoteTemplates(fw, { country }).find((n) => n.id === id)?.template ?? '';

describe('Nigerian financial reporting framework', () => {
  it('PIEs use full IFRS, SMEs use IFRS for SMEs', () => {
    expect(nigeriaFrameworkFor(true)).toBe('IFRS');
    expect(nigeriaFrameworkFor(false)).toBe('IFRS_SME');
  });

  it('names the framework as adopted by the FRC of Nigeria', () => {
    expect(frameworkDisplayName('IFRS', 'NG')).toMatch(/IASB.*Financial Reporting Council of Nigeria/);
    expect(frameworkDisplayName('IFRS_SME', 'Nigeria')).toMatch(/IFRS for SMEs Accounting Standard.*Financial Reporting Council of Nigeria/);
    expect(frameworkDisplayName('IFRS', 'CA')).toBe('International Financial Reporting Standards (IFRS)');
  });

  it('basis note cites CAMA 2020, the FRC Act and the Naira', () => {
    const basis = note('IFRS_SME', 'basis', 'NG');
    expect(basis).toMatch(/Companies and Allied Matters Act 2020/);
    expect(basis).toMatch(/Financial Reporting Council of Nigeria Act 2011 \(as amended\)/);
    expect(basis).toMatch(/Naira/);
  });

  it('IFRS for SMEs notes reference Sections, full IFRS notes reference IAS/IFRS', () => {
    expect(note('IFRS_SME', 'ppe', 'NG')).toMatch(/Section 17/);
    expect(note('IFRS_SME', 'revenue', 'NG')).toMatch(/Section 23/);
    expect(note('IFRS_SME', 'financial_instruments', 'NG')).toMatch(/Section 11/);
    expect(note('IFRS_SME', 'finance_lease', 'NG')).toMatch(/Section 20/);
    expect(note('IFRS', 'ppe', 'NG')).toMatch(/IAS 16/);
    expect(note('IFRS', 'finance_lease', 'NG')).toMatch(/IFRS 16/);
  });

  it('adds Nigerian tax and pension notes only for Nigeria', () => {
    expect(note('IFRS', 'income_taxes', 'NG')).toMatch(/Nigeria Tax Act 2025/);
    expect(note('IFRS_SME', 'employee_benefits', 'NG')).toMatch(/Pension Reform Act 2014/);
    expect(note('IFRS', 'employee_benefits', 'KE')).toBe('');
    expect(note('IFRS', 'basis', 'KE')).toBe('These financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS).');
  });

  it('leaves Canadian frameworks unchanged', () => {
    expect(note('ASPE', 'basis', 'NG')).toMatch(/ASPE/);
    expect(note('ASNPO', 'basis')).toMatch(/ASNPO/);
  });
});
