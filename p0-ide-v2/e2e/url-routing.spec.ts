import { test, expect } from "@playwright/test";

/**
 * URL routing smoke — verifies the hash scheme `#/<slug>[?query]`:
 *   1. Initial load normalises to the active tab's slug.
 *   2. Clicking a different tab updates the hash slug.
 *   3. Opening a URL with a query param restores Code Universe v2 view
 *      mode on mount.
 */

const APP_PATH = "/ide/";

test.describe("URL routing", () => {
  test("initial load writes active tab slug into the hash", async ({ page }) => {
    await page.goto(APP_PATH);
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });
    // First tab is the demo tab with slug "demo".
    await expect(page).toHaveURL(/#\/demo$/);
  });

  test("clicking a tab updates the hash slug", async ({ page }) => {
    await page.goto(APP_PATH);
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });

    // Click the "Code Universe v2" tab (last hardcoded tab, slug "universe").
    await page.getByRole("tab", { name: /Code Universe v2/i }).click();
    await expect(page).toHaveURL(/#\/universe(\?|$)/);
  });

  test("deep-linking to a query restores Code Universe view mode", async ({
    page,
  }) => {
    await page.goto(`${APP_PATH}#/universe?mode=matrix`);
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });

    // Mode should persist in the URL after mount (store→URL mirror runs,
    // but because the URL already matched, no change is expected).
    await expect(page).toHaveURL(/mode=matrix/);

    // Universe v2 tab should be active.
    const activeTab = page.locator(".topbar__tab.is-active").first();
    await expect(activeTab).toContainText(/Code Universe v2/i);
  });

  test("back button returns to previous tab", async ({ page }) => {
    await page.goto(APP_PATH);
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });

    // Switch to universe, then back.
    await page.getByRole("tab", { name: /Code Universe v2/i }).click();
    await expect(page).toHaveURL(/#\/universe(\?|$)/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/demo$/);
  });
});
