import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSavedFilters } from '@/hooks/useSavedFilters';
import {
  deleteSavedFilter,
  readSavedFilters,
  savedFilterStorageKey,
  upsertSavedFilter,
  writeSavedFilters,
} from './savedFilters';

describe('saved filters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, updates by name, and deletes', () => {
    const created = upsertSavedFilter([], 'Pending deposits', { statusFilter: 'pending' });
    expect(created.saved?.name).toBe('Pending deposits');
    expect(created.updated).toBe(false);

    const updated = upsertSavedFilter(created.items, ' pending deposits ', { statusFilter: 'matched' });
    expect(updated.updated).toBe(true);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].value).toEqual({ statusFilter: 'matched' });
    expect(updated.items[0].id).toBe(created.saved?.id);

    expect(deleteSavedFilter(updated.items, updated.items[0].id)).toEqual([]);
  });

  it('rejects a blank name and keeps stored filters per organization', () => {
    expect(upsertSavedFilter([{ id: '1', name: 'A', value: { n: 1 }, updatedAt: '' }], '   ', { n: 2 }).error).toBe('empty');

    const key = savedFilterStorageKey('banking-transactions', 'org-1');
    writeSavedFilters(key, [{ id: '1', name: 'Last month', value: { dateRange: 'last-month' }, updatedAt: '2026-10-03' }]);
    expect(readSavedFilters(key)).toHaveLength(1);
    expect(readSavedFilters(savedFilterStorageKey('banking-transactions', 'org-2'))).toEqual([]);
    expect(readSavedFilters('missing')).toEqual([]);
    localStorage.setItem(key, '{');
    expect(readSavedFilters(key)).toEqual([]);
  });

  it('reloads a saved banking filter for the same organization', () => {
    writeSavedFilters(savedFilterStorageKey('banking-transactions', 'org-1'), [
      { id: '1', name: 'Pending', value: { statusFilter: 'pending' }, updatedAt: '2026-10-03' },
    ]);
    const { result } = renderHook(() => useSavedFilters<{ statusFilter: string }>('banking-transactions', 'org-1'));
    expect(result.current.items.map((item) => item.name)).toEqual(['Pending']);
    expect(readSavedFilters(savedFilterStorageKey('banking-transactions', 'org-1'))).toHaveLength(1);
  });
});
