import { useSyncExternalStore } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// Graph source
// --------------------------------------------------------------------
// Tiny external store holding the active `WorkspaceGraph`. The host
// (p0-ide-v2) calls `setWorkspaceGraph(graph)` once its own scene
// store has resolved; the orchestrator subscribes via the hook.
//
// Why a module singleton instead of React context: the
// TabAppDescriptor contract the shell uses only passes
// `{ tabId, isActive }` — there's no seam to inject a provider from
// the host. A module-level setter is the minimal interface that
// keeps FSD clean (host only touches the product's `public` surface,
// never reaches into internal slices).
//
// For local dev without a host-provided graph, callers can import
// `mockGraph` from `shared/config/mock-graph` and pass it manually.

let current: WorkspaceGraph | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

/** Host entry point. Passing `null` clears the graph and resets the
 *  orchestrator to the empty state. Safe to call repeatedly — only
 *  reference-inequality triggers a re-emit. */
export function setWorkspaceGraph(next: WorkspaceGraph | null): void {
  if (current === next) return;
  current = next;
  emit();
}

export function getWorkspaceGraph(): WorkspaceGraph | null {
  return current;
}

export function subscribeWorkspaceGraph(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useWorkspaceGraph(): WorkspaceGraph | null {
  return useSyncExternalStore(
    subscribeWorkspaceGraph,
    getWorkspaceGraph,
    getWorkspaceGraph,
  );
}
