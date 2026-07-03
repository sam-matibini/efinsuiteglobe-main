import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the efinsuite SPA.
 *
 * Boots a dedicated Vite dev server on port 8090 with VITE_E2E=1 so the E2E
 * harness route is registered, then runs the suite in Chromium.
 *
 * Run with: `npm run test:e2e` (or `bun run test:e2e`).
 * Inside the Lovable sandbox, set PLAYWRIGHT_CHROMIUM_PATH=/bin/chromium to
 * use the system browser instead of the bundled one.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8090",
    trace: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : undefined,
      },
    },
  ],
  webServer: {
    // Dedicated port so we don't collide with the always-on dev server
    // (which runs without VITE_E2E and therefore doesn't expose the harness route).
    command: "vite --port 8090 --strictPort",
    url: "http://localhost:8090/__e2e__/income-statement",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_E2E: "1" },
  },
});
