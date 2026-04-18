import type { FileNode } from "@quanta/canvas-engine";
import { sceneStore } from "../store/scene-store";

// ───────────────────────────────────────────────────────────────────
// Code Universe memory estimator.
//
// Sums *our own* data-structure footprint (graph + layout + scenes +
// ground cache). Deliberately heuristic — the per-object constants
// below are V8-flavored ballpark numbers (object header + property
// slots), deterministic so the same store state always yields the
// same bytes.
//
// What this ISN'T:
//   - actual `performance.memory.usedJSHeapSize` (that's main-thread
//     JS heap; see FpsSection.tsx).
//   - GPU memory (lives in Pixi InstancedRectMesh buffers on the GPU).
//   - Worker heap (layout/aggregates workers run in separate isolates).
//
// What it IS:
//   - a lower-bound "cost of the WorkspaceGraph/layout pipeline" you
//     can watch trend over time and diff across LOD/repo changes.
// ───────────────────────────────────────────────────────────────────

const B_OBJECT_HEADER = 32;       // V8 object header + map pointer
const B_MAP_ENTRY     = 80;       // Map entry cost (key ptr + val ptr + hash slot)
const B_STRING_HEADER = 16;
const B_RECT          = B_OBJECT_HEADER + 4 * 8;
const B_BEZIER        = B_OBJECT_HEADER + 8 * 8;
const B_POINT         = B_OBJECT_HEADER + 2 * 8;
const B_FILE_EDGE     = B_OBJECT_HEADER + 64;   // id/from/to/kind headers + weight
const B_SIGNALS       = B_OBJECT_HEADER + 5 * 8;
const B_FUNCTION_BLK  = B_OBJECT_HEADER + 4 * 8 + 32; // + name string avg

function stringBytes(s: string): number {
  return B_STRING_HEADER + s.length * 2;
}

function fileNodeBytes(f: FileNode): number {
  return (
    B_OBJECT_HEADER +
    stringBytes(f.id) +
    stringBytes(f.name) +
    B_SIGNALS +
    B_OBJECT_HEADER + f.functions.length * B_FUNCTION_BLK
  );
}

export interface UniverseMemoryBreakdown {
  graph: number;
  layout: number;
  visibleScene: number;
  clusterScene: number;
  superclusterScene: number;
  groundData: number;
  total: number;
}

export interface UniverseMemoryCounts {
  graphFiles: number;
  graphEdges: number;
  graphComments: number;
  layoutFileRects: number;
  layoutEdgeRoutes: number;
  layoutOrthoRoutes: number;
  layoutClusters: number;
  layoutSuperclusters: number;
  layoutBundledEdges: number;
  visibleFiles: number;
  visibleEdges: number;
  clusterVisible: number;
  superclusterVisible: number;
  groundEntries: number;
  groundSourceBytes: number;
  groundTokenizedLines: number;
}

export interface UniverseMemorySnapshot {
  breakdown: UniverseMemoryBreakdown;
  counts: UniverseMemoryCounts;
}

export function estimateUniverseMemory(): UniverseMemorySnapshot {
  const s = sceneStore.getState();

  // Graph
  let graph = 0;
  if (s.graph) {
    for (const f of s.graph.files) graph += fileNodeBytes(f);
    graph += s.graph.fileEdges.length * B_FILE_EDGE;
    graph += s.graph.comments.length * 256;
  }

  // Layout
  let layout = 0;
  if (s.layout) {
    layout += s.layout.fileRects.size * (B_MAP_ENTRY + B_RECT);
    layout += s.layout.edgeRoutes.size * (B_MAP_ENTRY + B_BEZIER);
    if (s.layout.edgeRoutesOrtho) {
      for (const r of s.layout.edgeRoutesOrtho.values()) {
        layout += B_MAP_ENTRY + B_OBJECT_HEADER + r.points.length * B_POINT;
      }
    }
    if (s.layout.clusterRects) layout += s.layout.clusterRects.size * (B_MAP_ENTRY + B_RECT);
    if (s.layout.superclusterRects) layout += s.layout.superclusterRects.size * (B_MAP_ENTRY + B_RECT);
    if (s.layout.clusters) layout += s.layout.clusters.length * (B_OBJECT_HEADER + B_RECT + 48);
    if (s.layout.superclusters) layout += s.layout.superclusters.length * (B_OBJECT_HEADER + B_RECT + 48);
    if (s.layout.bundledEdges) layout += s.layout.bundledEdges.length * (B_OBJECT_HEADER + 64);
    layout += s.layout.aggregates.commentsByFunction.size * (B_MAP_ENTRY + 16);
    layout += s.layout.aggregates.commentsByFile.size * (B_MAP_ENTRY + 16);
    // commentedLines: Map<fileId, Set<line>>
    for (const set of s.layout.aggregates.commentedLines.values()) {
      layout += B_MAP_ENTRY + B_OBJECT_HEADER + set.size * 16;
    }
  }

  // Scenes — these hold references to graph objects, not copies. Count
  // as array overhead only (per-entry pointer), not object size again.
  const visibleScene = s.visibleScene
    ? B_OBJECT_HEADER +
      s.visibleScene.files.length * 8 +
      s.visibleScene.edges.length * 8 +
      s.visibleScene.comments.length * 8
    : 0;
  const clusterScene = s.clusterScene
    ? B_OBJECT_HEADER + s.clusterScene.clusters.length * 8
    : 0;
  const superclusterScene = s.superclusterScene
    ? B_OBJECT_HEADER + s.superclusterScene.superclusters.length * 8
    : 0;

  // Ground data — actual owned strings.
  let groundData = 0;
  let groundEntries = 0;
  let groundSourceBytes = 0;
  let groundTokenizedLines = 0;
  for (const k in s.groundData) {
    const v = s.groundData[k];
    if (!v) continue;
    groundEntries++;
    groundData += B_OBJECT_HEADER;
    if (v.source) {
      groundSourceBytes += v.source.length * 2;
      groundData += stringBytes(v.source);
    }
    if (v.tokenized) {
      groundTokenizedLines += v.tokenized.length;
      groundData += B_OBJECT_HEADER + v.tokenized.length * 8;
      for (const line of v.tokenized) {
        groundData += B_OBJECT_HEADER + line.length * 8;
        for (const tok of line) groundData += stringBytes(tok);
      }
    }
  }

  const total =
    graph + layout + visibleScene + clusterScene + superclusterScene + groundData;

  return {
    breakdown: { graph, layout, visibleScene, clusterScene, superclusterScene, groundData, total },
    counts: {
      graphFiles: s.graph?.files.length ?? 0,
      graphEdges: s.graph?.fileEdges.length ?? 0,
      graphComments: s.graph?.comments.length ?? 0,
      layoutFileRects: s.layout?.fileRects.size ?? 0,
      layoutEdgeRoutes: s.layout?.edgeRoutes.size ?? 0,
      layoutOrthoRoutes: s.layout?.edgeRoutesOrtho?.size ?? 0,
      layoutClusters: s.layout?.clusters?.length ?? 0,
      layoutSuperclusters: s.layout?.superclusters?.length ?? 0,
      layoutBundledEdges: s.layout?.bundledEdges?.length ?? 0,
      visibleFiles: s.visibleScene?.files.length ?? 0,
      visibleEdges: s.visibleScene?.edges.length ?? 0,
      clusterVisible: s.clusterScene?.clusters.length ?? 0,
      superclusterVisible: s.superclusterScene?.superclusters.length ?? 0,
      groundEntries,
      groundSourceBytes,
      groundTokenizedLines,
    },
  };
}
