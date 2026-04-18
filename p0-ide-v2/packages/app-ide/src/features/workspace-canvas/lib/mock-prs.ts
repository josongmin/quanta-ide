// Mock pull requests — Batch 8 (embeds.prBadge)
// ---------------------------------------------------------------------
// Fixture PRs with a stable shape matching what a GitHub/GitLab adapter
// will eventually emit. The `touchedFiles` array is a list of suffixes
// that we resolve against the live graph's file ids at bootstrap time;
// that avoids hard-coding exact ids (sample graph files depend on the
// current repo state).

export type PrState = "open" | "merged" | "closed";

export interface PR {
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly state: PrState;
  readonly additions: number;
  readonly deletions: number;
  /** Path-suffix hints used to link against the graph at runtime. */
  readonly touchedFiles: readonly string[];
  readonly diffPreview: string;
}

const PRS: readonly PR[] = [
  {
    number: 1287,
    title: "feat(canvas): elevation mode for city LOD",
    author: "alice",
    state: "open",
    additions: 214,
    deletions: 31,
    touchedFiles: ["canvas-pixi/stage/PixiStage.tsx", "canvas-engine/view/build-view.ts"],
    diffPreview: [
      "+ const elevation = computeElevation(layout, scene);",
      "+ shader.uniforms.elevation = elevation;",
      "- // TODO: elevation mode",
    ].join("\n"),
  },
  {
    number: 1291,
    title: "fix(worker): debounce layout on rapid graph swaps",
    author: "bob",
    state: "open",
    additions: 48,
    deletions: 62,
    touchedFiles: ["canvas-worker/layout/index.ts", "workspace-canvas/hooks/use-worker-bridge.ts"],
    diffPreview: [
      "- runLayoutImmediate(graph);",
      "+ scheduleLayout(graph, { debounceMs: 32 });",
      "+ onCancel(() => cancelScheduled());",
    ].join("\n"),
  },
  {
    number: 1302,
    title: "refactor(store): split interaction from viewport",
    author: "carol",
    state: "open",
    additions: 182,
    deletions: 91,
    touchedFiles: ["workspace-canvas/store/interaction-store.ts", "workspace-canvas/store/viewport-store.ts"],
    diffPreview: [
      "+ viewportStore.setViewport(next);",
      "- state.viewport = next;",
      "+ interactionStore.setLod(lod);",
    ].join("\n"),
  },
  {
    number: 1268,
    title: "chore(test): snapshot tests for sample graph",
    author: "dan",
    state: "merged",
    additions: 76,
    deletions: 4,
    touchedFiles: ["canvas-engine/graph/types.ts"],
    diffPreview: [
      "+ expect(snapshot(graph)).toMatchFileSnapshot();",
      "+ // covers 5k-file scenario",
    ].join("\n"),
  },
  {
    number: 1271,
    title: "perf(pixi): reuse edge geometry across ticks",
    author: "erin",
    state: "merged",
    additions: 134,
    deletions: 118,
    touchedFiles: ["canvas-engine/view/build-view.ts"],
    diffPreview: [
      "+ cache.reuse(edge);",
      "- cache.clear();",
      "+ if (dirty) cache.rebuild(layout);",
    ].join("\n"),
  },
];

export function listMockPrs(): readonly PR[] {
  return PRS;
}

/**
 * Return a map fileId → PR[] built by matching touchedFiles suffixes
 * against the supplied graph file ids. A PR attaches to every file
 * whose id ends with any of its touchedFiles entries. Deterministic.
 */
export function buildPrsByFile(fileIds: readonly string[]): ReadonlyMap<string, readonly PR[]> {
  const out = new Map<string, PR[]>();
  for (const pr of PRS) {
    for (const hint of pr.touchedFiles) {
      const match = fileIds.find(id => id === hint || id.endsWith("/" + hint) || id.endsWith(hint));
      if (!match) continue;
      const row = out.get(match) ?? [];
      if (!row.includes(pr)) row.push(pr);
      out.set(match, row);
    }
  }
  return out;
}
