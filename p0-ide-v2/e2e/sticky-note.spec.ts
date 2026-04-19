import { test, expect } from "@playwright/test";
import { gotoCanvas } from "./helpers/canvas";

/**
 * Critical flow — sticky notes via shift+dblclick.
 *
 * `useCanvasInteractions` binds a dblclick listener on the canvas
 * container. With Shift held the handler computes world coords and
 * calls `stickiesStore.create(...)`, mounting a new `.ws-sticky` in
 * `StickiesLayer`. The newly-created sticky is auto-active, so its
 * `<textarea>` is focused and Esc deactivates it (without removing).
 *
 * NOTE: The debug HUD is open by default and floats over the top-right
 * of the canvas, so we dismiss it via its close button before
 * dblclicking to avoid the floating panel intercepting pointer events.
 * The keyboard shortcut Cmd+Shift+D *also* opens a new demo tab
 * (see `app-demo/seed.ts:demo.open`), so we can't rely on it to close
 * the HUD without side effects.
 */

async function closeDebugHud(page: import("@playwright/test").Page) {
  const panel = page.locator(".float-panel--hud").filter({ has: page.locator(".ws-debug__tabs") });
  if (await panel.isVisible().catch(() => false)) {
    await panel.locator(".float-panel__close").click();
    await expect(panel).not.toBeVisible({ timeout: 5_000 });
  }
}

test.describe("Sticky note creation", () => {
  test.beforeEach(async ({ page }) => {
    // Sticky creation is not gated on a feature flag (see
    // `use-canvas-interactions.ts:dblclick`), so no seeding is needed.
    await gotoCanvas(page);
    await closeDebugHud(page);
  });

  test("Shift+dblclick on empty canvas creates a sticky that survives Esc", async ({ page }) => {
    const canvas = page.locator(".workspace-canvas");
    await expect(canvas).toBeVisible();

    // Snapshot existing stickies — the canvas seeds one demo sticky on
    // first mount, so the delta (not the absolute count) is what we
    // care about.
    const stickies = page.locator(".ws-sticky");
    const initialCount = await stickies.count();

    const bbox = await canvas.boundingBox();
    if (!bbox) throw new Error("canvas boundingBox unavailable");
    // Aim for the top-left quadrant — the sample graph clusters files
    // toward the center at default zoom, leaving this corner empty.
    // Use a small pad from the edge to avoid scrollbars / borders.
    const localX = bbox.width * 0.12;
    const localY = bbox.height * 0.22;

    await canvas.dblclick({ position: { x: localX, y: localY }, modifiers: ["Shift"] });

    // A new sticky should have mounted.
    await expect(stickies).toHaveCount(initialCount + 1, { timeout: 5_000 });

    // The newest sticky is the active one; its textarea should be focused.
    const active = page.locator(".ws-sticky--active").last();
    await expect(active).toBeVisible();
    const textarea = active.locator(".ws-sticky__textarea");
    await expect(textarea).toBeFocused({ timeout: 5_000 });

    await textarea.fill("hello from e2e");
    await expect(textarea).toHaveValue("hello from e2e");

    // Esc should deactivate the sticky (remove the `--active` modifier)
    // without unmounting it.
    await textarea.press("Escape");
    await expect(page.locator(".ws-sticky--active")).toHaveCount(0, { timeout: 5_000 });
    await expect(stickies).toHaveCount(initialCount + 1);
  });
});
