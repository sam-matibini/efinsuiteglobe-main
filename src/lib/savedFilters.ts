export interface SavedFilter<T> {
  id: string;
  name: string;
  value: T;
  updatedAt: string;
}

export interface BankingSavedFilter {
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
  categoryFilter: string;
  glPostedFilter: string;
  dateRange: string;
  customStartDate: string | null;
  customEndDate: string | null;
  amountMin: string;
  amountMax: string;
}

export interface FinancialReportSavedFilter {
  startDate: string;
  endDate: string;
  datePreset?: string | null;
  showZeroBalances: boolean;
  compare: {
    type: 'period' | 'year';
    count: number;
    latestToOldest: boolean;
  } | null;
  divisionIds: string[];
}

const MAX_SAVED_FILTERS = 30;

export function savedFilterStorageKey(scope: string, organizationId?: string | null): string {
  return `efinsuite.saved-filters.${scope}.${organizationId || 'local'}`;
}

export function readSavedFilters<T>(storageKey: string): SavedFilter<T>[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedFilter<T> => (
      item
      && typeof item.id === 'string'
      && typeof item.name === 'string'
      && item.value !== null
      && typeof item.value === 'object'
    ));
  } catch {
    return [];
  }
}

export function writeSavedFilters<T>(storageKey: string, items: SavedFilter<T>[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey, JSON.stringify(items));
}

export function upsertSavedFilter<T>(
  items: SavedFilter<T>[],
  name: string,
  value: T,
  now = new Date(),
): { items: SavedFilter<T>[]; saved: SavedFilter<T> | null; updated: boolean; error?: 'empty' | 'limit' } {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) return { items, saved: null, updated: false, error: 'empty' };

  const existing = items.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
  const saved: SavedFilter<T> = {
    id: existing?.id ?? crypto.randomUUID(),
    name: trimmed,
    value,
    updatedAt: now.toISOString(),
  };
  if (existing) {
    return {
      items: items.map((item) => (item.id === existing.id ? saved : item)),
      saved,
      updated: true,
    };
  }
  if (items.length >= MAX_SAVED_FILTERS) {
    return { items, saved: null, updated: false, error: 'limit' };
  }
  return { items: [...items, saved], saved, updated: false };
}

export function deleteSavedFilter<T>(items: SavedFilter<T>[], id: string): SavedFilter<T>[] {
  return items.filter((item) => item.id !== id);
}
