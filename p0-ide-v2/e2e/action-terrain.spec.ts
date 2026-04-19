import { test, expect } from "@playwright/test";

/**
 * Action Terrain — end-to-end sanity check.
 *
 * Covers the keyboard-driven entry/exit path and the backlog-panel
 * selection handshake. The feature gates behind `action-terrain.mode`
 * (defaultEnabled=false), so we pre-seed the feature-flags localStorage
 * key before the app boots. The canvas lives under the "Code Universe"
 * (workspace) tab, which is the 4th tab in the initial Shell loadout.
 *
 * If this spec fails at `waitFor("/.workspace-canvas")`, the most likely
 * reason is that the app couldn't boot (missing backend / scanner). In
 * that case see the Report in the infra PR — document the failure and
 * ship the harness anyway.
 */

const APP_PATH = "/ide/";
const FEATURE_FLAGS_STORAGE_KEY = "quanta.canvas.featureFlags.v2";
const WORKSPACE_TAB_INDEX = 3; // t1=demo, t2=ide, t3=ide, t4=workspace

test.describe("Action Terrain", () => {
  test.beforeEach(async ({ page }) => {
    // Pre-seed the feature flag BEFORE the app boots so Cmd+Shift+A is
    // live on the very first render (the handler gates on the flag).
    await page.addInitScript(
      ({ key }: { key: string }) => {
        try {
          const existing = window.localStorage.getItem(key);
          const parsed = existing ? JSON.parse(existing) : {};
          parsed["action-terrain.mode"] = true;
          window.localStorage.setItem(key, JSON.stringify(parsed));
        } catch {
          // Best-effort; if storage is unavailable the feature stays off
          // and the test will fail with a clear selector timeout.
        }
      },
      { key: FEATURE_FLAGS_STORAGE_KEY },
    );

    await page.goto(APP_PATH);
    await page.locator(".topbar__tab").first().waitFor({ state: "visible" });

    // Navigate to the Code Universe (workspace) tab. The canvas only
    // mounts while its tab is active.
    const tabs = page.locator(".topbar__tab");
    await tabs.nth(WORKSPACE_TAB_INDEX).click();

    // Wait for the canvas to render — the sample graph is embedded so no
    // network call is required, but layout is async (worker-scheduled).
    await page.locator(".workspace-canvas").waitFor({ state: "visible", timeout: 10_000 });
  });

  test("Cmd+Shift+A toggles Action Terrain and reveals the backlog", async ({ page }) => {
    const canvas = page.locator(".workspace-canvas");

    // Baseline: terrain is off after mount (the flag enables the mode
    // gate, but the mode itself starts off until the user toggles it).
    await expect(canvas).toHaveAttribute("data-action-terrain", "off");

    // Enter Action Terrain via the global chord.
    await page.keyboard.press("Meta+Shift+A");

    // Canvas attribute flips and the ROI panel mounts with at least one
    // row (the sample graph has enough files to produce ROI scores).
    await expect(canvas).toHaveAttribute("data-action-terrain", "on", { timeout: 5_000 });
    const panel = page.locator(".ws-roi-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });
    const rows = page.locator(".ws-roi-row");
    await expect(rows.first()).toBeVisible({ timeout: 5_000 });

    // Selecting a row highlights it. The row's clickable surface is the
    // inner `.ws-roi-row__main` button.
    const firstRow = rows.first();
    await firstRow.locator(".ws-roi-row__main").click();
    await expect(firstRow).toHaveClass(/ws-roi-row--selected/);

    // Exit Action Terrain — canvas attribute flips back to "off".
    await page.keyboard.press("Meta+Shift+A");
    await expect(canvas).toHaveAttribute("data-action-terrain", "off", { timeout: 5_000 });
  });
});
