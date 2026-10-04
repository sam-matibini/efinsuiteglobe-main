import { useEffect, useState } from 'react';
import {
  deleteSavedStatementSort,
  readActiveStatementSort,
  readSavedStatementSorts,
  upsertSavedStatementSort,
  writeActiveStatementSort,
  writeSavedStatementSorts,
  type SavedStatementSort,
  type StatementSortCriteria,
} from '@/lib/reports/statementSort';

export function useStatementSort(organizationId?: string | null) {
  const [criteria, setCriteria] = useState<StatementSortCriteria>(() => readActiveStatementSort(organizationId));
  const [saved, setSaved] = useState<SavedStatementSort[]>(() => readSavedStatementSorts(organizationId));

  useEffect(() => {
    setCriteria(readActiveStatementSort(organizationId));
    setSaved(readSavedStatementSorts(organizationId));
  }, [organizationId]);

  const setSort = (next: StatementSortCriteria) => {
    setCriteria(next);
    writeActiveStatementSort(organizationId, next);
  };

  const updateSection = (section: 'revenue' | 'expense', patch: Partial<StatementSortCriteria['revenue']>) => {
    setSort({ ...criteria, [section]: { ...criteria[section], ...patch } });
  };

  const save = (name: string) => {
    const result = upsertSavedStatementSort(saved, name, criteria);
    if (result.saved) {
      setSaved(result.items);
      writeSavedStatementSorts(organizationId, result.items);
      writeActiveStatementSort(organizationId, criteria);
    }
    return result;
  };

  const apply = (item: SavedStatementSort) => {
    setSort(item.value);
  };

  const remove = (id: string) => {
    const next = deleteSavedStatementSort(saved, id);
    setSaved(next);
    writeSavedStatementSorts(organizationId, next);
  };

  return { criteria, setSort, updateSection, saved, save, apply, remove };
}
