// Filtering and sorting for the employee lists.

export interface ListEmployee {
  first_name: string;
  last_name: string;
  email: string;
  employee_number?: string | null;
  job_title?: string | null;
  department?: string | null;
  phone?: string | null;
  employment_type?: string | null;
  status?: string | null;
  hire_date?: string | null;
  annual_salary?: number | null;
  hourly_rate?: number | null;
  province?: string | null;
  nin?: string | null;
  sin_encrypted?: string | null;
  bank_institution?: string | null;
  bank_account?: string | null;
}

export type PayType = 'all' | 'salary' | 'hourly' | 'none';

export interface EmployeeFilters {
  search: string;
  status: string;          // 'all' or an employee_status
  department: string;      // 'all', '__none__' (no department) or a department name
  position: string;        // 'all', '__none__' (no job title) or a job title
  employmentType: string;  // 'all' or an employment_type
  payType: PayType;
  hireFrom: string;        // YYYY-MM-DD or ''
  hireTo: string;          // YYYY-MM-DD or ''
  payMin: string;          // annual equivalent, '' = no bound
  payMax: string;
}

export const EMPTY_FILTERS: EmployeeFilters = {
  search: '', status: 'all', department: 'all', position: 'all', employmentType: 'all', payType: 'all',
  hireFrom: '', hireTo: '', payMin: '', payMax: '',
};

export type SortKey = 'name' | 'employee_number' | 'bank' | 'department' | 'job_title' | 'employment_type' | 'pay' | 'hire_date' | 'status' | 'province';
export interface SortState { key: SortKey; dir: 'asc' | 'desc' }

/** Standard full-time hours used to compare hourly and salaried pay. */
export const HOURS_PER_YEAR = 2080;

/** Annual pay for sorting and range filters: salary, or hourly rate × 2,080. */
export function annualEquivalent(e: Pick<ListEmployee, 'annual_salary' | 'hourly_rate'>): number | null {
  if (e.annual_salary && e.annual_salary > 0) return Number(e.annual_salary);
  if (e.hourly_rate && e.hourly_rate > 0) return Number(e.hourly_rate) * HOURS_PER_YEAR;
  return null;
}

const dateKey = (d?: string | null) => (d ? d.slice(0, 10) : '');

export function countActiveFilters(f: EmployeeFilters): number {
  return [
    f.status !== 'all', f.department !== 'all', f.position !== 'all', f.employmentType !== 'all', f.payType !== 'all',
    !!f.hireFrom || !!f.hireTo, !!f.payMin || !!f.payMax,
  ].filter(Boolean).length;
}

