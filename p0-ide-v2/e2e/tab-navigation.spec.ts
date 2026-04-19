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

  test("app loads with 4 initial tabs", async ({ page }) => {
    // Shell currently seeds 4 tabs: demo + order-service + payment-service
    // + Code Universe. Previously 2, but the shell config grew two more
    // tabs during the Code Universe + demo integration.
    const tabs = page.locator(".topbar__tab");
    await expect(tabs).toHaveCount(4);
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
    const tabs = page.locator(".topbar__tab");
    const initial = await tabs.count();

    const addBtn = page.locator(".topbar__tab-add");
    await addBtn.click();

    await expect(tabs).toHaveCount(initial + 1);
  });

  test("close tab removes it from topbar", async ({ page }) => {
    const tabs = page.locator(".topbar__tab");
    const initial = await tabs.count();

    const firstTabClose = tabs.first().locator(".topbar__tab-close");
    await firstTabClose.click();

    await expect(tabs).toHaveCount(initial - 1, { timeout: 5_000 });
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
