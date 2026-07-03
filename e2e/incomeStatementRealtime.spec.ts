import { test, expect } from "@playwright/test";

/**
 * E2E: recategorizing a transaction updates the Income Statement totals in
 * real time, with no page refresh.
 *
 * This test runs against the dev server with VITE_E2E=1 (set automatically by
 * playwright.config.ts), which mounts a harness route at
 * /__e2e__/income-statement. The harness uses:
 *   - the real `useFinancialReportsRealtime` hook
 *   - the real React Query cache and invalidation flow
 *   - the real `RealtimeIndicator` component
 * but reads numbers from `window.__e2eFixture`, so we don't need a logged-in
 * user or seeded data.
 *
 * The hook exposes `window.__e2eTriggerReportsRefresh` (only when VITE_E2E=1)
 * which is the exact callback Supabase Realtime would invoke on a
 * postgres_changes event for `journal_entry_lines`. Calling it from the test
 * is functionally identical to the user recategorizing a bank transaction.
 *
 * Run locally: `npm run test:e2e`
 */
test.describe("Income Statement realtime recategorization", () => {
  test("totals update without a page reload after a simulated recategorization", async ({ page }) => {
    // Seed initial fixture before the app boots.
    await page.addInitScript(() => {
      (window as unknown as { __e2eFixture: { revenue: number; expenses: number } }).__e2eFixture = {
        revenue: 1000,
        expenses: 200,
      };
    });

    await page.goto("/__e2e__/income-statement");

    // Initial render: $1,000 revenue, $200 expenses, $800 net income.
    await expect(page.getByTestId("revenue")).toHaveText("$1000.00");
    await expect(page.getByTestId("expenses")).toHaveText("$200.00");
    await expect(page.getByTestId("net-income")).toHaveText("$800.00");

    // Confirm the realtime trigger is wired up by the hook.
    await expect
      .poll(async () => page.evaluate(() => typeof (window as unknown as { __e2eTriggerReportsRefresh?: () => void }).__e2eTriggerReportsRefresh))
      .toBe("function");

    // Capture the URL so we can assert no navigation/reload occurred.
    const urlBefore = page.url();
    const navigations: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });

    // Simulate the user recategorizing a $300 transaction from one expense
    // category into another and the resulting JE landing in the database:
    // expenses jump from $200 to $500, net income drops from $800 to $500.
    await page.evaluate(() => {
      (window as unknown as { __e2eFixture: { revenue: number; expenses: number } }).__e2eFixture = {
        revenue: 1000,
        expenses: 500,
      };
      (window as unknown as { __e2eTriggerReportsRefresh: () => void }).__e2eTriggerReportsRefresh();
    });

    // Auto-retrying assertions — they pass as soon as the React tree
    // re-renders with the refetched data, no manual reload needed.
    await expect(page.getByTestId("expenses")).toHaveText("$500.00");
    await expect(page.getByTestId("net-income")).toHaveText("$500.00");
    await expect(page.getByTestId("revenue")).toHaveText("$1000.00");

    // Negative control: the URL must not have changed and no navigation
    // event must have fired during the update.
    expect(page.url()).toBe(urlBefore);
    expect(navigations).toEqual([]);
  });
});
