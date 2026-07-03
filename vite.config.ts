import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const buildTimestamp = Date.now().toString();

/** Vite plugin: writes version.json into the build output so the app can poll for updates */
function versionJsonPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(
          path.join(outDir, 'version.json'),
          JSON.stringify({ version: buildTimestamp }) + '\n'
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Inject real build timestamp so version-based cache-busting in main.tsx works
    __BUILD_TS__: JSON.stringify(buildTimestamp),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      injectRegister: false,
      includeAssets: ["favicon.png", "favicon.ico", "robots.txt"],
      manifest: {
        name: "efinsuite Globe - Accounting & Payroll",
        short_name: "efinsuite Globe",
        description: "Modern accounting and payroll software for Canadian businesses",
        theme_color: "#10b981",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Exclude html — index.html must never be precached (always fetch fresh)
        globPatterns: ["**/*.{js,css,ico,svg,woff2}"],
      },
    }),
    versionJsonPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
