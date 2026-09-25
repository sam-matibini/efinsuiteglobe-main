import { Settings, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

/**
 * TroubleshootingTab — self-contained component.
 *
 * Intentionally kept in its own file so it is never accidentally dropped
 * when AdminSettings.tsx or Settings.tsx are edited. Both pages import this
 * single component; all cache-clearing logic lives here and nowhere else.
 */
export function TroubleshootingTab() {
  const buildLabel = (() => {
    const ts = (globalThis as Record<string, unknown>)['__BUILD_TS__'] as string | undefined;
    if (!ts || ts === '__BUILD_TS__') return 'Development';
    const n = parseInt(ts, 10);
    return isNaN(n) ? ts : new Date(n).toUTCString().replace(' GMT', ' UTC');
  })();

  const handleCheckForUpdates = async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        toast.info('Service workers are not supported in this browser.');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          toast.success("A new version is ready! Use 'Clear Cache & Reload' or click Update Now in the banner.");
        } else {
          toast.info("You are already on the latest version.");
        }
      } else {
        toast.info("No service worker registered — you're running the latest version.");
      }
    } catch {
      toast.error('Update check failed.');
    }
  };

  const handleClearCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      localStorage.removeItem('sw-reload-ts');
      localStorage.removeItem('app-build-version');
      toast.success('Cache cleared. Reloading…');
      setTimeout(() => window.location.reload(), 500);
    } catch {
      toast.error('Failed to clear cache. Please try a hard refresh (Ctrl+Shift+R).');
    }
  };

  return (
    <div className="space-y-4">
      {/* App Version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            App Version
          </CardTitle>
          <CardDescription>
            Current build deployed to your browser. If this doesn't match the latest release, clear the cache below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-mono text-muted-foreground">
            Build: {buildLabel}
          </div>
        </CardContent>
      </Card>

      {/* Check for Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Check for Updates
          </CardTitle>
          <CardDescription>
            Asks the browser to check if a newer version of the platform is available. If one is found, a notification banner will appear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleCheckForUpdates}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Check for Updates
          </Button>
        </CardContent>
      </Card>

      {/* Clear Cache & Reload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Clear Cache &amp; Reload
              </CardTitle>
              <CardDescription>
                Force a fresh download of all application files. Use this if features are missing or the app is behaving unexpectedly.{' '}
                Financial data stored in the cloud is <strong>never</strong> affected — only the local browser cache is cleared.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 text-warning text-sm font-medium shrink-0">
              <AlertTriangle className="w-4 h-4" />
              Caution
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearCache}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Cache &amp; Reload
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
