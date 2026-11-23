import { useEffect, useRef, useState } from 'react';
import {
  deleteSavedFilter,
  readSavedFilters,
  savedFilterStorageKey,
  upsertSavedFilter,
  writeSavedFilters,
  type SavedFilter,
} from '@/lib/savedFilters';

export function useSavedFilters<T extends object>(scope: string, organizationId?: string | null) {
  const storageKey = savedFilterStorageKey(scope, organizationId);
  const [items, setItems] = useState<SavedFilter<T>[]>([]);
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    setItems(readSavedFilters<T>(storageKey));
    loadedKey.current = null;
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey.current !== storageKey) {
      loadedKey.current = storageKey;
      return;
    }
    writeSavedFilters(storageKey, items);
  }, [items, storageKey]);

  const save = (name: string, value: T) => {
    const result = upsertSavedFilter(items, name, value);
    if (result.saved) setItems(result.items);
    return result;
  };

  const remove = (id: string) => {
    setItems((current) => deleteSavedFilter(current, id));
  };

  return { items, save, remove };
}
