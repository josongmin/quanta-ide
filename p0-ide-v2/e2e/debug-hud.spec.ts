import { test, expect } from "@playwright/test";
import { gotoCanvas } from "./helpers/canvas";

/**
 * Critical flow — debug HUD toggle + tab switching.
 *
 * `DebugHud` renders as a `FloatingPanel` (root
 * `.float-panel.float-panel--hud` containing `.ws-debug__tabs`). When
 * closed, a launcher button (`.ws-debug__launcher`) takes its place.
 * `debugHudOpen` defaults to `true`, so the panel is mounted on first
 * render.
 *
 * NOTE on Cmd+Shift+D: there's a chord conflict between the HUD toggle
 * (in `DebugHud.tsx`) and `app-demo`'s `demo.open` command (see
 * `app-demo/seed.ts`). Pressing `⌘⇧D` both closes the HUD *and* opens
 * a new "Try demo" tab, which ALSO switches focus off the workspace.
 * So this spec exercises the HUD toggle via the UI (close button +
 * launcher button) rather than the chord.
 */

test.describe("Debug HUD", () => {
  test.beforeEach(async ({ page }) => {
    await gotoCanvas(page);
  });

  test("close button hides the panel; tab click switches content", async ({ page }) => {
    const panel = page.locator(".float-panel--hud").filter({ has: page.locator(".ws-debug__tabs") });

    // Panel is open by default — default tab is `scene` (씬).
    await expect(panel).toBeVisible({ timeout: 5_000 });
    const subTabs = page.locator(".ws-debug__tabs [role='tab']");
    const sceneTab = subTabs.filter({ hasText: "씬" }).first();
    await expect(sceneTab).toHaveAttribute("aria-selected", "true");

    // Click the LOD tab and confirm selection moves.
    const lodTab = subTabs.filter({ hasText: "LOD" }).first();
    await lodTab.click();
    await expect(lodTab).toHaveAttribute("aria-selected", "true");
    await expect(sceneTab).toHaveAttribute("aria-selected", "false");

    // Click the FloatingPanel close button — the panel disappears and
    // is replaced by the `.ws-debug__launcher` badge.
    await panel.locator(".float-panel__close").click();
    await expect(panel).not.toBeVisible({ timeout: 5_000 });
    const launcher = page.locator(".ws-debug__launcher");
    await expect(launcher).toBeVisible({ timeout: 5_000 });

    // Click the launcher to reopen; panel re-mounts and the selected
    // sub-tab persists (LOD stays selected — `DebugHud` keeps its
    // `tab` useState across opens).
    await launcher.click();
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".ws-debug__tabs [role='tab']").filter({ hasText: "LOD" }).first())
      .toHaveAttribute("aria-selected", "true");
  });
});
