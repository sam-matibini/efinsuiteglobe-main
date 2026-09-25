// Production-Grade Service Worker for efinsuite Globe
// Accounting software: financial data is NEVER cached
// JS/CSS bundles are NEVER cached to prevent stale-code regressions

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Legacy cache names to purge on activate
const LEGACY_CACHES = ['bundle-cache-v3', 'bundle-cache-v2', 'bundle-cache', 'nav-cache-v2', 'nav-cache'];

self.addEventListener('install', () => {
  // Do NOT call self.skipWaiting() — let the user decide when to activate the new SW
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => LEGACY_CACHES.includes(name) || name.startsWith('bundle-'))
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message from the app to force-activate a waiting SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Precache only static assets (no index.html — always fetch fresh)
precacheAndRoute(self.__WB_MANIFEST || []);

// ── 1. FINANCIAL / API DATA — NEVER CACHE ─────────────────────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/storage/') ||
    url.pathname.startsWith('/realtime/'),
  new NetworkOnly()
);

// ── 1b. VERSION FILE — NEVER CACHE ────────────────────────────────────────
registerRoute(
  ({ url }) => url.pathname === '/version.json',
  new NetworkOnly()
);

// ── 2. SPA NAVIGATION — NEVER CACHE (always fetch fresh shell) ────────────
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly()
);

// ── 3. JS / CSS BUNDLES — NEVER CACHE ─────────────────────────────────────
// This prevents stale-code regressions permanently.
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new NetworkOnly()
);

// ── 4. IMAGES — StaleWhileRevalidate (logos, avatars, flags) ───────────────
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'image-cache-v2',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 2592000 }),
    ],
  })
);

// ── 5. GOOGLE FONTS — CacheFirst (never changes) ───────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache-v2',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 })],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache-v2',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31536000 })],
  })
);
