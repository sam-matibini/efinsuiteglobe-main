## Problem

`src/components/docsign/PdfPageRenderer.tsx` sets:
```
workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
```

pdfjs-dist is at v4.7.76, which no longer ships `pdf.worker.min.js` — only `pdf.worker.min.mjs`. The cdnjs `.js` URL returns 404, causing the "Failed to fetch dynamically imported module" runtime error visible in the E-Sign preview.

## Fix

Bundle the worker with Vite instead of relying on a CDN — no version drift, no network dependency.

In `src/components/docsign/PdfPageRenderer.tsx`:

```ts
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
```

Vite serves the worker as an ES module asset with the correct MIME type, and it always matches the installed pdfjs-dist version.

Leave the `cMapUrl` alone (cmaps at v3.11.174 still resolve fine on cdnjs) unless another failure surfaces.

No other files need changes.
