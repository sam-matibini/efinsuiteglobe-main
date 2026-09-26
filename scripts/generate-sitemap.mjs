// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://www.efinsuite.com";
const today = new Date().toISOString().split("T")[0];

const entries = [
  { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/landing", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/security", lastmod: today, changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-service", lastmod: today, changefreq: "yearly", priority: "0.3" },
];

function generateSitemap(items) {
  const urls = items.map((entry) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${entry.path}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
