import * as XLSX from 'xlsx';
import { MAX_FILE_SIZE_BYTES, headerToKey } from './schema';

/** A cell value after parsing: dates become YYYY-MM-DD, numbers become exact digit strings. */
export type CellValue = string;

export interface ParsedRow {
  /** 1-based row number as shown in Excel. */
  rowNumber: number;
  values: Record<string, CellValue>;
}

export interface ParsedUpload {
  fileName: string;
  fileSize: number;
  sheetName: string;
  headers: { header: string; key: string | null }[];
  rows: ParsedRow[];
  /** Problems with the file itself (no data, unknown columns…). */
  fileErrors: string[];
  fileWarnings: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Exact text for a number cell: no exponent, no float noise for whole numbers. */
function numberToText(v: number): string {
  if (Number.isInteger(v)) {
    return Number.isSafeInteger(v) ? String(v) : BigInt(Math.round(v)).toString();
  }
  return String(Number(v.toPrecision(15)));
}

function cellToText(cell: XLSX.CellObject | undefined): CellValue {
  if (!cell || cell.v == null) return '';
  if (cell.t === 'n' && typeof cell.v === 'number') {
    // Date-formatted numbers are Excel serial dates; decode without time zones.
    if (cell.z && XLSX.SSF.is_date(String(cell.z))) {
      const d = XLSX.SSF.parse_date_code(cell.v);
      if (d && d.y > 1900) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    }
    return numberToText(cell.v);
  }
  if (cell.t === 'd' && cell.v instanceof Date) {
    const d = cell.v;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  return String(cell.v).replace(/ /g, ' ').trim();
}

function pickSheet(wb: XLSX.WorkBook): string | null {
  const byName = wb.SheetNames.find((n) => n.trim().toLowerCase() === 'employees');
  if (byName) return byName;
  return wb.SheetNames.find((n) => !/^(instructions|reference|read ?me)$/i.test(n.trim())) ?? null;
}

export function parseWorkbook(wb: XLSX.WorkBook, fileName: string, fileSize: number): ParsedUpload {
  const out: ParsedUpload = { fileName, fileSize, sheetName: '', headers: [], rows: [], fileErrors: [], fileWarnings: [] };
  const sheetName = pickSheet(wb);
  if (!sheetName) {
    out.fileErrors.push('The file has no Employees sheet.');
    return out;
  }
  out.sheetName = sheetName;
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    out.fileErrors.push(`Sheet "${sheetName}" is empty.`);
    return out;
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const text = (r: number, c: number) => cellToText(ws[XLSX.utils.encode_cell({ r, c })]);

  // Header row: the first of the top 10 rows with at least two recognised headers.
  let headerRow = -1;
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 9); r++) {
    let hits = 0;
    for (let c = range.s.c; c <= range.e.c; c++) if (headerToKey(text(r, c))) hits++;
    if (hits >= 2) { headerRow = r; break; }
  }
  if (headerRow < 0) {
    out.fileErrors.push('Could not find the header row. Use the downloaded template and keep its column headers.');
    return out;
  }

  const colKeys: { c: number; key: string }[] = [];
  const seen = new Set<string>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = text(headerRow, c);
    if (!header) continue;
    const key = headerToKey(header);
    out.headers.push({ header, key });
    if (!key) {
      out.fileWarnings.push(`Column "${header}" is not recognised and will be ignored.`);
      continue;
    }
    if (seen.has(key)) {
      out.fileWarnings.push(`Column "${header}" appears more than once; only the first is used.`);
      continue;
    }
    seen.add(key);
    colKeys.push({ c, key });
  }
  for (const required of ['first_name', 'last_name', 'email', 'hire_date']) {
    if (!seen.has(required)) out.fileErrors.push(`Required column missing: ${required.replace(/_/g, ' ')}.`);
  }

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const values: Record<string, CellValue> = {};
    let any = false;
    for (const { c, key } of colKeys) {
      const v = text(r, c);
      values[key] = v;
      if (v) any = true;
    }
    if (any) out.rows.push({ rowNumber: r + 1, values });
  }
  if (out.rows.length === 0 && out.fileErrors.length === 0) out.fileErrors.push('No employee rows found under the header row.');
  return out;
}

export async function parseUploadFile(file: File): Promise<ParsedUpload> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { fileName: file.name, fileSize: file.size, sheetName: '', headers: [], rows: [], fileErrors: ['File exceeds the 10 MB limit.'], fileWarnings: [] };
  }
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  // raw: true keeps CSV text as typed, so IDs like 01234567890 keep their leading zero.
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, cellNF: true, raw: isCsv });
  return parseWorkbook(wb, file.name, file.size);
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function monthOf(name: string): number | undefined {
  const n = name.toLowerCase();
  return MONTHS[n.slice(0, 4)] ?? MONTHS[n.slice(0, 3)];
}

function valid(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Parses a date cell (already YYYY-MM-DD for Excel dates) into YYYY-MM-DD, or null. */
export function parseDate(v: string, order: 'DMY' | 'MDY'): string | null {
  const s = v.trim();
  if (!s) return null;
  // A bare Excel serial (e.g. 34346) in a date column — date formatting was lost.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    return d && d.y > 1900 ? valid(d.y, d.m, d.d) : null;
  }
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12) return valid(y, b, a);
    if (b > 12) return valid(y, a, b);
    return order === 'DMY' ? valid(y, b, a) : valid(y, a, b);
  }
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s,-]+(\d{2}|\d{4})$/);
  if (m && monthOf(m[2])) return valid(+m[3], monthOf(m[2])!, +m[1]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && monthOf(m[1])) return valid(+m[3], monthOf(m[1])!, +m[2]);
  return null;
}

export function parseMoney(v: string): number | null {
  const s = v.replace(/[,\s₦$£€]/g, '').replace(/^NGN|^CAD|^USD|^GBP/i, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
