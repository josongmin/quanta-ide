import type { Page } from "@playwright/test";

/**
 * Shared helper — seeds workspace-canvas feature flags in `localStorage`
 * *before* the app boots, so any keyboard handler / component that gates
 * on a flag is live on the very first render.
 *
 * The real storage schema is a flat `Record<string, boolean>` keyed by
 * feature id (not a wrapped
 * `{ flags: {...} }` envelope — see `feature-flags-store.ts` for the
 * authoritative shape). Using the wrong shape silently resets all flags
 * to `defaultEnabled`, which breaks specs that seed an off-by-default
 * feature.
 *
 * Usage:
 * ```ts
 * test.beforeEach(async ({ page }) => {
 *   await seedFeatureFlags(page, { "power.lasso": true });
 *   await gotoCanvas(page);
 * });
 * ```
 */
export async function seedFeatureFlags(
  page: Page,
  flags: Record<string, boolean>,
): Promise<void> {
  const STORAGE_KEY = "quanta.canvas.featureFlags.v2";
  await page.addInitScript(
    ({ key, overrides }: { key: string; overrides: Record<string, boolean> }) => {
      try {
        const existing = window.localStorage.getItem(key);
        const parsed: Record<string, boolean> = existing ? JSON.parse(existing) : {};
        for (const [id, on] of Object.entries(overrides)) {
          parsed[id] = on;
        }
        window.localStorage.setItem(key, JSON.stringify(parsed));
      } catch {
        // Best-effort; if storage is unavailable the feature stays off
        // and downstream selectors will time out with a clear message.
      }
    },
    { key: STORAGE_KEY, overrides: flags },
  );
}
