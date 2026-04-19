import { test, expect } from "@playwright/test";
import { gotoCanvas } from "./helpers/canvas";

/**
 * Regression — Code Universe debug kill-switch never survives a tab
 * re-entry, and the banner rescue surface lets the user escape a pin
 * manually.
 *
 * The shell keeps every tab mounted under `display: none` (see
 * `packages/shell/src/TabRenderer.tsx`), so "mount-only" resets only
 * fire on the very first mount of the app. Before the
 * `useTabFocus(isActive, resetDebugKnobs)` fix, a pinned `forceLod`
 * (most painfully "ground") would silently survive every tab switch
 * and the canvas would look frozen on return because `GroundCard`
 * DOM-renders every visible file.
 *
 * This spec covers both fallback paths:
 *   1. Automatic reset on tab re-entry (structural fix).
 *   2. Manual reset via the banner's "해제" button (user-facing escape
 *      hatch that works even if someone breaks the re-entry reset).
 *
 * The LOD force chips live in the `LOD` sub-tab of the debug HUD
 * (`LodSection.tsx`). Two other debug sub-tabs also use
 * `.ws-debug__chip`; we scope to the LOD section via the short code
 * labels ("grd" for ground, "aut" for auto).
 */

test.describe("forceLod resets on Code Universe re-entry", () => {
  test.beforeEach(async ({ page }) => {
    await gotoCanvas(page);
  });

  test("pinning ground then switching tabs and back auto-resets to auto", async ({ page }) => {
    // Panel defaults to open; switch to the LOD sub-tab.
    const lodTab = page.locator(".ws-debug__tabs [role='tab']").filter({ hasText: "LOD" }).first();
    await lodTab.click();
    await expect(lodTab).toHaveAttribute("aria-selected", "true");

    // Pin ground. The chip row sits inside `.ws-debug__lod`; scope the
    // `.ws-debug__chip` selector to avoid colliding with other sections.
    const lodChips = page.locator(".ws-debug__lod .ws-debug__chip");
    const grdChip = lodChips.filter({ hasText: "grd" }).first();
    await grdChip.click();

    // Banner surfaces the pinned state.
    const banner = page.locator(".ws-killswitch-banner");
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(banner).toContainText("LOD=ground");

    // Switch to a sibling tab (tab index 0 — "order-service"). MultiFileCanvas
    // stays mounted behind display:none; `isActive` flips to false. Then
    // switch back — `isActive` false → true fires the useTabFocus callback
    // which calls `debugSettingsStore.resetDebugKnobs()`.
    const tabs = page.locator(".topbar__tab");
    await tabs.nth(0).click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    await tabs.nth(3).click(); // Code Universe (see e2e/helpers/canvas.ts)
    await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");

    // On re-entry the banner disappears — forceLod has snapped back to auto.
    await expect(banner).not.toBeVisible({ timeout: 5_000 });
  });

  test("banner '해제' button clears pinned ground without tab switching", async ({ page }) => {
    const lodTab = page.locator(".ws-debug__tabs [role='tab']").filter({ hasText: "LOD" }).first();
    await lodTab.click();

    const lodChips = page.locator(".ws-debug__lod .ws-debug__chip");
    await lodChips.filter({ hasText: "grd" }).first().click();

    const banner = page.locator(".ws-killswitch-banner");
    await expect(banner).toBeVisible({ timeout: 5_000 });

    // Click the banner's reset button.
    await banner.locator(".ws-killswitch-banner__btn").click();

    // Banner unmounts itself (forceLod === "auto" && !freezeScene).
    await expect(banner).not.toBeVisible({ timeout: 5_000 });

    // The "aut" (auto) chip in the LOD row becomes the active selection
    // (`is-on` class). Verifying via the HUD chip lets us catch a silent
    // regression where the banner hides but forceLod isn't actually
    // reset in the store.
    const autChip = lodChips.filter({ hasText: "aut" }).first();
    await expect(autChip).toHaveClass(/is-on/);
  });
});
