import * as XLSX from 'xlsx';

export const VALID_ROLES = [
  'owner',
  'admin',
  'finance_manager',
  'accountant',
  'payroll_officer',
  'auditor',
  'member',
] as const;

export type BulkRole = (typeof VALID_ROLES)[number];

export interface ParsedRow {
  email: string;
  role: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function isValidRole(role: string): role is BulkRole {
  return (VALID_ROLES as readonly string[]).includes(role);
}

/** Downloads a CSV template with example rows. */
export function downloadTemplate() {
  const csv =
    'email,role\n' +
    'jane@example.com,accountant\n' +
    'john@example.com,member\n' +
    '# Valid roles: ' +
    VALID_ROLES.join(', ') +
    '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-invite-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/** Parses an uploaded CSV/XLSX file into rows. */
export async function parseFile(file: File, defaultRole: string): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  return rows
    .map((row) => {
      const keys = Object.keys(row);
      const emailKey = keys.find((k) => k.toLowerCase().trim() === 'email') ?? keys[0];
      const roleKey = keys.find((k) => k.toLowerCase().trim() === 'role');
      const email = String(row[emailKey] ?? '').trim().toLowerCase();
      const role = roleKey
        ? String(row[roleKey] ?? '').trim().toLowerCase() || defaultRole
        : defaultRole;
      return { email, role };
    })
    .filter((r) => r.email && !r.email.startsWith('#'));
}

/** Parses pasted text (one entry per line: email or email,role). */
export function parsePasted(text: string, defaultRole: string): ParsedRow[] {
  // Support comma/semicolon separated on a single line too
  const normalized = text.replace(/[;\t]/g, '\n');
  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 2 && parts[1]) {
        return { email: parts[0].toLowerCase(), role: parts[1].toLowerCase() };
      }
      return { email: parts[0].toLowerCase(), role: defaultRole };
    })
    .filter((r) => r.email);
}

export function exportFailedCsv(rows: { email: string; role: string; error: string }[]) {
  const header = 'email,role,error\n';
  const body = rows
    .map((r) => `${r.email},${r.role},"${r.error.replace(/"/g, '""')}"`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-invite-failed.csv';
  link.click();
  URL.revokeObjectURL(url);
}
