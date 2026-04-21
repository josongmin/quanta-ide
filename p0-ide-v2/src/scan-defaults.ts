/**
 * Default filesystem root for boot-time `__repo/scan`.
 *
 * Precedence: `VITE_REPO_SCAN_ROOT` → Vite `define` default (monorepo root)
 * → last-resort path for dev machines without env.
 */
export function getDefaultRepoScanRoot(): string {
  const env = import.meta.env.VITE_REPO_SCAN_ROOT?.trim();
  if (env) return env;
  if (typeof __DEFAULT_REPO_SCAN_ROOT__ === "string" && __DEFAULT_REPO_SCAN_ROOT__.length > 0) {
    return __DEFAULT_REPO_SCAN_ROOT__;
  }
  return "/Users/songmin/Documents/code-new/quanta-ide";
}
