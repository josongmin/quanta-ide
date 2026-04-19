import type { WorkspaceGraph, FileNode, FileEdge } from "@quanta/canvas-engine";

// Mock workspace graph — used when the host hasn't yet plumbed a
// real source (bare Vite dev server, Storybook, etc.). Small enough
// to hand-verify layout in tests, big enough (3 packages × ~4 dirs ×
// ~3 files) to exercise all six entity kinds once hierarchical
// rollup kicks in.

// Each file spec can include a small set of functions so the
// floor/room tiers render something at max zoom. A FunctionBlock
// carries name + line range + complexity; the entity tree walker
// converts each into a room entity under a synthetic floor.
interface FnSpec {
  name: string;
  start: number;
  end: number;
  cpx: number;
}

function file(
  id: string,
  loc: number,
  riskScore: number,
  fns: readonly FnSpec[] = [],
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: fns.map(f => ({
      name: f.name,
      startLine: f.start,
      endLine: f.end,
      signalCount: 0,
      complexity: f.cpx,
    })),
  };
}

const FILES: FileNode[] = [
  file("engine/graph/build.ts", 180, 30, [
    { name: "buildGraph", start: 10, end: 80, cpx: 5 },
    { name: "mergeSubgraphs", start: 85, end: 130, cpx: 3 },
    { name: "validate", start: 135, end: 175, cpx: 2 },
  ]),
  file("engine/graph/rollup.ts", 90, 10, [
    { name: "rollup", start: 5, end: 55, cpx: 2 },
    { name: "rollupKind", start: 60, end: 85, cpx: 1 },
  ]),
  file("engine/layout/squarified.ts", 220, 55, [
    { name: "squarifyInto", start: 15, end: 120, cpx: 8 },
    { name: "worstAspect", start: 125, end: 155, cpx: 4 },
    { name: "flushRow", start: 160, end: 215, cpx: 6 },
  ]),
  file("engine/layout/hierarchical.ts", 150, 25, [
    { name: "buildHierarchicalLayout", start: 20, end: 90, cpx: 3 },
    { name: "defaultWeight", start: 95, end: 115, cpx: 2 },
    { name: "rollupWeight", start: 120, end: 145, cpx: 3 },
  ]),
  file("engine/tier/ladder.ts", 80, 15, [
    { name: "resolveTierByScale", start: 20, end: 50, cpx: 3 },
  ]),
  file("engine/tier/edge-rollup.ts", 140, 20, [
    { name: "rollupEdges", start: 15, end: 60, cpx: 2 },
    { name: "makeAncestorResolver", start: 65, end: 100, cpx: 3 },
  ]),

  file("ui-kit/primitives/Button.tsx", 40, 5, [
    { name: "Button", start: 5, end: 35, cpx: 1 },
  ]),
  file("ui-kit/primitives/Card.tsx", 110, 18, [
    { name: "Card", start: 10, end: 60, cpx: 2 },
    { name: "CardHeader", start: 65, end: 85, cpx: 1 },
    { name: "CardBody", start: 90, end: 105, cpx: 1 },
  ]),
  file("ui-kit/icons/index.ts", 20, 0),
  file("ui-kit/hooks/use-store.ts", 60, 8, [
    { name: "useStore", start: 5, end: 55, cpx: 2 },
  ]),

  file("shell/topbar/Topbar.tsx", 260, 48, [
    { name: "Topbar", start: 20, end: 150, cpx: 7 },
    { name: "HomeButton", start: 155, end: 180, cpx: 2 },
    { name: "IconButton", start: 185, end: 230, cpx: 3 },
  ]),
  file("shell/topbar/TabStrip.tsx", 180, 32, [
    { name: "TabStrip", start: 10, end: 90, cpx: 5 },
    { name: "TabItem", start: 95, end: 175, cpx: 4 },
  ]),
  file("shell/palette/CommandPalette.tsx", 320, 72, [
    { name: "CommandPalette", start: 25, end: 160, cpx: 9 },
    { name: "CommandRow", start: 165, end: 220, cpx: 4 },
    { name: "useCommandSearch", start: 225, end: 280, cpx: 5 },
    { name: "scoreMatch", start: 285, end: 315, cpx: 3 },
  ]),
  file("shell/session/session-store.ts", 70, 12, [
    { name: "createSessionStore", start: 10, end: 65, cpx: 2 },
  ]),
];

let edgeCounter = 0;
const nextId = () => `edge:${edgeCounter++}`;

function edge(
  from: string,
  to: string,
  kind: FileEdge["kind"] = "import",
  weight = 1,
): FileEdge {
  return {
    id: nextId(),
    from,
    to,
    kind,
    layer: kind === "call" ? "structural" : "structural",
    weight,
  };
}

const EDGES: FileEdge[] = [
  // Within a package
  edge("engine/graph/build.ts", "engine/graph/rollup.ts"),
  edge("engine/layout/hierarchical.ts", "engine/layout/squarified.ts"),
  edge("engine/tier/edge-rollup.ts", "engine/graph/rollup.ts"),
  edge("engine/tier/ladder.ts", "engine/tier/edge-rollup.ts"),

  // Cross-package (ui-kit ← shell)
  edge("shell/topbar/Topbar.tsx", "ui-kit/primitives/Button.tsx", "import", 3),
  edge("shell/topbar/Topbar.tsx", "ui-kit/primitives/Card.tsx", "import", 2),
  edge("shell/topbar/TabStrip.tsx", "ui-kit/primitives/Button.tsx"),
  edge("shell/palette/CommandPalette.tsx", "ui-kit/primitives/Card.tsx", "import", 2),
  edge("shell/palette/CommandPalette.tsx", "ui-kit/hooks/use-store.ts"),

  // shell self-references
  edge("shell/topbar/TabStrip.tsx", "shell/session/session-store.ts"),
  edge("shell/palette/CommandPalette.tsx", "shell/session/session-store.ts"),

  // shell → engine (simulates the real product graph)
  edge("shell/palette/CommandPalette.tsx", "engine/graph/build.ts", "call"),
];

export const MOCK_GRAPH: WorkspaceGraph = {
  files: FILES,
  fileEdges: EDGES,
  comments: [],
};
