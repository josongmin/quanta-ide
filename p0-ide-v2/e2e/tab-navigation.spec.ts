import { test, expect } from "@playwright/test";

/**
 * Critical flow 1 — Tab navigation.
 *
 * The shell boots with two hardcoded IDE tabs ("order-service", "payment-service").
 * This suite verifies tab CRUD and the Home toggle, which are the most fundamental
 * interactions a user performs.
 */

const APP_PATH = "/ide/";

test.describe("Tab navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_PATH);
    // Wait for shell to render topbar tabs.
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });
  });

  test("app loads with 2 initial IDE tabs", async ({ page }) => {
    const tabs = page.locator(".topbar__tab");
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toContainText("order-service");
    await expect(tabs.nth(1)).toContainText("payment-service");
  });

  test("first tab is active by default", async ({ page }) => {
    const firstTab = page.locator(".topbar__tab").first();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking a tab switches active content", async ({ page }) => {
    const tabs = page.locator(".topbar__tab");
    const secondTab = tabs.nth(1);

    // Second tab should not be active initially.
    await expect(secondTab).toHaveAttribute("aria-selected", "false");

    await secondTab.click();

    // After click, second tab becomes active, first becomes inactive.
    await expect(secondTab).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
  });

  test("add new tab via + button", async ({ page }) => {
    const addBtn = page.locator(".topbar__tab-add");
    await addBtn.click();

    const tabs = page.locator(".topbar__tab");
    await expect(tabs).toHaveCount(3);
  });

  test("close tab removes it from topbar", async ({ page }) => {
    // Start with 2 tabs. Close the first one.
    const firstTabClose = page.locator(".topbar__tab").first().locator(".topbar__tab-close");
    await firstTabClose.click();

    // After the close animation settles, only 1 tab remains.
    await expect(page.locator(".topbar__tab")).toHaveCount(1, { timeout: 5_000 });
  });

  test("home button shows home page", async ({ page }) => {
    const homeBtn = page.locator(".topbar__home");
    await homeBtn.click();

    // Home button should be active.
    await expect(homeBtn).toHaveClass(/is-active/);

    // Home page content should be visible.
    await expect(page.locator(".home-page")).toBeVisible();
  });
});
