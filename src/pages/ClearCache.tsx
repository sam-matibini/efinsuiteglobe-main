import { useEffect } from 'react';
import { clearAllCaches } from '@/lib/clearAllCaches';

/**
 * Standalone cache-clear page. Navigate to /clear-cache to force a full
 * cache purge. Supports ?redirect=/path to return users to their previous page.
 */
export default function ClearCache() {
  useEffect(() => {
    (async () => {
      await clearAllCaches();
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/';
      window.location.replace(redirect);
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      <p className="text-muted-foreground text-sm">Clearing cache…</p>
    </div>
  );
}
