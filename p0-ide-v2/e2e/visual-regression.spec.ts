import { test, expect, type Page } from "@playwright/test";
import { gotoCanvas } from "./helpers/canvas";

/**
 * Close the debug HUD if it's open. The HUD floats over the top-right
 * of the canvas and would dominate any screenshot we take — diffs
 * would be driven by HUD timestamps / FPS counters rather than the
 * actual visual state we care about.
 */
async function closeDebugHud(page: Page): Promise<void> {
  const panel = page.locator(".float-panel--hud").filter({ has: page.locator(".ws-debug__tabs") });
  if (await panel.isVisible().catch(() => false)) {
    await panel.locator(".float-panel__close").click();
    await expect(panel).not.toBeVisible({ timeout: 5_000 });
  }
}

/**
 * Visual regression baselines — 3 deterministic canvas snapshots.
 *
 * Playwright's `toHaveScreenshot()` saves a baseline on first run (the
 * call exits non-zero with "A snapshot doesn't exist at <path>"). To
 * commit the baseline, run:
 *
 *   bunx playwright test e2e/visual-regression.spec.ts --update-snapshots
 *
 * On subsequent runs Playwright diffs the live render against the
 * baseline and we tolerate up to 2% pixel drift via `maxDiffPixelRatio`
 * to absorb font-rendering + anti-aliasing noise between machines.
 */

test.describe("Visual regression", () => {
  test.beforeEach(async ({ page }) => {
    // Reduced-motion kills CSS transitions + framer-motion animations,
    // which is the single biggest source of flakiness for raster diffs.
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Pin the viewport so every baseline is rendered at the same size.
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("empty canvas in default state", async ({ page }) => {
    await gotoCanvas(page);

    const canvas = page.locator(".workspace-canvas");
    await expect(canvas).toBeVisible();

    // Small settle window — the canvas layout is worker-scheduled, so
    // we wait for the first file card to mount before snapshotting.
    // Wait for the stickies overlay (a DOM layer that mounts once the
    // canvas layout is ready) — file cards themselves are drawn via
    // PixiJS onto a <canvas>, so there's no per-card DOM node we could
    // wait on. Stickies-layer serves as a stable proxy for "canvas is
    // laid out."
    await page.locator(".workspace-canvas__stickies-layer").waitFor({ state: "attached", timeout: 15_000 });
    // Brief settle for worker-scheduled layout + fonts.
    await page.waitForTimeout(500);
    await closeDebugHud(page);

    await expect(page).toHaveScreenshot("canvas-default.png", {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  });
});
