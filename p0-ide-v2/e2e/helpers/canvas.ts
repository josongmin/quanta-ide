import type { Page } from "@playwright/test";

const APP_PATH = "/ide/";

// Shell boots with: t0=order-service (ide), t1=payment-service (ide),
// t2=docs/ide, t3=Code Universe (workspace). The canvas only mounts
// while its tab is active.
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
  // Topbar itself can take 15-20s to first-render on a cold dev server.
  await page.locator(".topbar__tab").first().waitFor({ state: "visible", timeout: 60_000 });

  const tabs = page.locator(".topbar__tab");
  await tabs.nth(WORKSPACE_TAB_INDEX).click();

  // Vite cold-compile of the workspace chunk (pixi + canvas-engine graph)
  // regularly takes 30-60s on a fresh webServer spawn. Prior 30s budget
  // was timing out 7/20 specs. 90s gives cold start enough headroom
  // without masking a genuine hang; subsequent cache hits resolve <1s.
  await page.locator(".workspace-canvas").waitFor({ state: "visible", timeout: 90_000 });
}
