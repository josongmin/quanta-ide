import { sceneStore } from "@quanta/app-ide/features/workspace-canvas/store/scene-store";
import { loadRepoGraph } from "@quanta/app-ide/features/workspace-canvas";
import { setRepoRoot, setWorkspaceGraph } from "@quanta/code-universe";

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

const BOOT_REPO_PATH =
  "/Users/songmin/Documents/code-new/semantica-codegraph-v2/packages/analysis/quanta-v2";
const BOOT_REPO_EXTS = [".rs"];
const BOOT_REPO_MAX = 50_000;

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

  let lastGraph = sceneStore.getState().graph;
  let lastRoot = sceneStore.getState().repoRoot;
  const unsub = sceneStore.subscribe(() => {
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

  // Kick the initial scan if nothing else has. Fire-and-forget; the
  // subscribe loop above forwards the resulting graph once
  // `sceneStore.setGraph` lands. Failures (plugin not registered,
  // path missing) fall through to MOCK_GRAPH without blocking boot.
  if (!sceneStore.getState().graph) {
    void loadRepoGraph({
      path: BOOT_REPO_PATH,
      extensions: BOOT_REPO_EXTS,
      maxFiles: BOOT_REPO_MAX,
    })
      .then(result => {
        if (sceneStore.getState().graph) return; // v1 raced us — keep its graph
        sceneStore.setRepoRoot(BOOT_REPO_PATH);
        sceneStore.setGraph(result.graph);
      })
      .catch(() => {
        // Already logged by repo-loader's logOnce; nothing to do.
      });
  }

  return unsub;
}
