/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for `__repo/scan` root (absolute path). */
  readonly VITE_REPO_SCAN_ROOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by `vite.config.ts` — monorepo root when unset. */
declare const __DEFAULT_REPO_SCAN_ROOT__: string;
