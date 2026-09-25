import { describe, it, expect } from 'vitest';
import { parseContentToSheets, parseFormattedValue } from '../parseContentToSheets';

describe('parseFormattedValue', () => {
  it('parses currency strings', () => {
    expect(parseFormattedValue('$1,234.56')).toBe(1234.56);
    expect(parseFormattedValue('(500.00)')).toBe(-500);
  });
  it('parses percentages', () => {
    expect(parseFormattedValue('45%')).toBeCloseTo(0.45);
  });
  it('returns original for non-numeric', () => {
    expect(parseFormattedValue('hello')).toBe('hello');
  });
});

describe('parseContentToSheets', () => {
  it('parses markdown table into structured data', () => {
    const content = `## Revenue
| Category | Amount |
|----------|--------|
| Sales | $1,000 |
| Services | $2,500 |`;
    const sheets = parseContentToSheets(content);
    expect(sheets.length).toBeGreaterThanOrEqual(1);
    const sheet = sheets[0];
    // Should have parsed table rows with numeric values
    const salesRow = sheet.data.find(r => String(r[0]).includes('Sales'));
    expect(salesRow).toBeDefined();
    expect(typeof salesRow![1]).toBe('number');
  });

  it('parses key-value pairs', () => {
    const content = `**Revenue**: $5,000\n**Expenses**: $3,000`;
    const sheets = parseContentToSheets(content);
    expect(sheets[0].data.some(r => r[0] === 'Revenue')).toBe(true);
  });

  it('handles plain text fallback', () => {
    const content = 'Just a simple line of text';
    const sheets = parseContentToSheets(content);
    expect(sheets.length).toBe(1);
  });
});
