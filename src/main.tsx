import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";


// ── Version-based update detection (user-initiated only) ───────────────────
const APP_BUILD_VERSION = '__BUILD_TS__' + import.meta.env.MODE;
let updatePending = false;

// Store current version on boot (no forced reload)
localStorage.setItem('app-build-version', APP_BUILD_VERSION);

// ── Service Worker lifecycle management ────────────────────────────────────
if ('serviceWorker' in navigator) {
  // When a new SW takes control, purge all caches and reload for a clean slate
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (refreshing) return;
    refreshing = true;
    // Dynamic import to avoid circular dependency
    const { clearAllCaches } = await import('@/components/ui/UpdateBanner');
    await clearAllCaches();
    window.location.reload();
  });

  // Detect waiting SW but do NOT force-activate it
  navigator.serviceWorker.ready.then((registration) => {
    if (registration.waiting) {
      updatePending = true;
      window.dispatchEvent(new CustomEvent('sw-updated'));
    }
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed — notify user, but do NOT skip waiting
            updatePending = true;
            window.dispatchEvent(new CustomEvent('sw-updated'));
          }
        });
      }
    });
  });
}

// ── Periodic version polling (every 5 minutes) ────────────────────────────
async function checkForUpdates() {
  try {
    const res = await fetch('/version.json', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const serverVersion = data.version + import.meta.env.MODE;
    if (serverVersion !== APP_BUILD_VERSION) {
      updatePending = true;
      window.dispatchEvent(new CustomEvent('sw-updated'));
      // Trigger SW update check (but don't force-activate)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.update().catch(() => {});
      }
    }
  } catch {
    // Network error — skip this cycle
  }
}

// Poll every 5 minutes
setInterval(checkForUpdates, 5 * 60 * 1000);

// Check when user returns to the tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForUpdates();
  }
});

// Expose update state (read-only, no auto-apply)
(window as any).__isUpdatePending = () => updatePending;

// ── Manual cache-clear utility for debugging ───────────────────────────────
(window as any).__clearAppCache = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
    localStorage.removeItem('sw-reload-ts');
    localStorage.removeItem('app-build-version');
    console.info('All caches cleared, reloading...');
    window.location.reload();
  } catch (e) {
    console.error('Cache clear failed:', e);
  }
};

// ── Render ──────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

