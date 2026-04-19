import { test, expect } from "@playwright/test";
import { seedFeatureFlags } from "./helpers/feature-flags";
import { gotoCanvas } from "./helpers/canvas";

/**
 * Critical flow — multi-select lasso (`power.lasso`).
 *
 * The lasso gates behind `power.lasso` (defaultEnabled=false), so we
 * pre-seed the flag. The overlay installs a capture-phase pointerdown
 * listener on `.workspace-canvas`; Shift+drag from empty space renders
 * `.ws-lasso` and, on release, flips the multi-selection-store to the
 * containing file ids. A non-empty selection mounts `.ws-bulk-toolbar`.
 */

test.describe("Lasso multi-select", () => {
  test.beforeEach(async ({ page }) => {
    await seedFeatureFlags(page, { "power.lasso": true });
    await gotoCanvas(page);
  });

  test("Shift+drag on empty canvas renders lasso overlay and bulk toolbar", async ({ page }) => {
    const canvas = page.locator(".workspace-canvas");
    await expect(canvas).toBeVisible();

    // Bulk toolbar is absent before any selection.
    await expect(page.locator(".ws-bulk-toolbar")).not.toBeVisible();

    // Drag across nearly the full canvas — the sample graph is laid out
    // at default zoom so that at least one file-card center sits in the
    // ~90%-wide rect. The lasso uses *center-point* containment, so the
    // box must envelope card centers (not just any edge). An
    // almost-fullscreen diagonal drag is the most reliable way to catch
    // at least one card regardless of the current viewport transform.
    //
    // Close the debug HUD first so it doesn't block the right-half of
    // the canvas from receiving the capture-phase pointerdown. We click
    // the panel's close button rather than pressing Cmd+Shift+D because
    // that chord ALSO opens a "Try demo" tab (see `app-demo/seed.ts`
    // — chord conflict between debug HUD and `demo.open`).
    const hud = page.locator(".float-panel--hud").filter({ has: page.locator(".ws-debug__tabs") });
    if (await hud.isVisible().catch(() => false)) {
      await hud.locator(".float-panel__close").click();
      await expect(hud).not.toBeVisible({ timeout: 5_000 });
    }

    const bbox = await canvas.boundingBox();
    if (!bbox) throw new Error("canvas boundingBox unavailable");

    const startX = bbox.x + bbox.width * 0.05;
    const startY = bbox.y + bbox.height * 0.08;
    const endX = bbox.x + bbox.width * 0.95;
    const endY = bbox.y + bbox.height * 0.92;

    // Press Shift first so the keydown is observed by both the React
    // shortcut layer and the capture-phase pointer handler. Then drag.
    await page.keyboard.down("Shift");
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: "left" });
    // Move in a couple of steps so React re-renders the overlay at
    // least once — a single hop can skip straight to mouseup before
    // the overlay paints.
    await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 5 });

    // Overlay should appear while the drag is in progress.
    await expect(page.locator(".ws-lasso")).toBeVisible({ timeout: 5_000 });

    // Finish the drag and release Shift.
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up({ button: "left" });
    await page.keyboard.up("Shift");

    // After release the overlay self-clears and the bulk toolbar mounts
    // iff the selection is non-empty. The sample graph packs enough
    // files into the default viewport that a near-full-canvas drag will
    // always capture at least one.
    const toolbar = page.locator(".ws-bulk-toolbar");
    await expect(toolbar).toBeVisible({ timeout: 5_000 });
    await expect(toolbar.locator(".ws-bulk-toolbar__count")).toContainText(/\d+ selected/);
  });
});
