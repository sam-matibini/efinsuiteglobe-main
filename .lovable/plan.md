## Remove the "A new version is available" update banner

The dark banner at the top of the app ("A new version is available. Click to update when you're ready." with an "Update Now" button) is no longer useful and will be removed entirely.

### Changes

1. **`src/components/layout/AppLayout.tsx`** — remove the `<UpdateBanner />` render and its import so the banner no longer appears on any authenticated page.

2. **`src/main.tsx`** — remove any `UpdateBanner`-related bootstrapping/import (service-worker update prompt wiring tied to the banner) so nothing tries to trigger it.

3. **`src/pages/ClearCache.tsx`** — this page imports `clearAllCaches` from `UpdateBanner`. Preserve the cache-clearing behavior by either:
   - inlining the small `clearAllCaches` helper directly into `ClearCache.tsx`, or
   - moving it to a tiny utility file (`src/lib/clearAllCaches.ts`) and updating the import.

4. **`src/components/ui/UpdateBanner.tsx`** — delete the file once nothing imports it.

### Out of scope

- The service worker itself (`public/sw.js`) and the Troubleshooting tab's "Check for Updates" / "Clear Cache & Reload" buttons stay untouched — users can still force an update manually from Settings.
- No visual changes elsewhere; the top of the app simply no longer has the dark banner strip.
