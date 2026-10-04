export type StatementSortBy = 'account' | 'description' | 'amount';
export type StatementSortDirection = 'asc' | 'desc';
export type StatementSectionKind = 'revenue' | 'expense';

export interface SectionSort {
  by: StatementSortBy;
  direction: StatementSortDirection;
}

export interface StatementSortCriteria {
  revenue: SectionSort;
  expense: SectionSort;
}

export interface SavedStatementSort {
  id: string;
  name: string;
  value: StatementSortCriteria;
  updatedAt: string;
}

export interface StatementAccount {
  name: string;
  code?: string | null;
  calculated_balance: number;
  is_header?: boolean;
}

export const DEFAULT_STATEMENT_SORT: StatementSortCriteria = {
  revenue: { by: 'account', direction: 'asc' },
  expense: { by: 'account', direction: 'asc' },
};

const SECTION_KIND = {
  income: 'revenue',
  otherIncome: 'revenue',
  cogs: 'expense',
  expenses: 'expense',
  otherExpenses: 'expense',
  nonOperatingExpenses: 'expense',
  incomeTaxExpenses: 'expense',
} as const;

const ACTIVE_PREFIX = 'efinsuite.statement-sort.active.';
const SAVED_PREFIX = 'efinsuite.statement-sort.saved.';
const MAX_SAVED_SORTS = 30;

export function activeStatementSortKey(organizationId?: string | null): string {
  return `${ACTIVE_PREFIX}${organizationId || 'local'}`;
}

export function savedStatementSortKey(organizationId?: string | null): string {
  return `${SAVED_PREFIX}${organizationId || 'local'}`;
}

function isSectionSort(value: unknown): value is SectionSort {
  if (!value || typeof value !== 'object') return false;
  const sort = value as SectionSort;
  return (sort.by === 'account' || sort.by === 'description' || sort.by === 'amount')
    && (sort.direction === 'asc' || sort.direction === 'desc');
}

export function isStatementSortCriteria(value: unknown): value is StatementSortCriteria {
  if (!value || typeof value !== 'object') return false;
  const criteria = value as StatementSortCriteria;
  return isSectionSort(criteria.revenue) && isSectionSort(criteria.expense);
}

export function readActiveStatementSort(organizationId?: string | null): StatementSortCriteria {
  if (typeof localStorage === 'undefined') return DEFAULT_STATEMENT_SORT;
  try {
    const parsed = JSON.parse(localStorage.getItem(activeStatementSortKey(organizationId)) || 'null');
    return isStatementSortCriteria(parsed) ? parsed : DEFAULT_STATEMENT_SORT;
  } catch {
    return DEFAULT_STATEMENT_SORT;
  }
}

export function writeActiveStatementSort(organizationId: string | null | undefined, criteria: StatementSortCriteria): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(activeStatementSortKey(organizationId), JSON.stringify(criteria));
}

export function readSavedStatementSorts(organizationId?: string | null): SavedStatementSort[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(savedStatementSortKey(organizationId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedStatementSort => (
      item
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && isStatementSortCriteria(item.value)
    ));
  } catch {
    return [];
  }
}

export function writeSavedStatementSorts(organizationId: string | null | undefined, items: SavedStatementSort[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(savedStatementSortKey(organizationId), JSON.stringify(items));
}

export function upsertSavedStatementSort(
  items: SavedStatementSort[],
  name: string,
  value: StatementSortCriteria,
  now = new Date(),
): { items: SavedStatementSort[]; saved: SavedStatementSort | null; updated: boolean; error?: 'empty' | 'limit' } {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) return { items, saved: null, updated: false, error: 'empty' };
  const existing = items.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
  const saved: SavedStatementSort = {
    id: existing?.id ?? crypto.randomUUID(),
    name: trimmed,
    value,
    updatedAt: now.toISOString(),
  };
  if (existing) {
    return { items: items.map((item) => (item.id === existing.id ? saved : item)), saved, updated: true };
  }
  if (items.length >= MAX_SAVED_SORTS) return { items, saved: null, updated: false, error: 'limit' };
  return { items: [...items, saved], saved, updated: false };
}

export function deleteSavedStatementSort(items: SavedStatementSort[], id: string): SavedStatementSort[] {
  return items.filter((item) => item.id !== id);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortStatementAccounts<T extends StatementAccount>(
  accounts: T[],
  section: StatementSectionKind,
  criteria: StatementSortCriteria,
): T[] {
  const rule = criteria[section];
  const direction = rule.direction === 'desc' ? -1 : 1;
  const headers = accounts.filter((account) => account.is_header);
  const lines = accounts.filter((account) => !account.is_header);
  lines.sort((a, b) => {
    let diff = 0;
    if (rule.by === 'amount') diff = Math.abs(a.calculated_balance) - Math.abs(b.calculated_balance);
    else if (rule.by === 'description') diff = compareText(a.name, b.name);
    else diff = compareText(a.code || a.name, b.code || b.name);
    if (diff !== 0) return diff * direction;
    return compareText(a.name, b.name);
  });
  return [...headers, ...lines];
}

export function sortIncomeStatementSections<T extends object>(statement: T, criteria: StatementSortCriteria): T {
  const next = { ...statement } as T & Record<string, unknown>;
  (Object.keys(SECTION_KIND) as Array<keyof typeof SECTION_KIND>).forEach((key) => {
    const value = (statement as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      next[key] = sortStatementAccounts(value, SECTION_KIND[key], criteria);
    }
  });
  return next;
}

function fieldLabel(by: StatementSortBy): string {
  if (by === 'amount') return 'amount';
  if (by === 'description') return 'account description';
  return 'account code';
}

function directionLabel(rule: SectionSort): string {
  if (rule.by === 'amount') return rule.direction === 'desc' ? 'high to low' : 'low to high';
  return rule.direction === 'desc' ? 'Z to A' : 'A to Z';
}

export function statementSortSummary(criteria: StatementSortCriteria): string {
  return `Revenue by ${fieldLabel(criteria.revenue.by)}, ${directionLabel(criteria.revenue)}. Expenses by ${fieldLabel(criteria.expense.by)}, ${directionLabel(criteria.expense)}.`;
}
