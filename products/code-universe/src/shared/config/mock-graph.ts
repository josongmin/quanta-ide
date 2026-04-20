import type {
  ArchLayer,
  EdgeSeverity,
  FileEdge,
  FileNode,
  SignalSummary,
  WorkspaceGraph,
} from "@quanta/canvas-engine";

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

/**
 * Structured file spec — optional static-analysis fields mimic what a
 * real workspace scanner would produce so the v2 canvas has something
 * meaningful to colour / badge / rank even without a host connection.
 */
interface FileSpec {
  id: string;
  loc: number;
  riskScore: number;
  layer?: ArchLayer;
  signals?: Partial<SignalSummary>;
  fns?: readonly FnSpec[];
}

function file(spec: FileSpec): FileNode {
  const sig: SignalSummary = {
    taintCount: spec.signals?.taintCount ?? 0,
    blastCritical: spec.signals?.blastCritical ?? 0,
    deadCount: spec.signals?.deadCount ?? 0,
    archViolations: spec.signals?.archViolations ?? 0,
    cpxMax: spec.signals?.cpxMax ?? Math.max(0, ...(spec.fns ?? []).map(f => f.cpx)),
  };
  return {
    id: spec.id,
    name: spec.id.split("/").pop() ?? spec.id,
    layer: spec.layer ?? "domain",
    riskScore: spec.riskScore,
    loc: spec.loc,
    signals: sig,
    functions: (spec.fns ?? []).map(f => ({
      name: f.name,
      startLine: f.start,
      endLine: f.end,
      signalCount: 0,
      complexity: f.cpx,
    })),
  };
}

const FILES: FileNode[] = [
  // engine/* — pure domain logic. One cold-spot, one hotspot.
  file({
    id: "engine/graph/build.ts",
    loc: 180,
    riskScore: 30,
    layer: "domain",
    signals: { cpxMax: 5 },
    fns: [
      { name: "buildGraph", start: 10, end: 80, cpx: 5 },
      { name: "mergeSubgraphs", start: 85, end: 130, cpx: 3 },
      { name: "validate", start: 135, end: 175, cpx: 2 },
    ],
  }),
  file({
    id: "engine/graph/rollup.ts",
    loc: 90,
    riskScore: 10,
    layer: "domain",
    fns: [
      { name: "rollup", start: 5, end: 55, cpx: 2 },
      { name: "rollupKind", start: 60, end: 85, cpx: 1 },
    ],
  }),
  file({
    id: "engine/layout/squarified.ts",
    loc: 220,
    riskScore: 55,
    layer: "domain",
    // Hot layout algorithm — high cpx + dead-code warnings from
    // unused helper branches.
    signals: { cpxMax: 8, deadCount: 2 },
    fns: [
      { name: "squarifyInto", start: 15, end: 120, cpx: 8 },
      { name: "worstAspect", start: 125, end: 155, cpx: 4 },
      { name: "flushRow", start: 160, end: 215, cpx: 6 },
    ],
  }),
  file({
    id: "engine/layout/hierarchical.ts",
    loc: 150,
    riskScore: 25,
    layer: "domain",
    fns: [
      { name: "buildHierarchicalLayout", start: 20, end: 90, cpx: 3 },
      { name: "defaultWeight", start: 95, end: 115, cpx: 2 },
      { name: "rollupWeight", start: 120, end: 145, cpx: 3 },
    ],
  }),
  file({
    id: "engine/tier/ladder.ts",
    loc: 80,
    riskScore: 15,
    layer: "domain",
    fns: [{ name: "resolveTierByScale", start: 20, end: 50, cpx: 3 }],
  }),
  file({
    id: "engine/tier/edge-rollup.ts",
    loc: 140,
    riskScore: 20,
    layer: "domain",
    fns: [
      { name: "rollupEdges", start: 15, end: 60, cpx: 2 },
      { name: "makeAncestorResolver", start: 65, end: 100, cpx: 3 },
    ],
  }),

  // ui-kit/* — UI primitives. Mostly cold, no alarms.
  file({
    id: "ui-kit/primitives/Button.tsx",
    loc: 40,
    riskScore: 5,
    layer: "ui",
    fns: [{ name: "Button", start: 5, end: 35, cpx: 1 }],
  }),
  file({
    id: "ui-kit/primitives/Card.tsx",
    loc: 110,
    riskScore: 18,
    layer: "ui",
    fns: [
      { name: "Card", start: 10, end: 60, cpx: 2 },
      { name: "CardHeader", start: 65, end: 85, cpx: 1 },
      { name: "CardBody", start: 90, end: 105, cpx: 1 },
    ],
  }),
  // Stale barrel — typical dead-export candidate.
  file({
    id: "ui-kit/icons/index.ts",
    loc: 20,
    riskScore: 12,
    layer: "ui",
    signals: { deadCount: 4 },
  }),
  file({
    id: "ui-kit/hooks/use-store.ts",
    loc: 60,
    riskScore: 8,
    layer: "util",
    fns: [{ name: "useStore", start: 5, end: 55, cpx: 2 }],
  }),

  // shell/* — chrome. One big hotspot (CommandPalette) + an arch-
  // violation: shell/session-store taking an adapter-layer import
  // it shouldn't (stamped via archViolations below).
  file({
    id: "shell/topbar/Topbar.tsx",
    loc: 260,
    riskScore: 48,
    layer: "ui",
    signals: { cpxMax: 7 },
    fns: [
      { name: "Topbar", start: 20, end: 150, cpx: 7 },
      { name: "HomeButton", start: 155, end: 180, cpx: 2 },
      { name: "IconButton", start: 185, end: 230, cpx: 3 },
    ],
  }),
  file({
    id: "shell/topbar/TabStrip.tsx",
    loc: 180,
    riskScore: 32,
    layer: "ui",
    signals: { cpxMax: 5 },
    fns: [
      { name: "TabStrip", start: 10, end: 90, cpx: 5 },
      { name: "TabItem", start: 95, end: 175, cpx: 4 },
    ],
  }),
  // The workspace's designated hotspot: high cpx, high risk, a
  // taint-tracking finding, one blast-critical downstream.
  file({
    id: "shell/palette/CommandPalette.tsx",
    loc: 320,
    riskScore: 82,
    layer: "ui",
    signals: { cpxMax: 9, taintCount: 2, blastCritical: 1 },
    fns: [
      { name: "CommandPalette", start: 25, end: 160, cpx: 9 },
      { name: "CommandRow", start: 165, end: 220, cpx: 4 },
      { name: "useCommandSearch", start: 225, end: 280, cpx: 5 },
      { name: "scoreMatch", start: 285, end: 315, cpx: 3 },
    ],
  }),
  // Arch-violation: session-store (infra) is imported straight from
  // ui-kit (ui) which breaks the layering rule — 1 violation stamped.
  file({
    id: "shell/session/session-store.ts",
    loc: 70,
    riskScore: 22,
    layer: "infra",
    signals: { archViolations: 1 },
    fns: [{ name: "createSessionStore", start: 10, end: 65, cpx: 2 }],
  }),
];

