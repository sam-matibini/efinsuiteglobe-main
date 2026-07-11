# Performance Optimization — Scoped to (1) + (2) + (5)

Focus: shrink initial JS on `/landing` and every first paint by an estimated 70%+ via route-level code splitting, isolating heavy dependencies, and clean vendor chunking.

## 1. Route-level code splitting in `src/App.tsx`

- Convert all 104 page imports to `React.lazy(() => import(...))`.
- Keep eager: `Landing`, `NotFound`, `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `Index` (dashboard shell — evaluate; likely lazy too).
- Wrap the top-level `<Routes>` in `<Suspense fallback={<FullPageLoader />}>` using a lightweight spinner component (no new deps).
- Preserve all existing guards (`AdminRoute`, `PermissionGate`, `AppLayout` wrappers) — they wrap lazy children transparently.
- Do not touch route paths, order, or auth logic.

## 2. Isolate heavy dependencies behind their routes

After (1), the following libs should only load on demand. Audit each and convert top-level imports to dynamic `import()` at the call site where they're used inside event handlers or one-shot flows (not on component mount of a hot page):

- `pdfjs-dist` — `src/components/docsign/PdfPageRenderer.tsx` already loads inside a component; leave as-is since it's only rendered on DocSign routes (route-splitting handles it). Confirm no other module top-level-imports it.
- `pdf-lib`, `jspdf`, `jspdf-autotable` — used by PDF generators in `src/lib/generate*Pdf.ts` and `src/lib/print/*`. Convert their consumers to `await import(...)` inside the "Download PDF" click handler so PDF code never ships until the user prints/exports.
- `docx`, `jszip` — same pattern: dynamic-import inside export handlers.
- `recharts` — used across dashboards/reports; route-splitting covers it. Add to a `charts` manual chunk (see §5) so hitting one report doesn't repull it on another.
- `@twilio/voice-sdk` — should only load on `CommunicationHub`. Verify via grep; if imported at module top-level anywhere else, dynamic-import it inside the "Start call" handler.
- `react-plaid-link` — only on bank-connect flow; verify same.
- `embla-carousel-react`, `jsbarcode` — verify they're only in their respective route trees.

Scope of edits in (2): only change `import` → dynamic `import()` at the top of files whose imports leak into pre-auth or landing chunks. No behavior changes.

## 5. Vendor chunk splitting in `vite.config.ts`

Add `build.rollupOptions.output.manualChunks` to keep vendor cache stable and prevent one chunk from ballooning:

```ts
manualChunks: (id) => {
  if (!id.includes('node_modules')) return;
  if (/react-dom|react-router|scheduler|^react\//.test(id)) return 'react';
  if (id.includes('@radix-ui')) return 'radix';
  if (id.includes('recharts') || id.includes('d3-')) return 'charts';
  if (/(pdf-lib|pdfjs-dist|jspdf|jspdf-autotable)/.test(id)) return 'pdf';
  if (id.includes('@supabase') || id.includes('@tanstack')) return 'data';
  if (id.includes('docx') || id.includes('jszip')) return 'docs';
}
```

Also raise `build.chunkSizeWarningLimit` to 800 to silence noise on legitimately large chunks (pdf, charts).

## Out of scope for this pass

- Image formats / LCP preload (item 3).
- React Query defaults (item 4).
- Service worker precache trimming (item 6).
- Any Landing.tsx visual/motion changes.
- Moving `@testing-library/*` and `jsdom` to devDependencies (safe change but skipped per scope).

## Verification

1. `bunx vite build` before → record `dist/assets/*.js` sizes for landing entry.
2. Apply changes.
3. `bunx tsgo --noEmit` clean.
4. `bunx vite build` after → confirm landing entry chunk is dramatically smaller and `pdf`/`charts`/`docs` chunks exist and are NOT loaded on `/landing`.
5. Playwright cold-load `/landing` at 1280×1800: capture network waterfall, count JS bytes. Screenshot to confirm no visual regression.
6. Smoke-nav to 5 representative routes (`/dashboard`, `/invoices`, `/reports/income-statement`, `/docsign`, `/banking-payments`) to confirm Suspense fallback works and no import cycles broke.

Approve to switch to build mode and implement.
