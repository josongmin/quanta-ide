import { sceneStore } from "@quanta/app-ide/features/workspace-canvas/store/scene-store";
import { setWorkspaceGraph } from "@quanta/code-universe";

// Code-universe ↔ legacy scene-store bridge.
// --------------------------------------------------------------------
// `@quanta/code-universe` is a product package — it cannot reach into
// `@quanta/app-ide` internals (FSD product-isolation rule). The host
// (p0-ide-v2) glues the two by subscribing to the legacy scene-store
// and forwarding the graph to code-universe's module-level setter.
//
// Reverse direction NOT wired — the legacy canvas still drives its
// own state; code-universe is read-only against the graph. Once
// legacy sunset in a later phase, the scene-store can be replaced
// with a shared source (or moved into a lib) and this bridge deleted.

/**
 * Install the bridge. Call once at app boot (main.tsx). Returns a
 * teardown fn for test/hot-reload ergonomics — production uses
 * ignore the return value.
 */
export function installCodeUniverseBridge(): () => void {
  // Push the current value synchronously so the first tab mount
  // doesn't flash the mock graph.
  setWorkspaceGraph(sceneStore.getState().graph ?? null);

  let lastGraph = sceneStore.getState().graph;
  const unsub = sceneStore.subscribe(() => {
    const next = sceneStore.getState().graph;
    if (next === lastGraph) return;
    lastGraph = next;
    setWorkspaceGraph(next ?? null);
  });

  return unsub;
}