let edgeCounter = 0;
const nextId = () => `edge:${edgeCounter++}`;

interface EdgeOpts {
  kind?: FileEdge["kind"];
  layer?: FileEdge["layer"];
  weight?: number;
  severity?: EdgeSeverity;
}

function edge(from: string, to: string, opts: EdgeOpts = {}): FileEdge {
  const kind = opts.kind ?? "import";
  return {
    id: nextId(),
    from,
    to,
    kind,
    layer: opts.layer ?? "structural",
    weight: opts.weight ?? 1,
    ...(opts.severity ? { severity: opts.severity } : {}),
  };
}

const EDGES: FileEdge[] = [
  // Within a package
  edge("engine/graph/build.ts", "engine/graph/rollup.ts"),
  edge("engine/layout/hierarchical.ts", "engine/layout/squarified.ts"),
  edge("engine/tier/edge-rollup.ts", "engine/graph/rollup.ts"),
  edge("engine/tier/ladder.ts", "engine/tier/edge-rollup.ts"),

  // Cross-package (ui-kit ← shell)
  edge("shell/topbar/Topbar.tsx", "ui-kit/primitives/Button.tsx", { weight: 3 }),
  edge("shell/topbar/Topbar.tsx", "ui-kit/primitives/Card.tsx", { weight: 2 }),
  edge("shell/topbar/TabStrip.tsx", "ui-kit/primitives/Button.tsx"),
  edge("shell/palette/CommandPalette.tsx", "ui-kit/primitives/Card.tsx", { weight: 2 }),
  edge("shell/palette/CommandPalette.tsx", "ui-kit/hooks/use-store.ts"),

  // shell self-references
  edge("shell/topbar/TabStrip.tsx", "shell/session/session-store.ts"),
  edge("shell/palette/CommandPalette.tsx", "shell/session/session-store.ts", {
    severity: "high",
  }),

  // shell → engine. The CommandPalette → engine/build call is the
  // critical cross-layer dependency a reviewer should see first —
  // marked critical so tier-aware filtering surfaces it even at
  // universe zoom.
  edge("shell/palette/CommandPalette.tsx", "engine/graph/build.ts", {
    kind: "call",
    severity: "critical",
    weight: 4,
  }),
];

export const MOCK_GRAPH: WorkspaceGraph = {
  files: FILES,
  fileEdges: EDGES,
  comments: [],
};

