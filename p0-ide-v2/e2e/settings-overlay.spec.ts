import { test, expect } from "@playwright/test";

/**
 * Critical flow 3 — Settings overlay (Feature Control Plane).
 *
 * Settings opens via the gear icon in the topbar utilities. It renders the
 * full feature registry with a search bar and category navigation. This
 * suite tests open/close and basic content rendering.
 */

const APP_PATH = "/ide/";

test.describe("Settings overlay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_PATH);
    await page.locator(".topbar").waitFor({ state: "visible" });
  });

  test("settings icon opens settings page", async ({ page }) => {
    // Settings page should not be visible initially.
    await expect(page.locator(".settings-page")).not.toBeVisible();

    // Click the settings button (identified by its aria-label "Settings (Cmd+,)").
    const settingsBtn = page.locator('button[aria-label="Settings (⌘,)"]');
    await settingsBtn.click();

    // Settings page should now be visible.
    await expect(page.locator(".settings-page")).toBeVisible();
  });

  test("settings page renders feature list", async ({ page }) => {
    // Open settings.
    const settingsBtn = page.locator('button[aria-label="Settings (⌘,)"]');
    await settingsBtn.click();
    await page.locator(".settings-page").waitFor({ state: "visible" });

    // The hero title should be present.
    await expect(page.locator(".settings-hero__title")).toBeVisible();

    // The feature list (or empty state) should exist.
    const featureList = page.locator(".settings-feature-list");
    const emptyState = page.locator(".settings-empty");
    const hasFeatures = await featureList.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    // At least one of them should be present — the page rendered its body.
    expect(hasFeatures || hasEmpty).toBeTruthy();
  });

  test("Escape from settings returns to active tab", async ({ page }) => {
    // Open settings.
    const settingsBtn = page.locator('button[aria-label="Settings (⌘,)"]');
    await settingsBtn.click();
    await page.locator(".settings-page").waitFor({ state: "visible" });

    // Press Escape to close settings.
    await page.keyboard.press("Escape");

    // Settings page should disappear.
    await expect(page.locator(".settings-page")).not.toBeVisible();

    // A tab should be active again (first tab).
    const firstTab = page.locator(".topbar__tab").first();
    await expect(firstTab).toHaveAttribute("aria-selected", "true");
  });
});
