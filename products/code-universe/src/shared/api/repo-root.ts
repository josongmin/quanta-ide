import { useSyncExternalStore } from "react";

// Repo-root source
// --------------------------------------------------------------------
// Sibling of `graph-source.ts`. The host (p0-ide-v2) pushes the
// current workspace's absolute filesystem root here whenever it
// changes (repo switch, reset, etc.). Features that need to hit the
// dev-server's per-file endpoints — `/__repo/file?root=…&path=…` and
// `/__repo/file/batch` — read it from this singleton.
//
// Same FSD rationale as graph-source: the shell's TabAppDescriptor
// passes only `{ tabId, isActive }`, so a React provider would mean
// the host has to reach into our internals. Module-level setter keeps
// the product's `public/` surface intact.

let current: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function setRepoRoot(next: string | null): void {
  if (current === next) return;
  current = next;
  emit();
}

export function getRepoRoot(): string | null {
  return current;
}

export function subscribeRepoRoot(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useRepoRoot(): string | null {
  return useSyncExternalStore(subscribeRepoRoot, getRepoRoot, getRepoRoot);
}
