/**
 * Static analysis regression test: parseLocalDate usage enforcement
 *
 * Scans all .ts/.tsx source files to ensure that:
 * 1. Known date-only DB column names are never passed directly to `new Date()`
 * 2. No local `const parseLocalDate` definitions exist (must import from @/lib/utils)
 *
 * This prevents the "off-by-one day" timezone bug from being reintroduced.
 * In western timezones (e.g. EST = UTC-5), `new Date("2025-01-15")` returns
 * Jan 14 at 7PM local time because YYYY-MM-DD strings are parsed as UTC midnight.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

// Date-only columns that must NEVER be passed to `new Date()` directly
const DATE_ONLY_COLUMNS = [
  'transaction_date',
  'entry_date',
  'due_date',
  'invoice_date',
  'bill_date',
  'payment_date',
  'start_date',
  'end_date',
  'acquisition_date',
  'depreciation_start_date',
  'received_date',
  'period_start',
  'period_end',
  'movement_date',
  'disposal_date',
  'revaluation_date',
  'next_bill_date',
  'next_invoice_date',
];

// Files or directories to exclude from scanning
const EXCLUDED_PATHS = [
  'node_modules',
  '.lovable',
  'dist',
  '__tests__',
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  // Admin subscription pages use current_period_end which is a full ISO timestamp, not date-only
  'src/pages/admin',
];

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (EXCLUDED_PATHS.some(ex => fullPath.includes(ex))) continue;
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...getAllSourceFiles(fullPath));
        } else if (['.ts', '.tsx'].includes(extname(entry))) {
          results.push(fullPath);
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable directories
  }
  return results;
}

const srcDir = join(process.cwd(), 'src');
const sourceFiles = getAllSourceFiles(srcDir);

describe('parseLocalDate usage enforcement', () => {
  it('should have source files to scan', () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it('should not have local const parseLocalDate definitions (use import from @/lib/utils)', () => {
    const violations: string[] = [];

    for (const filePath of sourceFiles) {
      // Skip the canonical definition itself
      if (filePath.includes('lib/utils')) continue;

      const content = readFileSync(filePath, 'utf-8');
      // Match function/const/arrow definitions of parseLocalDate
      if (/(?:const|function)\s+parseLocalDate\s*[=(]/.test(content)) {
        violations.push(filePath.replace(process.cwd(), ''));
      }
    }

    if (violations.length > 0) {
      console.error(
        'Files with local parseLocalDate definitions (should import from @/lib/utils):\n' +
          violations.map(v => `  ${v}`).join('\n')
      );
    }

    expect(violations).toHaveLength(0);
  });

  it('should not pass date-only DB columns directly to new Date()', () => {
    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        // Skip commented lines
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        for (const col of DATE_ONLY_COLUMNS) {
          // Matches patterns like: new Date(x.transaction_date) or new Date(transaction_date)
          // but NOT: parseLocalDate(x.transaction_date) — that's the correct form
          const unsafePattern = new RegExp(`new Date\\([^)]*${col}[^)]*\\)`);
          if (unsafePattern.test(line)) {
            violations.push({
              file: filePath.replace(process.cwd(), ''),
              line: idx + 1,
              text: line.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      console.error(
        'Unsafe new Date() calls on date-only columns (use parseLocalDate() instead):\n' +
          violations
            .map(v => `  ${v.file}:${v.line}\n    ${v.text}`)
            .join('\n')
      );
    }

    expect(violations).toHaveLength(0);
  });
});
