## SEO plan for efinsuite Globe

Domain: **https://www.efinsuite.com/**

### 1. Sitewide head (`index.html`)
- Keep the current app-specific title and description.
- Update `og:url` to `https://www.efinsuite.com/`.
- Add `<link rel="canonical" href="https://www.efinsuite.com/" />` (sitewide fallback; per-route canonicals will override).
- Add sitewide **JSON-LD**:
  - `Organization` (name: efinsuite Globe, url, logo)
  - `SoftwareApplication` (applicationCategory: BusinessApplication, operatingSystem: Web)
- Keep existing OG image (already set to real Supabase-hosted banner).

### 2. Per-route metadata (`react-helmet-async`)
- Install `react-helmet-async`.
- Wrap app in `<HelmetProvider>` in `src/main.tsx`.
- Audit `src/App.tsx` routes and add `<Helmet>` blocks:
  - **Public / indexable** — landing page and any other marketing routes: unique title, description, canonical (self-referencing `https://www.efinsuite.com/<path>`), og:title, og:url.
  - **Private** — `/auth/*`, `/admin/*`, `/`, dashboard, app-internal pages: `<meta name="robots" content="noindex, nofollow" />` so the authenticated app isn't indexed.

### 3. Structured data on landing page
- `WebPage` + `BreadcrumbList` JSON-LD via Helmet on `/landing`.

### 4. Sitemap
- Create `scripts/generate-sitemap.ts` with `BASE_URL = "https://www.efinsuite.com"`.
- Add `predev` and `prebuild` npm scripts.
- Include only public, indexable routes (landing + any marketing pages). Exclude `/admin/*`, `/auth/*`, app-internal routes, `*` catch-all.

### 5. robots.txt
Update `public/robots.txt`:
- Keep `Allow: /` for main crawlers.
- Add `Disallow: /admin`, `Disallow: /auth`, and any other private path prefixes discovered in the route audit.
- Add `Sitemap: https://www.efinsuite.com/sitemap.xml`.

### 6. Accessibility / on-page SEO checks
- Spot-check landing page images have descriptive `alt` text.
- Confirm exactly one `<h1>` on the landing page.

### 7. Verification
- Run the SEO scanner after edits to confirm findings clear.
- Note: this is a Vite SPA — Googlebot executes JS and will see per-route Helmet tags, but Slack/LinkedIn/Facebook link-preview crawlers only see the static `index.html` OG tags (fine as a sitewide fallback). Full per-route social previews would require SSR — out of scope.

### Technical section
- **Created**: `scripts/generate-sitemap.ts`
- **Edited**: `index.html`, `public/robots.txt`, `src/main.tsx`, `src/App.tsx` (or per-route files) to add Helmet, `package.json` (dep + predev/prebuild)
- **Unchanged**: business logic, Supabase, styling

### Out of scope
- SSR migration
- Landing copy rewrites
- Google Search Console verification (can do as a follow-up)