export function filterEmployees<T extends ListEmployee>(rows: T[], f: EmployeeFilters): T[] {
  const q = f.search.trim().toLowerCase();
  const min = f.payMin === '' ? null : Number(f.payMin.replace(/[, ]/g, ''));
  const max = f.payMax === '' ? null : Number(f.payMax.replace(/[, ]/g, ''));
  return rows.filter((e) => {
    if (q) {
      const hay = [`${e.first_name} ${e.last_name}`, e.email, e.employee_number, e.job_title, e.department, e.phone, nationalIdOf(e)]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (f.department === '__none__' ? !!e.department : f.department !== 'all' && e.department !== f.department) return false;
    if (f.position === '__none__' ? !!e.job_title : f.position !== 'all' && e.job_title !== f.position) return false;
    if (f.employmentType !== 'all' && e.employment_type !== f.employmentType) return false;
    const hasSalary = !!(e.annual_salary && e.annual_salary > 0);
    const hasHourly = !hasSalary && !!(e.hourly_rate && e.hourly_rate > 0);
    if (f.payType === 'salary' && !hasSalary) return false;
    if (f.payType === 'hourly' && !hasHourly) return false;
    if (f.payType === 'none' && (hasSalary || hasHourly)) return false;
    const hire = dateKey(e.hire_date);
    if (f.hireFrom && (!hire || hire < f.hireFrom)) return false;
    if (f.hireTo && (!hire || hire > f.hireTo)) return false;
    if (min !== null || max !== null) {
      const pay = annualEquivalent(e);
      if (pay === null) return false;
      if (min !== null && Number.isFinite(min) && pay < min) return false;
      if (max !== null && Number.isFinite(max) && pay > max) return false;
    }
    return true;
  });
}

const STATUS_ORDER: Record<string, number> = { active: 0, onboarding: 1, on_leave: 2, terminated: 3 };

function sortValue(e: ListEmployee, key: SortKey): string | number | null {
  switch (key) {
    case 'name': return `${e.last_name} ${e.first_name}`.toLowerCase();
    case 'employee_number': return e.employee_number?.toLowerCase() ?? null;
    case 'department': return e.department?.toLowerCase() || null;
    case 'job_title': return e.job_title?.toLowerCase() || null;
    case 'employment_type': return e.employment_type ?? null;
    case 'pay': return annualEquivalent(e);
    case 'hire_date': return dateKey(e.hire_date) || null;
    case 'status': return e.status ? STATUS_ORDER[e.status] ?? 9 : null;
    case 'province': return e.province ?? null;
    case 'bank': return e.bank_institution?.toLowerCase() || null;
  }
}

/** Sorts a copy. Blank values always go last, whichever direction. Ties break by name. */
export function sortEmployees<T extends ListEmployee>(rows: T[], sort: SortState): T[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    if (va !== null && vb !== null && va !== vb) {
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      if (cmp !== 0) return cmp * dir;
    }
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
  });
}

/** Clicking a header: same column flips direction; a new column starts ascending (pay and hire date start descending). */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'pay' || key === 'hire_date' ? 'desc' : 'asc' };
}

const EMPLOYMENT_LABELS: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', temporary: 'Temporary' };
const STATUS_LABELS: Record<string, string> = { active: 'Active', onboarding: 'Onboarding', on_leave: 'On Leave', terminated: 'Terminated' };
export const employmentTypeLabel = (v?: string | null) => (v ? EMPLOYMENT_LABELS[v] ?? v : '');
export const statusLabel = (v?: string | null) => (v ? STATUS_LABELS[v] ?? v : '');

export type BreakdownKey = 'department' | 'position' | 'employment_type';
/** The value a breakdown bucket sets on the matching filter ('__none__' = blank). */
export interface BreakdownBucket { value: string; label: string; count: number }

/** Headcount per department, position or employment type, largest first; blanks grouped last as "Not set". */
export function headcountBreakdown(rows: ListEmployee[], key: BreakdownKey): BreakdownBucket[] {
  const counts = new Map<string, number>();
  for (const e of rows) {
    const raw = key === 'department' ? e.department : key === 'position' ? e.job_title : e.employment_type;
    const v = raw ? raw : '__none__';
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const label = (v: string) => (v === '__none__' ? 'Not set' : key === 'employment_type' ? employmentTypeLabel(v) : v);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count }))
    .sort((a, b) => (a.value === '__none__' ? 1 : b.value === '__none__' ? -1 : b.count - a.count || a.label.localeCompare(b.label)));
}

/** National ID: the NIN for Nigerian employees, otherwise the SIN / national ID on file. */
export function nationalIdOf(e: Pick<ListEmployee, 'nin' | 'sin_encrypted'>): string | null {
  return (e.nin && e.nin.trim()) || (e.sin_encrypted && e.sin_encrypted.trim()) || null;
}

/** Hides all but the last `keep` characters: "12345678901" → "•••••••8901". Short values are fully hidden. */
export function maskTail(v: string | null | undefined, keep = 4): string {
  if (!v) return '';
  const s = v.trim();
  if (s.length <= keep) return '•'.repeat(s.length);
  return '•'.repeat(Math.min(s.length - keep, 7)) + s.slice(-keep);
}
