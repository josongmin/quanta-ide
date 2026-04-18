import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { loadRepoGraph, loadFileSource } from "./repo-loader";
import type { GraphSource } from "./graph-source";
import { synthesizeDemoEdges } from "./synthesize-demo-edges";

// ─────────────────────────────────────────────────────────────────────
// MockGraphSource — dev-only adapter over the regex scanner plugin.
//
// This is the SAMPLE implementation of the GraphSource contract. It
// wraps the existing `loadRepoGraph` / `loadFileSource` helpers that
// talk to `vite-plugins/repo-scanner.ts`. Production environments will
// replace this with an engine-backed source (see GraphSource docs).
//
// Neither `subscribe` nor `describe` is implemented — the mock scanner
// has no streaming channel, and its "source metadata" is just the path
// the caller already knows about.
// ─────────────────────────────────────────────────────────────────────

export interface MockGraphSourceConfig {
  /** Absolute path on the dev-server host. Passed straight to the scanner. */
  path: string;
  /** File extensions to include, e.g. [".ts", ".tsx"]. */
  extensions?: string[];
  /** Safety cap to avoid accidentally scanning enormous trees. */
  maxFiles?: number;
}

class MockGraphSource implements GraphSource {
  readonly id = "mock-scanner";
  readonly label = "Mock dev scanner";
  readonly graphKey: string;

  constructor(private readonly config: MockGraphSourceConfig) {
    this.graphKey = `mock:${config.path}`;
  }

  /**
   * Load a graph via the dev-server scanner.
   *
   * `params` may override any of the ctor-time config on a per-call basis
   * (e.g. pointing the loader at a different repo without reconstructing
   * the source). Unknown params are ignored.
   */
  async loadGraph(params?: Record<string, unknown>): Promise<WorkspaceGraph> {
    const path = typeof params?.path === "string" ? (params.path as string) : this.config.path;
    const extensions = Array.isArray(params?.extensions)
      ? (params!.extensions as string[])
      : this.config.extensions;
    const maxFiles = typeof params?.maxFiles === "number"
      ? (params!.maxFiles as number)
      : this.config.maxFiles;

    const { graph } = await loadRepoGraph({ path, extensions, maxFiles });
    // Demo-only: scanner emits `import` edges only. Layer the full kind
    // catalog on top so every HUD toggle has something to filter.
    const fileEdges = synthesizeDemoEdges(graph.files, graph.fileEdges);
    return { ...graph, fileEdges };
  }

  /**
   * Fetch a single file's source from the dev-server. `fileId` is the
   * scanner-assigned id, which for mock scans equals the repo-relative
   * path rooted at `config.path`.
   */
  async loadFileSource(fileId: string): Promise<string> {
    return loadFileSource({ repoRoot: this.config.path, fileId });
  }

  // subscribe / describe intentionally omitted — the mock scanner is
  // pull-only and has no multi-source semantics.
}

/**
 * Factory for a MockGraphSource. Using a factory (vs exporting the class)
 * keeps the interface the primary public surface — swapping in the real
 * engine later will look like `createEngineGraphSource(...)` with the
 * same `GraphSource` type.
 */
export function createMockGraphSource(config: MockGraphSourceConfig): GraphSource {
  return new MockGraphSource(config);
}
