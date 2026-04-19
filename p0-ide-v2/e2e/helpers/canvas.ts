import type { Page } from "@playwright/test";

const APP_PATH = "/ide/";

// Shell boots with: t0=order-service (ide), t1=payment-service (ide),
// t2=docs/ide, t3=Code Universe (workspace). The canvas only mounts
// while its tab is active. Keep the index here in sync with
// `action-terrain.spec.ts` — if the default loadout changes, update both.
const WORKSPACE_TAB_INDEX = 3;

/**
 * Navigate to the Code Universe (workspace) canvas. Waits for the
 * `.workspace-canvas` root to mount before returning so the caller can
 * safely query canvas-internal selectors.
 *
 * The app path is `/ide/` (not `/`) — keep this helper the single source
 * of truth for that. Callers should NOT call `page.goto` themselves.
 */
export async function gotoCanvas(page: Page): Promise<void> {
  await page.goto(APP_PATH);
  await page.locator(".topbar__tab").first().waitFor({ state: "visible" });

  const tabs = page.locator(".topbar__tab");
  await tabs.nth(WORKSPACE_TAB_INDEX).click();

  // Vite cold-compile of the workspace chunk can take 10-20s on a fresh
  // webServer spawn, so use a generous timeout. Subsequent test runs hit
  // the cache and resolve in <1s.
  await page.locator(".workspace-canvas").waitFor({ state: "visible", timeout: 30_000 });
}
