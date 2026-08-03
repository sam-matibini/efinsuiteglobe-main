import * as XLSX from 'xlsx';

export interface ParsedJobSiteRow {
  name: string;
  code: string | null;
  state_province: string | null;
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
    'name,code,state_province,is_active\n' +
    'Head Office,HQ,LA,true\n' +
    'Lagos Branch,LAG,LA,true\n' +
    '# name is required; code optional (max 20 chars); state_province optional (use the localized state/province code, e.g. LA for Lagos or ON for Ontario); is_active true/false (defaults true)\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'job-sites-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function pickKey(keys: string[], names: string[]): string | undefined {
  return keys.find((k) => names.includes(k.toLowerCase().trim()));
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
      const nameKey = pickKey(keys, ['name']) ?? keys[0];
      const codeKey = pickKey(keys, ['code']);
      const stateKey = pickKey(keys, ['state_province', 'state', 'province', 'state/prov', 'state/province']);
      const activeKey = pickKey(keys, ['is_active', 'active', 'status']);
      const name = String(row[nameKey] ?? '').trim();
      const code = codeKey ? String(row[codeKey] ?? '').trim() : '';
      const state_province = stateKey ? String(row[stateKey] ?? '').trim() : '';
      const is_active = activeKey ? parseBool(row[activeKey]) : true;
      return { name, code: code || null, state_province: state_province || null, is_active };
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
      const state_province = parts[2] || '';
      const is_active = parts.length >= 4 ? parseBool(parts[3]) : true;
      return { name, code: code || null, state_province: state_province || null, is_active };
    })
    .filter((r) => r.name);
}

export function exportFailedJobSitesCsv(
  rows: { name: string; code: string | null; state_province: string | null; is_active: boolean; error: string }[],
) {
  const header = 'name,code,state_province,is_active,error\n';
  const body = rows
    .map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}",${r.code ?? ''},${r.state_province ?? ''},${r.is_active},"${r.error.replace(/"/g, '""')}"`,
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
  warning?: string;
  duplicateOfExisting?: boolean;
}

export function validateRows(
  rows: ParsedJobSiteRow[],
  existingNames: string[],
  validJurisdictionCodes?: string[],
): ValidatedRow[] {
  const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
  const jurSet = validJurisdictionCodes
    ? new Set(validJurisdictionCodes.map((c) => c.toUpperCase()))
    : null;
  const seen = new Set<string>();
  return rows.map((r) => {
    const nameLower = r.name.toLowerCase();
    let error: string | undefined;
    let warning: string | undefined;
    let duplicateOfExisting = false;
    if (!r.name.trim()) error = 'Name is required';
    else if (r.name.length > 120) error = 'Name exceeds 120 characters';
    else if (r.code && r.code.length > 20) error = 'Code exceeds 20 characters';
    else if (existingSet.has(nameLower)) {
      error = 'Site with this name already exists';
      duplicateOfExisting = true;
    } else if (seen.has(nameLower)) error = 'Duplicate in upload';
    if (!error && r.state_province && jurSet && !jurSet.has(r.state_province.toUpperCase())) {
      warning = `State/Province "${r.state_province}" not in the active country`;
    }
    seen.add(nameLower);
    return { ...r, error, warning, duplicateOfExisting };
  });
}
