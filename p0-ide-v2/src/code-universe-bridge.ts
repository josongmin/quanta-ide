import { sceneStore } from "@quanta/app-ide/features/workspace-canvas/store/scene-store";
import { interactionStore } from "@quanta/app-ide/features/workspace-canvas/store/interaction-store";
import { loadRepoGraph } from "@quanta/app-ide/features/workspace-canvas";
import {
  setRepoRoot,
  setSelectedSymbol,
  setWorkspaceGraph,
} from "@quanta/code-universe";
import { getDefaultRepoScanRoot } from "./scan-defaults";

// Code-universe ↔ legacy scene-store bridge.
// --------------------------------------------------------------------
// `@quanta/code-universe` is a product package — it cannot reach into
// `@quanta/app-ide` internals (FSD product-isolation rule). The host
// (p0-ide-v2) glues the two by subscribing to the legacy scene-store
// and forwarding the graph to code-universe's module-level setter.
//
// Boot-time auto-scan: the shell lazy-mounts tabs, so the v1 tab's
// own `useEffect` auto-load doesn't fire until the user clicks into
// that tab. If the user opens v2 first (the common case now), it
// would otherwise sit on MOCK_GRAPH forever. We kick the scan here
// once at boot so v2 gets real data regardless of tab activation.

const BOOT_REPO_EXTS = [".ts", ".tsx"];
const BOOT_REPO_MAX = 8_000;

/**
 * Install the bridge. Call once at app boot (main.tsx). Returns a
 * teardown fn for test/hot-reload ergonomics — production uses
 * ignore the return value.
 */
export function installCodeUniverseBridge(): () => void {
  // Push the current value synchronously so the first tab mount
  // doesn't flash the mock graph.
  setWorkspaceGraph(sceneStore.getState().graph ?? null);
  setRepoRoot(sceneStore.getState().repoRoot ?? null);
  setSelectedSymbol(interactionStore.getState().viewState.selectedSymbolId);

  let lastGraph = sceneStore.getState().graph;
  let lastRoot = sceneStore.getState().repoRoot;
  const unsubScene = sceneStore.subscribe(() => {
    const next = sceneStore.getState();
    if (next.graph !== lastGraph) {
      lastGraph = next.graph;
      setWorkspaceGraph(next.graph ?? null);
    }
    if (next.repoRoot !== lastRoot) {
      lastRoot = next.repoRoot;
      setRepoRoot(next.repoRoot ?? null);
    }
  });

  // Symbol-selection bridge: inspector (in app-ide) writes to
  // interactionStore, the v2 canvas views read via `useSelectedSymbol`.
  // We mirror the string id only — the canvas decodes it into
  // `{ fileId, name, line }` via `decodeSymbolId` on demand. Comparing
  // against `lastSelectedSymbol` drops emits for unrelated ViewState
  // churn (hover, lod, edge selection) so the product side never
  // re-renders for no reason.
  let lastSelectedSymbol = interactionStore.getState().viewState.selectedSymbolId;
  const unsubInteraction = interactionStore.subscribe(() => {
    const next = interactionStore.getState().viewState.selectedSymbolId;
    if (next !== lastSelectedSymbol) {
      lastSelectedSymbol = next;
      setSelectedSymbol(next);
    }
  });

  const unsub = () => {
    unsubScene();
    unsubInteraction();
  };

  // Kick the initial scan if nothing else has. Fire-and-forget; the
  // subscribe loop above forwards the resulting graph once
  // `sceneStore.setGraph` lands. Failures (plugin not registered,
  // path missing) fall through to MOCK_GRAPH without blocking boot.
  if (!sceneStore.getState().graph) {
    const scanRoot = getDefaultRepoScanRoot();
    void loadRepoGraph({
      path: scanRoot,
      extensions: BOOT_REPO_EXTS,
      maxFiles: BOOT_REPO_MAX,
    })
      .then(result => {
        if (sceneStore.getState().graph) return; // v1 raced us — keep its graph
        sceneStore.setRepoRoot(scanRoot);
        sceneStore.setGraph(result.graph);
      })
      .catch(() => {
        // Already logged by repo-loader's logOnce; nothing to do.
      });
  }

  return unsub;
}
