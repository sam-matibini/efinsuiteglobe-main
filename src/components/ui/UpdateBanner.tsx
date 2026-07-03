import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function clearAllCaches() {
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    // Clear Cache API
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    // Clear IndexedDB databases
    if ('indexedDB' in window && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); });
      } catch { /* not supported in all browsers */ }
    }
    // Clear localStorage cache keys
    const keysToRemove = ['sw-reload-ts', 'app-build-version', 'current_organization_id'];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (keysToRemove.includes(key) || key.startsWith('REACT_QUERY') || key.startsWith('tanstack'))) {
        localStorage.removeItem(key);
      }
    }
    // Clear sessionStorage
    sessionStorage.clear();
  } catch {
    // best-effort
  }
}

export { clearAllCaches };

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  const handleUpdate = useCallback(async () => {
    // Tell the waiting SW to activate immediately
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange handler in main.tsx will clear caches + reload
        return;
      }
    }
    // Fallback: no waiting SW, just clear and reload
    await clearAllCaches();
    window.location.reload();
  }, []);

  useEffect(() => {
    const showHandler = () => setVisible(true);
    window.addEventListener('sw-updated', showHandler);
    return () => window.removeEventListener('sw-updated', showHandler);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative z-50 flex items-center justify-between gap-3 bg-primary px-4 py-2 text-primary-foreground text-sm">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span>
          A new version is available. Click to update when you're ready.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 px-3 text-xs shrink-0"
        onClick={handleUpdate}
      >
        Update Now
      </Button>
    </div>
  );
}
