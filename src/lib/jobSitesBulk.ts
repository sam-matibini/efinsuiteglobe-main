import * as XLSX from 'xlsx';

export interface ParsedJobSiteRow {
  name: string;
  code: string | null;
  is_active: boolean;
}

function parseBool(v: unknown, fallback = true): boolean {
  if (v === undefined || v === null || v === '') return fallback;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'active'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(s)) return false;
  return fallback;
}

export function downloadJobSitesTemplate() {
  const csv =
    'name,code,is_active\n' +
    'Head Office,HQ,true\n' +
    'Lagos Branch,LAG,true\n' +
    '# name is required; code optional (max 20 chars); is_active true/false (defaults true)\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'job-sites-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export async function parseJobSitesFile(file: File): Promise<ParsedJobSiteRow[]> {
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
      const nameKey = keys.find((k) => k.toLowerCase().trim() === 'name') ?? keys[0];
      const codeKey = keys.find((k) => k.toLowerCase().trim() === 'code');
      const activeKey = keys.find((k) =>
        ['is_active', 'active', 'status'].includes(k.toLowerCase().trim()),
      );
      const name = String(row[nameKey] ?? '').trim();
      const code = codeKey ? String(row[codeKey] ?? '').trim() : '';
      const is_active = activeKey ? parseBool(row[activeKey]) : true;
      return { name, code: code || null, is_active };
    })
    .filter((r) => r.name && !r.name.startsWith('#'));
}

export function parsePastedJobSites(text: string): ParsedJobSiteRow[] {
  return text
    .replace(/[;\t]/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const name = parts[0] ?? '';
      const code = parts[1] || '';
      const is_active = parts.length >= 3 ? parseBool(parts[2]) : true;
      return { name, code: code || null, is_active };
    })
    .filter((r) => r.name);
}

export function exportFailedJobSitesCsv(
  rows: { name: string; code: string | null; is_active: boolean; error: string }[],
) {
  const header = 'name,code,is_active,error\n';
  const body = rows
    .map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}",${r.code ?? ''},${r.is_active},"${r.error.replace(/"/g, '""')}"`,
    )
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'job-sites-failed.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export interface ValidatedRow extends ParsedJobSiteRow {
  error?: string;
  duplicateOfExisting?: boolean;
}

export function validateRows(
  rows: ParsedJobSiteRow[],
  existingNames: string[],
): ValidatedRow[] {
  const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
  const seen = new Set<string>();
  return rows.map((r) => {
    const nameLower = r.name.toLowerCase();
    let error: string | undefined;
    let duplicateOfExisting = false;
    if (!r.name.trim()) error = 'Name is required';
    else if (r.name.length > 120) error = 'Name exceeds 120 characters';
    else if (r.code && r.code.length > 20) error = 'Code exceeds 20 characters';
    else if (existingSet.has(nameLower)) {
      error = 'Site with this name already exists';
      duplicateOfExisting = true;
    } else if (seen.has(nameLower)) error = 'Duplicate in upload';
    seen.add(nameLower);
    return { ...r, error, duplicateOfExisting };
  });
}
