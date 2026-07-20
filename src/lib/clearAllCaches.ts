// Utility to fully purge SW registrations, Cache API, IndexedDB, and
// cache-related storage keys. Best-effort; never throws.
export async function clearAllCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    if ('indexedDB' in window && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      } catch {
        /* not supported in all browsers */
      }
    }
    const keysToRemove = ['sw-reload-ts', 'app-build-version', 'current_organization_id'];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (keysToRemove.includes(key) || key.startsWith('REACT_QUERY') || key.startsWith('tanstack'))) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
  } catch {
    // best-effort
  }
}
