import { bench, describe } from "vitest";
import { buildSynthGraph } from "./synth";
import { gridLayout } from "../layout/grid-layout";
import { treemapLayout } from "../layout/treemap-layout";
import { computeWorkspaceMetrics } from "../graph/metrics";
import { computeRefactorROI } from "../graph/refactor-roi";
import type { FileEdge, FileNode } from "../graph/types";

// Perf budgets for the 5k-file synthetic graph. These exist as constants so
// a reviewer can see the bar we're holding at a glance; we don't enforce
// them via assert here (vitest bench has no built-in timeout-as-budget) —
// instead the README documents how to read the output and what to do when
// a budget is exceeded.
const BUDGET_LAYOUT_MS = 500;
const BUDGET_METRICS_MS = 50;
const BUDGET_ROI_MS = 50;
void BUDGET_LAYOUT_MS;
void BUDGET_METRICS_MS;
void BUDGET_ROI_MS;

// Build the graph once per describe block — 5k files / ~15k edges is cheap
// to generate (~30ms) but still not free, and bench iterations that include
// setup time are noisy.
const FILES = 5000;
const EDGES_PER_FILE = 3;

describe("canvas 5k perf", () => {
  const graph = buildSynthGraph({ files: FILES, edgesPerFile: EDGES_PER_FILE });

  // Pre-compute metrics once for the ROI bench — we want ROI measured in
  // isolation, not with Brandes' metrics bundled in.
  const metrics = computeWorkspaceMetrics(graph, { computeBetweenness: false });

  bench(
    "gridLayout 5k files",
    () => {
      gridLayout(graph);
    },
    { iterations: 5 },
  );

  // treemapLayout is the tier used past TREEMAP_THRESHOLD (default 100 files),
  // so at 5k this is the production layout path. Budget: 500ms.
  bench(
    "treemapLayout 5k files",
    () => {
      treemapLayout(graph);
    },
    { iterations: 5 },
  );

  // Metrics with betweenness OFF is the hot path — the HUD reads degree
  // counts on every graph swap. Budget: 50ms at 5k.
  bench(
    "computeWorkspaceMetrics 5k (betweenness off)",
    () => {
      computeWorkspaceMetrics(graph, { computeBetweenness: false });
    },
    { iterations: 10 },
  );

  bench(
    "computeRefactorROI 5k",
    () => {
      computeRefactorROI(graph, metrics);
    },
    { iterations: 10 },
  );

  // Cross-graph flash is a pure O(E + F) pass — verify it stays linear by
  // running the bare loop (no React/store) over a synthetic graphFlash
  // state. Mirrors the implementation in
  // packages/app-ide/.../use-scene-derivations.ts (useCrossGraphFlash):
  // build fileById once, then a single pass over edges.
  //
  // We mark half the files as belonging to graphId="svcA" and half to
  // graphId="svcB", then flag 20% of edges as crossGraph to simulate a
  // realistic service-join scenario.
  const crossGraph = decorateForCrossGraph(graph);
  const flashGraphId = "svcA";

  bench(
    "cross-graph flash loop 5k",
    () => {
      const fileById = new Map<string, string | undefined>();
      for (const f of crossGraph.files) fileById.set(f.id, f.graphId);
      const out = new Set<string>();
      for (const e of crossGraph.fileEdges) {
        if (!e.crossGraph) continue;
        if (e.graphId === flashGraphId) {
          out.add(e.id);
          continue;
        }
        const from = fileById.get(e.from);
        const to = fileById.get(e.to);
        if (from === flashGraphId || to === flashGraphId) out.add(e.id);
      }
      void out;
    },
    { iterations: 20 },
  );
});

// Mutates copies of files/edges to carry graphId + crossGraph flags so the
// bench exercises the actual code path without re-running the full synth.
function decorateForCrossGraph(
  graph: ReturnType<typeof buildSynthGraph>,
): ReturnType<typeof buildSynthGraph> {
  const files: FileNode[] = graph.files.map((f, i) => ({
    ...f,
    graphId: i % 2 === 0 ? "svcA" : "svcB",
  }));
  const ids = new Set<string>(files.map(f => f.id));
  const graphIdOf = new Map<string, string>();
  for (const f of files) if (f.graphId) graphIdOf.set(f.id, f.graphId);
  const fileEdges: FileEdge[] = graph.fileEdges.map((e, i) => {
    const from = graphIdOf.get(e.from);
    const to = graphIdOf.get(e.to);
    const cross = from && to && from !== to && ids.has(e.from) && ids.has(e.to);
    // Only flag a subset so the loop has to short-circuit most edges; that
    // matches the production distribution (cross-graph edges are a
    // minority).
    const keepCross = cross && i % 5 === 0;
    return {
      ...e,
      graphId: from,
      crossGraph: keepCross ? true : undefined,
    };
  });
  return { ...graph, files, fileEdges };
}
