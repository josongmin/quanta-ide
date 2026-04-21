import type {
  ArchLayer,
  EdgeSeverity,
  FileBlame,
  FileEdge,
  FileEffects,
  FileLatency,
  FileNode,
  GraphHistory,
  SignalSummary,
  TracePack,
  WorkspaceGraph,
} from "@quanta/canvas-engine";

// Rich mock workspace graph — 76 files across 5 packages, mirroring the
// actual quanta-ide repo structure. Covers all signal types consumed by
// the 11 view-mode visualisations: blame, GraphHistory (12 snapshots with
// a real debt trajectory), latency, effects, traces.
//
// Architecture violations and dependency cycles are deliberately planted
// so every new view has non-trivial data to render without a live host.

// ─── helpers ────────────────────────────────────────────────────────────────

interface FnSpec { name: string; start: number; end: number; cpx: number }

interface FileSpec {
  id: string; loc: number; riskScore: number;
  layer?: ArchLayer; signals?: Partial<SignalSummary>; fns?: readonly FnSpec[];
}

function file(spec: FileSpec): FileNode {
  const sig: SignalSummary = {
    taintCount:     spec.signals?.taintCount     ?? 0,
    blastCritical:  spec.signals?.blastCritical  ?? 0,
    deadCount:      spec.signals?.deadCount      ?? 0,
    archViolations: spec.signals?.archViolations ?? 0,
    cpxMax: spec.signals?.cpxMax ?? Math.max(0, ...(spec.fns ?? []).map(f => f.cpx)),
  };
  return {
    id:    spec.id,
    name:  spec.id.split("/").pop() ?? spec.id,
    layer: spec.layer ?? "domain",
    riskScore: spec.riskScore,
    loc:   spec.loc,
    signals: sig,
    functions: (spec.fns ?? []).map(f => ({
      name: f.name, startLine: f.start, endLine: f.end,
      signalCount: 0, complexity: f.cpx,
    })),
  };
}

// ─── files ──────────────────────────────────────────────────────────────────

const FILES: FileNode[] = [
  // ══ canvas-engine (ce) — graph core ════════════════════════════════════════
  file({ id: "ce/g/types",   loc: 220, riskScore: 10, layer: "domain", signals: { cpxMax: 2 } }),
  file({ id: "ce/g/scc",     loc: 180, riskScore: 45, layer: "domain",
    fns: [{ name: "findStronglyConnectedComponents", start: 10, end: 170, cpx: 12 }] }),
  file({ id: "ce/g/build",   loc: 200, riskScore: 30, layer: "domain",
    fns: [{ name: "buildGraph",     start: 10,  end: 80,  cpx: 5 },
          { name: "mergeSubgraphs", start: 85,  end: 130, cpx: 3 },
          { name: "validate",       start: 135, end: 195, cpx: 3 }] }),
  file({ id: "ce/g/rollup",  loc: 90,  riskScore: 15, layer: "domain",
    fns: [{ name: "rollup",    start: 5,  end: 55, cpx: 2 },
          { name: "rollupKind",start: 60, end: 85, cpx: 1 }] }),
  file({ id: "ce/g/metrics", loc: 150, riskScore: 25, layer: "domain",
    fns: [{ name: "computeWorkspaceMetrics", start: 10, end: 140, cpx: 7 }] }),
  file({ id: "ce/g/blast",   loc: 210, riskScore: 40, layer: "domain",
    fns: [{ name: "computeBlastCone", start: 10,  end: 100, cpx: 9 },
          { name: "computeFixCone",   start: 105, end: 200, cpx: 8 }] }),
  file({ id: "ce/g/arch",    loc: 170, riskScore: 35, layer: "domain",
    fns: [{ name: "detectArchViolations", start: 10, end: 160, cpx: 10 }] }),
  file({ id: "ce/g/debt",    loc: 140, riskScore: 28, layer: "domain",
    fns: [{ name: "computeDebtTrajectory", start: 10, end: 130, cpx: 8 }] }),
  file({ id: "ce/g/refactor",loc: 160, riskScore: 32, layer: "domain",
    fns: [{ name: "computeRefactorROI", start: 10, end: 90,  cpx: 7 },
          { name: "rankStartHere",      start: 95, end: 155, cpx: 5 }] }),
  file({ id: "ce/g/suggest", loc: 140, riskScore: 25, layer: "domain",
    fns: [{ name: "buildRefactorSuggestions", start: 10, end: 130, cpx: 6 }] }),
  file({ id: "ce/g/rank",    loc: 120, riskScore: 20, layer: "domain",
    fns: [{ name: "rankStartHere", start: 10, end: 115, cpx: 5 }] }),

  // ── canvas-engine layout ─────────────────────────────────────────────────
  file({ id: "ce/layout/sq",   loc: 220, riskScore: 55, layer: "domain",
    signals: { cpxMax: 8, deadCount: 2 },
    fns: [{ name: "squarifyInto", start: 15,  end: 120, cpx: 8 },
          { name: "worstAspect",  start: 125, end: 155, cpx: 4 },
          { name: "flushRow",     start: 160, end: 215, cpx: 6 }] }),
  file({ id: "ce/layout/msdf", loc: 190, riskScore: 40, layer: "domain",
    fns: [{ name: "buildMSDFAtlas", start: 10,  end: 100, cpx: 6 },
          { name: "measureText",    start: 105, end: 185, cpx: 4 }] }),
  file({ id: "ce/layout/hier", loc: 150, riskScore: 25, layer: "domain",
    fns: [{ name: "buildHierarchicalLayout", start: 20, end: 90,  cpx: 3 },
          { name: "rollupWeight",             start: 95, end: 145, cpx: 3 }] }),
  file({ id: "ce/s/layout",    loc: 90,  riskScore: 18, layer: "domain" }),

  // ── canvas-engine tier ───────────────────────────────────────────────────
  file({ id: "ce/tier/ladder", loc: 80,  riskScore: 15, layer: "domain",
    fns: [{ name: "resolveTierByScale", start: 20, end: 50, cpx: 3 }] }),
  file({ id: "ce/tier/rollup", loc: 140, riskScore: 20, layer: "domain",
    fns: [{ name: "rollupEdges",         start: 15, end: 60,  cpx: 2 },
          { name: "makeAncestorResolver", start: 65, end: 100, cpx: 3 }] }),

  // ── canvas-engine pixi renderer — adapter ───────────────────────────────
  file({ id: "ce/pixi/scene",  loc: 580, riskScore: 72, layer: "adapter",
    signals: { cpxMax: 14, taintCount: 1, blastCritical: 2 },
    fns: [{ name: "PixiScene",    start: 10,  end: 200, cpx: 14 },
          { name: "renderTier",   start: 205, end: 340, cpx: 8 },
          { name: "syncEntities", start: 345, end: 450, cpx: 6 },
          { name: "teardown",     start: 455, end: 570, cpx: 3 }] }),
  file({ id: "ce/pixi/sprite",  loc: 200, riskScore: 35, layer: "adapter",
    fns: [{ name: "makeSprite",  start: 10,  end: 100, cpx: 4 },
          { name: "recyclePool", start: 105, end: 195, cpx: 3 }] }),
  file({ id: "ce/pixi/canvas",  loc: 160, riskScore: 28, layer: "adapter",
    fns: [{ name: "initCanvas", start: 10, end: 80,  cpx: 3 },
          { name: "resize",     start: 85, end: 155, cpx: 2 }] }),

  // ── canvas-engine view renderers — adapter ───────────────────────────────
  file({ id: "ce/rnd/chord",   loc: 250, riskScore: 42, layer: "adapter",
    fns: [{ name: "renderChord", start: 10,  end: 140, cpx: 7 },
          { name: "chordArc",    start: 145, end: 245, cpx: 5 }] }),
  // ce/rnd/heb has a violation: adapter importing ui-layer cu/s/pixi
  file({ id: "ce/rnd/heb",     loc: 220, riskScore: 38, layer: "adapter",
    signals: { archViolations: 1 },
    fns: [{ name: "renderHEB",   start: 10,  end: 130, cpx: 8 },
          { name: "bundleEdges", start: 135, end: 215, cpx: 5 }] }),
  file({ id: "ce/rnd/arc",     loc: 180, riskScore: 32, layer: "adapter",
    fns: [{ name: "renderArc", start: 10,  end: 100, cpx: 5 },
          { name: "arcPath",   start: 105, end: 175, cpx: 3 }] }),

  // ── canvas-engine utils ──────────────────────────────────────────────────
  file({ id: "ce/util/fnv",  loc: 30, riskScore: 5,  layer: "util" }),
  file({ id: "ce/util/hull", loc: 60, riskScore: 12, layer: "util",
    fns: [{ name: "convexHull", start: 5, end: 55, cpx: 4 }] }),
  file({ id: "ce/util/geom", loc: 50, riskScore: 8,  layer: "util" }),

  // ── canvas-engine barrel ─────────────────────────────────────────────────
  file({ id: "ce/index", loc: 40, riskScore: 5, layer: "adapter" }),

  // ══ code-universe entities (cu/ent) ════════════════════════════════════════
  file({ id: "cu/ent/entity",      loc: 140, riskScore: 20, layer: "domain" }),
  file({ id: "cu/ent/tree",        loc: 260, riskScore: 35, layer: "adapter",
    fns: [{ name: "buildEntityTree", start: 10,  end: 180, cpx: 9 },
          { name: "kindFromPath",    start: 185, end: 255, cpx: 4 }] }),
  file({ id: "cu/ent/interaction",  loc: 220, riskScore: 45, layer: "adapter",
    fns: [{ name: "interactionReducer",   start: 10,  end: 120, cpx: 7 },
          { name: "useInteractionStore",   start: 125, end: 215, cpx: 3 }] }),
  file({ id: "cu/ent/sel",          loc: 180, riskScore: 30, layer: "adapter",
    fns: [{ name: "selectEntity", start: 10,  end: 100, cpx: 5 },
          { name: "multiSelect",  start: 105, end: 175, cpx: 4 }] }),
  file({ id: "cu/ent/hover",        loc: 120, riskScore: 22, layer: "adapter" }),
  file({ id: "cu/ent/render",       loc: 320, riskScore: 55, layer: "adapter",
    signals: { cpxMax: 10 },
    fns: [{ name: "renderEntity", start: 10,  end: 180, cpx: 10 },
          { name: "batchUpdate",  start: 185, end: 315, cpx: 7 }] }),

  // ══ code-universe features (cu/f) ══════════════════════════════════════════
  file({ id: "cu/f/chord/bld", loc: 280, riskScore: 42, layer: "adapter",
    fns: [{ name: "buildChordLayout",  start: 10,  end: 200, cpx: 8 },
          { name: "normalizeWeights",  start: 205, end: 275, cpx: 3 }] }),
  file({ id: "cu/f/chord/ui",  loc: 320, riskScore: 35, layer: "ui",
    fns: [{ name: "ChordView", start: 15, end: 315, cpx: 6 }] }),

  file({ id: "cu/f/mm/store",  loc: 120, riskScore: 25, layer: "adapter",
    fns: [{ name: "mindMapStore", start: 5, end: 115, cpx: 3 }] }),
  file({ id: "cu/f/mm/bld",    loc: 240, riskScore: 38, layer: "adapter",
    fns: [{ name: "buildMindMapLayout", start: 10, end: 235, cpx: 9 }] }),
  file({ id: "cu/f/mm/ui",     loc: 380, riskScore: 42, layer: "ui",
    signals: { cpxMax: 8 },
    fns: [{ name: "MindMapView", start: 15, end: 375, cpx: 8 }] }),

  // view-mode store (cu/f/vm/store → cu/f/mm/store is the "normal" half of the cycle)
  file({ id: "cu/f/vm/store",  loc: 90,  riskScore: 12, layer: "adapter",
    fns: [{ name: "viewModeStore", start: 5, end: 85, cpx: 2 }] }),
  file({ id: "cu/f/vm/ui",     loc: 130, riskScore: 15, layer: "ui",
    fns: [{ name: "ViewModePicker", start: 5, end: 125, cpx: 3 }] }),

  file({ id: "cu/f/qd/bld",   loc: 160, riskScore: 30, layer: "adapter",
    fns: [{ name: "buildQuadrantLayout", start: 10, end: 155, cpx: 6 }] }),
  file({ id: "cu/f/qd/ui",    loc: 220, riskScore: 28, layer: "ui",
    fns: [{ name: "QuadrantView", start: 15, end: 215, cpx: 5 }] }),

  file({ id: "cu/f/arc/bld",  loc: 180, riskScore: 32, layer: "adapter",
    fns: [{ name: "buildArcLayout", start: 10, end: 175, cpx: 7 }] }),
  file({ id: "cu/f/arc/ui",   loc: 200, riskScore: 25, layer: "ui",
    fns: [{ name: "ArcView", start: 15, end: 195, cpx: 5 }] }),

  file({ id: "cu/f/emb/bld",  loc: 190, riskScore: 28, layer: "adapter",
    fns: [{ name: "buildEmbeddingLayout", start: 10, end: 185, cpx: 7 }] }),
  file({ id: "cu/f/emb/ui",   loc: 240, riskScore: 22, layer: "ui",
    fns: [{ name: "EmbeddingMapView", start: 15, end: 235, cpx: 5 }] }),

  file({ id: "cu/f/blast/bld", loc: 210, riskScore: 35, layer: "adapter",
    fns: [{ name: "buildBlastLayout", start: 10, end: 205, cpx: 8 }] }),
  file({ id: "cu/f/blast/ui",  loc: 260, riskScore: 30, layer: "ui",
    fns: [{ name: "BlastView", start: 15, end: 255, cpx: 6 }] }),

  file({ id: "cu/f/al/bld",   loc: 220, riskScore: 38, layer: "adapter",
    fns: [{ name: "buildArchLayerLayout", start: 10, end: 215, cpx: 8 }] }),
  file({ id: "cu/f/al/ui",    loc: 280, riskScore: 32, layer: "ui",
    fns: [{ name: "ArchLayerView", start: 15, end: 275, cpx: 6 }] }),

  file({ id: "cu/f/debt/bld", loc: 160, riskScore: 28, layer: "adapter",
    fns: [{ name: "buildDebtChartLayout", start: 10, end: 155, cpx: 6 }] }),
  file({ id: "cu/f/debt/ui",  loc: 240, riskScore: 22, layer: "ui",
    fns: [{ name: "DebtChartView", start: 15, end: 235, cpx: 5 }] }),

  file({ id: "cu/f/rf/bld",   loc: 180, riskScore: 30, layer: "adapter",
    fns: [{ name: "buildRefactorTerrainLayout", start: 10, end: 175, cpx: 6 }] }),
  file({ id: "cu/f/rf/ui",    loc: 220, riskScore: 25, layer: "ui",
    fns: [{ name: "RefactorTerrainView", start: 15, end: 215, cpx: 5 }] }),

  file({ id: "cu/f/analyze/ui", loc: 260, riskScore: 35, layer: "ui",
    fns: [{ name: "AnalyzePanel", start: 15, end: 255, cpx: 6 }] }),
  file({ id: "cu/f/analyze/q",  loc: 100, riskScore: 15, layer: "domain" }),

  // ══ code-universe widgets (cu/w) ═══════════════════════════════════════════
  // CanvasShell is the largest file — integrates all 11 view overlays.
  // ui→infra violation stamped (imports ide/ipc directly).
  file({ id: "cu/w/shell", loc: 730, riskScore: 88, layer: "ui",
    signals: { cpxMax: 15, blastCritical: 3, archViolations: 1 },
    fns: [{ name: "CanvasShell",      start: 50,  end: 400, cpx: 15 },
          { name: "useOverlayMemos",  start: 405, end: 550, cpx: 8 },
          { name: "renderOverlay",    start: 555, end: 680, cpx: 6 },
          { name: "useKeyBindings",   start: 685, end: 725, cpx: 4 }] }),
  file({ id: "cu/w/vp",   loc: 480, riskScore: 65, layer: "ui",
    signals: { cpxMax: 11 },
    fns: [{ name: "CanvasViewport", start: 20,  end: 320, cpx: 11 },
          { name: "usePanZoom",     start: 325, end: 475, cpx: 7 }] }),
  file({ id: "cu/w/mm",   loc: 220, riskScore: 40, layer: "ui",
    fns: [{ name: "MiniMap", start: 15, end: 215, cpx: 6 }] }),
  file({ id: "cu/w/lp",   loc: 280, riskScore: 45, layer: "ui",
    fns: [{ name: "LeftPanel", start: 15, end: 275, cpx: 7 }] }),
  file({ id: "cu/w/tb",   loc: 240, riskScore: 38, layer: "ui",
    fns: [{ name: "CanvasToolbar", start: 15, end: 235, cpx: 5 }] }),
  file({ id: "cu/w/ht",   loc: 120, riskScore: 20, layer: "ui",
    fns: [{ name: "HoverTooltip", start: 15, end: 115, cpx: 3 }] }),

  // ══ code-universe shared (cu/s) ════════════════════════════════════════════
  // pixi-scene.ts — highest risk in the repo. God file, 890 LoC.
  file({ id: "cu/s/pixi",  loc: 890, riskScore: 95, layer: "ui",
    signals: { cpxMax: 18, taintCount: 3, blastCritical: 4, deadCount: 5 },
    fns: [{ name: "PixiSceneManager", start: 20,  end: 320, cpx: 18 },
          { name: "buildTierSprites", start: 325, end: 520, cpx: 11 },
          { name: "handleEvents",     start: 525, end: 700, cpx: 9 },
          { name: "dispose",          start: 705, end: 885, cpx: 4 }] }),
  file({ id: "cu/s/graph",  loc: 180, riskScore: 15, layer: "domain" }),
  file({ id: "cu/s/tokens", loc: 80,  riskScore: 5,  layer: "ui" }),
  file({ id: "cu/s/mock",   loc: 120, riskScore: 8,  layer: "util" }),
  file({ id: "cu/s/entity", loc: 220, riskScore: 42, layer: "domain" }),
  // cu/e/store: adapter→ui violation (imports cu/s/pixi)
  file({ id: "cu/e/store",  loc: 180, riskScore: 38, layer: "adapter",
    signals: { archViolations: 1 },
    fns: [{ name: "entityStore", start: 5, end: 175, cpx: 5 }] }),

  // ══ ide-shell ══════════════════════════════════════════════════════════════
  file({ id: "ide/main",    loc: 160, riskScore: 35, layer: "infra",
    fns: [{ name: "main", start: 10, end: 155, cpx: 4 }] }),
  file({ id: "ide/bridge",  loc: 240, riskScore: 48, layer: "adapter",
    fns: [{ name: "createBridge",  start: 10,  end: 140, cpx: 6 },
          { name: "handleMessage", start: 145, end: 235, cpx: 5 }] }),
  // ide/ipc: infra→ui violation (imports cu/s/tokens at startup)
  file({ id: "ide/ipc",     loc: 280, riskScore: 52, layer: "infra",
    fns: [{ name: "IpcHandler",  start: 10,  end: 160, cpx: 8 },
          { name: "registerCmd", start: 165, end: 275, cpx: 5 }] }),
  file({ id: "ide/ws",      loc: 220, riskScore: 45, layer: "infra",
    fns: [{ name: "WorkspaceLoader", start: 10, end: 215, cpx: 7 }] }),
  file({ id: "ide/host",    loc: 150, riskScore: 28, layer: "adapter" }),
  file({ id: "ide/auth",    loc: 300, riskScore: 60, layer: "infra",
    signals: { taintCount: 2, cpxMax: 9 },
    fns: [{ name: "AuthHandler",   start: 10,  end: 180, cpx: 9 },
          { name: "validateToken", start: 185, end: 295, cpx: 5 }] }),
  file({ id: "ide/overlay", loc: 140, riskScore: 25, layer: "ui" }),
  file({ id: "ide/routes",  loc: 100, riskScore: 18, layer: "ui" }),
];

// ─── edges ──────────────────────────────────────────────────────────────────

// Named IDs for edges that appear in GraphHistory deltas.
const EID = {
  // cycle-closing edges (absent from base snapshot, added later)
  MM_VM:    "e-mm-vm",     // cu/f/mm/store → cu/f/vm/store (cycle! added at snapshot 5)
  ROLL_BLD: "e-roll-bld",  // ce/g/rollup → ce/g/build (cycle! added at snapshot 7)
  // violation edges (added incrementally — see history)
  VIO1: "e-vio1",  // ce/rnd/heb (adapter) → cu/s/pixi (ui):    adapter→ui
  VIO2: "e-vio2",  // cu/w/shell (ui)      → ide/ipc  (infra):  ui→infra
  VIO3: "e-vio3",  // cu/e/store (adapter) → cu/s/pixi (ui):    adapter→ui
  VIO4: "e-vio4",  // ide/ipc   (infra)    → cu/s/tokens (ui):  infra→ui
} as const;

let eid = 0;
function newEid(): string { return `er-${String(++eid).padStart(3, "0")}`; }

interface EdgeOpts {
  kind?: FileEdge["kind"];
  layer?: FileEdge["layer"];
  weight?: number;
  severity?: EdgeSeverity;
  id?: string;
}
function edge(from: string, to: string, opts: EdgeOpts = {}): FileEdge {
  return {
    id:     opts.id ?? newEid(),
    from,   to,
    kind:   opts.kind   ?? "import",
    layer:  opts.layer  ?? "structural",
    weight: opts.weight ?? 1,
    ...(opts.severity ? { severity: opts.severity } : {}),
  };
}

// EDGES_BASE — all "clean" structural edges present at the project start.
// Their IDs populate the base snapshot's edgeIds array in GraphHistory.
const EDGES_BASE: FileEdge[] = [
  // ── canvas-engine graph core ──────────────────────────────────────────────
  edge("ce/g/build",    "ce/g/types"),
  edge("ce/g/build",    "ce/g/rollup"),
  edge("ce/g/scc",      "ce/g/types"),
  edge("ce/g/metrics",  "ce/g/types"),
  edge("ce/g/metrics",  "ce/g/scc"),
  edge("ce/g/metrics",  "ce/g/blast"),
  edge("ce/g/blast",    "ce/g/types"),
  edge("ce/g/arch",     "ce/g/types"),
  edge("ce/g/debt",     "ce/g/types"),
  edge("ce/g/debt",     "ce/g/scc"),
  edge("ce/g/debt",     "ce/g/arch"),
  edge("ce/g/debt",     "ce/g/metrics"),
  edge("ce/g/refactor", "ce/g/types"),
  edge("ce/g/refactor", "ce/g/scc"),
  edge("ce/g/refactor", "ce/g/suggest"),
  edge("ce/g/refactor", "ce/g/rank"),
  edge("ce/g/rank",     "ce/g/types"),
  edge("ce/g/rank",     "ce/g/metrics"),
  edge("ce/g/suggest",  "ce/g/types"),

  // ── canvas-engine layout ──────────────────────────────────────────────────
  edge("ce/layout/sq",   "ce/g/types"),
  edge("ce/layout/sq",   "ce/util/geom"),
  edge("ce/layout/msdf", "ce/util/fnv"),
  edge("ce/layout/hier", "ce/g/types"),
  edge("ce/layout/hier", "ce/layout/sq"),
  edge("ce/s/layout",    "ce/util/geom"),

  // ── canvas-engine tier ────────────────────────────────────────────────────
  edge("ce/tier/ladder", "ce/g/types"),
  edge("ce/tier/rollup", "ce/g/types"),
  edge("ce/tier/rollup", "ce/tier/ladder"),

  // ── canvas-engine pixi ────────────────────────────────────────────────────
  edge("ce/pixi/scene",  "ce/g/types"),
  edge("ce/pixi/scene",  "ce/layout/sq",   { weight: 4 }),
  edge("ce/pixi/scene",  "ce/pixi/sprite"),
  edge("ce/pixi/scene",  "ce/pixi/canvas"),
  edge("ce/pixi/scene",  "ce/layout/msdf"),
  edge("ce/pixi/scene",  "ce/tier/rollup", { weight: 3 }),
  edge("ce/pixi/scene",  "ce/g/arch"),
  edge("ce/pixi/sprite", "ce/g/types"),
  edge("ce/pixi/canvas", "ce/g/types"),

  // ── canvas-engine renderers ───────────────────────────────────────────────
  edge("ce/rnd/chord",   "ce/g/types"),
  edge("ce/rnd/chord",   "ce/util/geom"),
  edge("ce/rnd/heb",     "ce/g/types"),
  edge("ce/rnd/heb",     "ce/util/geom"),
  edge("ce/rnd/arc",     "ce/g/types"),
  edge("ce/rnd/arc",     "ce/g/scc"),

  // ── canvas-engine utils ───────────────────────────────────────────────────
  edge("ce/util/hull",   "ce/util/geom"),

  // ── canvas-engine barrel ──────────────────────────────────────────────────
  edge("ce/index", "ce/g/types"),
  edge("ce/index", "ce/g/build"),
  edge("ce/index", "ce/g/scc"),
  edge("ce/index", "ce/g/metrics"),
  edge("ce/index", "ce/g/blast"),
  edge("ce/index", "ce/g/arch"),
  edge("ce/index", "ce/g/debt"),
  edge("ce/index", "ce/g/refactor"),
  edge("ce/index", "ce/g/rank"),
  edge("ce/index", "ce/g/suggest"),

  // ── cu/ent (entities) ─────────────────────────────────────────────────────
  edge("cu/ent/entity",      "cu/s/graph"),
  edge("cu/ent/tree",        "cu/ent/entity"),
  edge("cu/ent/tree",        "ce/g/types"),
  edge("cu/ent/tree",        "ce/g/rollup"),
  edge("cu/ent/interaction", "cu/ent/entity"),
  edge("cu/ent/interaction", "cu/ent/sel"),
  edge("cu/ent/sel",         "cu/ent/entity"),
  edge("cu/ent/hover",       "cu/ent/entity"),
  edge("cu/ent/render",      "cu/s/pixi"),
  edge("cu/ent/render",      "cu/ent/entity"),
  edge("cu/s/entity",        "cu/s/graph"),
  edge("cu/e/store",         "cu/s/entity"),
  edge("cu/e/store",         "cu/ent/entity"),

  // ── cu/f features ─────────────────────────────────────────────────────────
  // chord
  edge("cu/f/chord/bld", "ce/index",         { weight: 2 }),
  edge("cu/f/chord/bld", "ce/g/metrics"),
  edge("cu/f/chord/ui",  "cu/f/chord/bld"),
  edge("cu/f/chord/ui",  "cu/ent/interaction"),
  // mind-map
  edge("cu/f/mm/bld",    "ce/index",         { weight: 3 }),
  edge("cu/f/mm/bld",    "ce/g/scc"),
  edge("cu/f/mm/bld",    "ce/g/metrics"),
  edge("cu/f/mm/ui",     "cu/f/mm/bld"),
  edge("cu/f/mm/ui",     "cu/f/mm/store"),
  edge("cu/f/mm/ui",     "cu/ent/interaction"),
  // view-mode (vm/store → mm/store: normal dep; cycle closes when mm/store → vm/store)
  edge("cu/f/vm/store",  "cu/f/mm/store"),
  edge("cu/f/vm/ui",     "cu/f/vm/store"),
  // quadrant
  edge("cu/f/qd/bld",    "ce/index",         { weight: 2 }),
  edge("cu/f/qd/bld",    "ce/g/metrics"),
  edge("cu/f/qd/ui",     "cu/f/qd/bld"),
  edge("cu/f/qd/ui",     "cu/ent/hover"),
  // arc
  edge("cu/f/arc/bld",   "ce/index"),
  edge("cu/f/arc/bld",   "ce/g/metrics"),
  edge("cu/f/arc/ui",    "cu/f/arc/bld"),
  edge("cu/f/arc/ui",    "cu/ent/hover"),
  // embedding
  edge("cu/f/emb/bld",   "ce/index",         { weight: 2 }),
  edge("cu/f/emb/bld",   "ce/g/scc"),
  edge("cu/f/emb/ui",    "cu/f/emb/bld"),
  // blast
  edge("cu/f/blast/bld", "ce/index",         { weight: 2 }),
  edge("cu/f/blast/bld", "ce/g/metrics"),
  edge("cu/f/blast/ui",  "cu/f/blast/bld"),
  // arch-layer
  edge("cu/f/al/bld",    "ce/index",         { weight: 2 }),
  edge("cu/f/al/ui",     "cu/f/al/bld"),
  // debt
  edge("cu/f/debt/bld",  "ce/index"),
  edge("cu/f/debt/ui",   "cu/f/debt/bld"),
  // refactor
  edge("cu/f/rf/bld",    "ce/index",         { weight: 2 }),
  edge("cu/f/rf/ui",     "cu/f/rf/bld"),
  // analyze
  edge("cu/f/analyze/ui","cu/f/analyze/q"),
  edge("cu/f/analyze/ui","ce/index"),

  // ── cu/w widgets ──────────────────────────────────────────────────────────
  edge("cu/w/shell", "cu/f/chord/ui",        { weight: 2 }),
  edge("cu/w/shell", "cu/f/mm/ui",           { weight: 3 }),
  edge("cu/w/shell", "cu/f/vm/store",        { weight: 2 }),
  edge("cu/w/shell", "cu/f/qd/ui"),
  edge("cu/w/shell", "cu/f/arc/ui"),
  edge("cu/w/shell", "cu/f/emb/ui"),
  edge("cu/w/shell", "cu/f/blast/ui"),
  edge("cu/w/shell", "cu/f/al/ui"),
  edge("cu/w/shell", "cu/f/debt/ui"),
  edge("cu/w/shell", "cu/f/rf/ui"),
  edge("cu/w/shell", "cu/f/analyze/ui"),
  edge("cu/w/shell", "cu/s/pixi",            { weight: 5, severity: "high" }),
  edge("cu/w/shell", "cu/ent/interaction",   { weight: 3 }),
  edge("cu/w/vp",    "cu/s/pixi",            { weight: 4 }),
  edge("cu/w/vp",    "cu/ent/interaction"),
  edge("cu/w/mm",    "cu/s/pixi",            { weight: 2 }),
  edge("cu/w/lp",    "cu/ent/entity"),
  edge("cu/w/lp",    "cu/ent/sel"),
  edge("cu/w/tb",    "cu/f/vm/store"),
  edge("cu/w/tb",    "cu/f/vm/ui"),
  edge("cu/w/tb",    "cu/f/analyze/q"),
  edge("cu/w/ht",    "cu/ent/hover"),

  // ── ide-shell ─────────────────────────────────────────────────────────────
  edge("ide/main",    "ide/bridge"),
  edge("ide/main",    "ide/ws"),
  edge("ide/main",    "ide/auth"),
  edge("ide/main",    "ide/routes"),
  edge("ide/bridge",  "ide/ipc"),
  edge("ide/bridge",  "ide/host"),
  edge("ide/ws",      "ide/host"),
  edge("ide/ws",      "ce/index",            { weight: 3 }),
  edge("ide/ws",      "ce/g/types"),
  edge("ide/host",    "ce/index"),
  edge("ide/overlay", "cu/w/shell"),
  edge("ide/routes",  "ide/overlay"),
  edge("ide/routes",  "ide/auth"),
];

// Named/special edges — violations and cycle-closers.
const EDGES_SPECIAL: FileEdge[] = [
  // ── violation edges (added incrementally per GraphHistory) ────────────────
  edge("ce/rnd/heb",   "cu/s/pixi",     { id: EID.VIO1, severity: "high",     kind: "call",   weight: 2 }),
  edge("cu/w/shell",   "ide/ipc",       { id: EID.VIO2, severity: "high",     kind: "call",   weight: 2 }),
  edge("cu/e/store",   "cu/s/pixi",     { id: EID.VIO3, severity: "critical", kind: "import", weight: 3 }),
  edge("ide/ipc",      "cu/s/tokens",   { id: EID.VIO4, severity: "high",     kind: "import", weight: 1 }),
  // ── cycle-closing edges (absent from base snapshot) ───────────────────────
  // mm/store begins importing vm/store (snapshot 5) → cycle: vm/store↔mm/store
  edge("cu/f/mm/store","cu/f/vm/store", { id: EID.MM_VM,    severity: "critical", kind: "import", weight: 1 }),
  // rollup starts calling back into build (snapshot 7) → cycle: build↔rollup
  edge("ce/g/rollup",  "ce/g/build",    { id: EID.ROLL_BLD, severity: "critical", kind: "call",   weight: 1 }),
];

const EDGES: FileEdge[] = [...EDGES_BASE, ...EDGES_SPECIAL];

// ─── graph history ───────────────────────────────────────────────────────────
// 12 snapshots covering the last 6 months.
// sccCount trajectory:       0 0 0 0 0  1 1 2 2 2 2 2
// archViolationCount:        0 0 1 2 2  2 3 3 4 4 4 4
//
// baseIndex=0 → snapshot 0 carries the absolute edgeIds set; all others delta.

const NOW = 1745193600000;  // 2026-04-21 UTC
const D   = 86_400_000;     // 1 day ms
const W   = D * 7;
const M   = D * 30;

const BASE_EDGE_IDS: readonly string[] = EDGES_BASE.map(e => e.id);

const HISTORY: GraphHistory = {
  baseIndex: 0,
  snapshots: [
    // ── 0: clean baseline, 6 months ago ──────────────────────────────────
    {
      timestamp:  NOW - 6 * M,
      label:      "feat: initial canvas architecture",
      commitSha:  "a1b2c3d",
      author:     "Jo",
      edgeIds:    BASE_EDGE_IDS,
      additions:  3420, deletions: 0,
    },
    // ── 1: chord + mind-map views land ───────────────────────────────────
    {
      timestamp:  NOW - 5 * M,
      label:      "feat: add chord + mind-map views",
      commitSha:  "d4e5f6a",
      author:     "Jo",
      added:      [],
      additions:  820, deletions: 45,
    },
    // ── 2: first arch violation — heb renderer shortcuts into pixi ────────
    {
      timestamp:  NOW - 4 * M - 2 * W,
      label:      "feat: HEB renderer experimental pixi binding",
      commitSha:  "b7c8d9e",
      author:     "Jo",
      added:      [EID.VIO1],
      additions:  95, deletions: 12,
      message:    "ce/rnd/heb bypasses the engine abstraction and imports cu/s/pixi directly",
    },
    // ── 3: second violation — CanvasShell reaches into ide/ipc ───────────
    {
      timestamp:  NOW - 4 * M,
      label:      "fix: force-close IPC on canvas unmount",
      commitSha:  "e0f1a2b",
      author:     "Jo",
      added:      [EID.VIO2],
      additions:  38, deletions: 5,
      message:    "ui/CanvasShell imports infra/ide/ipc — crosses layer boundary",
    },
    // ── 4: normal growth, no new violations ──────────────────────────────
    {
      timestamp:  NOW - 3 * M - 2 * W,
      label:      "refactor: extract entity store",
      commitSha:  "c3d4e5f",
      author:     "Jo",
      added:      [],
      additions:  280, deletions: 120,
    },
    // ── 5: FIRST CYCLE — mm/store begins reading vm/store.mode ───────────
    {
      timestamp:  NOW - 3 * M,
      label:      "feat: view-mode auto-switch on mindmap open",
      commitSha:  "f6a7b8c",
      author:     "Jo",
      added:      [EID.MM_VM],
      additions:  38, deletions: 5,
      message:    "mm/store now reads vm/store.mode → introduces cu/f/vm/store ↔ cu/f/mm/store cycle",
    },
    // ── 6: third violation — entity store shortcuts into pixi ─────────────
    {
      timestamp:  NOW - 2 * M - 2 * W,
      label:      "feat: entity store direct pixi binding",
      commitSha:  "d9e0f1a",
      author:     "Jo",
      added:      [EID.VIO3],
      additions:  65, deletions: 12,
    },
    // ── 7: SECOND CYCLE — rollup calls back into build ────────────────────
    {
      timestamp:  NOW - 2 * M,
      label:      "refactor: rollup calls build.validate() inline",
      commitSha:  "b2c3d4e",
      author:     "Jo",
      added:      [EID.ROLL_BLD],
      additions:  24, deletions: 8,
      message:    "ce/g/rollup calls build.validate() → introduces ce/g/build ↔ ce/g/rollup cycle",
    },
    // ── 8: fourth violation — ipc reads design tokens at startup ─────────
    {
      timestamp:  NOW - M - 2 * W,
      label:      "feat: ipc reads design tokens at startup",
      commitSha:  "e5f6a7b",
      author:     "Jo",
      added:      [EID.VIO4],
      additions:  18, deletions: 0,
    },
    // ── 9-11: new view features land; debt stays flat ─────────────────────
    {
      timestamp:  NOW - M,
      label:      "feat: arch-layer + debt + refactor views",
      commitSha:  "c8d9e0f",
      author:     "Jo",
      added:      [],
      additions:  1240, deletions: 85,
    },
    {
      timestamp:  NOW - 2 * W,
      label:      "feat: quadrant + arc + embedding views",
      commitSha:  "a1b2c3e",
      author:     "Jo",
      added:      [],
      additions:  980, deletions: 45,
    },
    {
      timestamp:  NOW - 3 * D,
      label:      "feat: canvas shell redesign",
      commitSha:  "f4a5b6c",
      author:     "Jo",
      added:      [],
      additions:  560, deletions: 220,
    },
  ],
};

// ─── blame ───────────────────────────────────────────────────────────────────

const BLAME: Record<string, FileBlame> = {
  // ── high churn: last touched < 1 week ago ─────────────────────────────────
  "cu/s/pixi": {
    fileId: "cu/s/pixi", lineCount: 890,
    entries: [
      { startLine: 1,   endLine: 50,  committedAt: NOW - 2*D,  author: "Jo", commitSha: "f4a5b6c", message: "fix: dispose race condition" },
      { startLine: 51,  endLine: 200, committedAt: NOW - 5*D,  author: "Jo", commitSha: "a1b2c3e", message: "feat: LOD-aware sprite batching" },
      { startLine: 201, endLine: 400, committedAt: NOW - 2*W,  author: "Jo", commitSha: "a1b2c3e", message: "feat: tier-5 render path" },
      { startLine: 401, endLine: 650, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f", message: "refactor: extract pool manager" },
      { startLine: 651, endLine: 890, committedAt: NOW - 6*W,  author: "Jo", commitSha: "b9c0d1e", message: "feat: initial pixi scene" },
    ],
  },
  "cu/w/shell": {
    fileId: "cu/w/shell", lineCount: 730,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - D,    author: "Jo", commitSha: "f4a5b6c", message: "feat: add all 7 new overlay views" },
      { startLine: 81,  endLine: 250, committedAt: NOW - 4*D,  author: "Jo", commitSha: "a1b2c3e", message: "refactor: OVERLAY_STYLE constant" },
      { startLine: 251, endLine: 500, committedAt: NOW - 2*W,  author: "Jo", commitSha: "a1b2c3e", message: "feat: blast + arch-layer integration" },
      { startLine: 501, endLine: 730, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f", message: "feat: initial canvas shell" },
    ],
  },
  "cu/w/vp": {
    fileId: "cu/w/vp", lineCount: 480,
    entries: [
      { startLine: 1,   endLine: 120, committedAt: NOW - 3*D,  author: "Jo", commitSha: "f4a5b6c" },
      { startLine: 121, endLine: 320, committedAt: NOW - 3*W,  author: "Jo", commitSha: "a1b2c3e" },
      { startLine: 321, endLine: 480, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f" },
    ],
  },
  "cu/f/mm/bld": {
    fileId: "cu/f/mm/bld", lineCount: 240,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - 5*D,  author: "Jo", commitSha: "a1b2c3e" },
      { startLine: 81,  endLine: 240, committedAt: NOW - 6*W,  author: "Jo", commitSha: "b9c0d1e" },
    ],
  },
  // ── medium churn: last touched 1–8 weeks ago ─────────────────────────────
  "ce/pixi/scene": {
    fileId: "ce/pixi/scene", lineCount: 580,
    entries: [
      { startLine: 1,   endLine: 150, committedAt: NOW - 2*W,  author: "Jo" },
      { startLine: 151, endLine: 350, committedAt: NOW - 6*W,  author: "Jo" },
      { startLine: 351, endLine: 580, committedAt: NOW - 3*M,  author: "Jo" },
    ],
  },
  "cu/ent/render": {
    fileId: "cu/ent/render", lineCount: 320,
    entries: [
      { startLine: 1,   endLine: 100, committedAt: NOW - 3*W,  author: "Jo" },
      { startLine: 101, endLine: 320, committedAt: NOW - 2*M,  author: "Jo" },
    ],
  },
  "cu/f/chord/bld": {
    fileId: "cu/f/chord/bld", lineCount: 280,
    entries: [
      { startLine: 1,   endLine: 280, committedAt: NOW - 5*W,  author: "Jo" },
    ],
  },
  "cu/f/al/bld": {
    fileId: "cu/f/al/bld", lineCount: 220,
    entries: [
      { startLine: 1,   endLine: 220, committedAt: NOW - 2*W,  author: "Jo" },
    ],
  },
  "ide/auth": {
    fileId: "ide/auth", lineCount: 300,
    entries: [
      { startLine: 1,   endLine: 100, committedAt: NOW - W,    author: "Jo" },
      { startLine: 101, endLine: 300, committedAt: NOW - 4*M,  author: "Jo" },
    ],
  },
  "ide/ipc": {
    fileId: "ide/ipc", lineCount: 280,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - M,    author: "Jo" },
      { startLine: 81,  endLine: 280, committedAt: NOW - 4*M,  author: "Jo" },
    ],
  },
  // ── low churn: last touched > 3 months ago ────────────────────────────────
  "ce/layout/sq": {
    fileId: "ce/layout/sq", lineCount: 220,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - 4*M,  author: "Jo" },
      { startLine: 81,  endLine: 220, committedAt: NOW - 5*M,  author: "Jo" },
    ],
  },
  "ce/g/types": {
    fileId: "ce/g/types", lineCount: 220,
    entries: [{ startLine: 1, endLine: 220, committedAt: NOW - 5*M, author: "Jo" }],
  },
  "ce/g/scc": {
    fileId: "ce/g/scc", lineCount: 180,
    entries: [{ startLine: 1, endLine: 180, committedAt: NOW - 5*M, author: "Jo" }],
  },
  "ce/util/fnv": {
    fileId: "ce/util/fnv", lineCount: 30,
    entries: [{ startLine: 1, endLine: 30,  committedAt: NOW - 6*M, author: "Jo" }],
  },
  "ce/util/geom": {
    fileId: "ce/util/geom", lineCount: 50,
    entries: [{ startLine: 1, endLine: 50,  committedAt: NOW - 5*M, author: "Jo" }],
  },
};

// ─── latency ─────────────────────────────────────────────────────────────────

const LATENCY: Record<string, FileLatency> = {
  // CanvasShell — heavy mount cost, all overlays computed on first render
  "cu/w/shell":    { fileId: "cu/w/shell",    p50: 2.1,  p95: 8.4,    p99: 22.0,   callCount: 4 },
  // pixi-scene — main render loop, called every animation frame
  "cu/s/pixi":     { fileId: "cu/s/pixi",     p50: 0.8,  p95: 3.2,    p99: 9.5,    callCount: 60 },
  // squarified treemap — CPU-bound recursive packer
  "ce/layout/sq":  { fileId: "ce/layout/sq",  p50: 45.0, p95: 120.0,  p99: 280.0,  callCount: 2 },
  // SCC — Tarjan's DFS over full graph, O(V+E)
  "ce/g/scc":      { fileId: "ce/g/scc",      p50: 18.0, p95: 55.0,   p99: 130.0,  callCount: 3 },
  // entity batch renderer — runs every entity update
  "cu/ent/render": { fileId: "cu/ent/render",  p50: 1.4,  p95: 5.8,    p99: 14.0,   callCount: 30 },
  // workspace loader — I/O bound (reads git + AST)
  "ide/ws":        { fileId: "ide/ws",         p50: 420.0, p95: 1100.0, p99: 2800.0, callCount: 1 },
  // IPC bridge — round-trip Tauri → main process
  "ide/bridge":    { fileId: "ide/bridge",     p50: 1.2,  p95: 4.0,    p99: 12.0,   callCount: 25 },
  // workspace metrics — runs all sub-analyses; triggered on graph change
  "ce/g/metrics":  { fileId: "ce/g/metrics",   p50: 32.0, p95: 95.0,   p99: 220.0,  callCount: 1 },
};

// ─── effects ─────────────────────────────────────────────────────────────────

const EFFECTS: Record<string, FileEffects> = {
  "ide/ws":       { fileId: "ide/ws",       effects: ["fs", "io"],            pureFunctions: 2, totalFunctions: 4 },
  "ide/ipc":      { fileId: "ide/ipc",      effects: ["net", "io"],           pureFunctions: 1, totalFunctions: 6 },
  "ide/auth":     { fileId: "ide/auth",     effects: ["net", "crypto", "env"],pureFunctions: 2, totalFunctions: 8 },
  "ide/bridge":   { fileId: "ide/bridge",   effects: ["net"],                 pureFunctions: 3, totalFunctions: 7 },
  "cu/s/pixi":    { fileId: "cu/s/pixi",    effects: ["io"],                  pureFunctions: 5, totalFunctions: 18 },
  "ce/g/metrics": { fileId: "ce/g/metrics", effects: ["time"],                pureFunctions: 3, totalFunctions: 5 },
};

// ─── traces ──────────────────────────────────────────────────────────────────
// One captured trace: "load workspace" — the critical startup hot path.
// Shows where the 543 ms budget goes (I/O → build → SCC → layout → metrics).

const TRACES: TracePack = {
  traces: [
    {
      id:          "trace-load-workspace",
      label:       "load workspace",
      capturedAt:  NOW - D,
      totalMs:     543,
      spans: [
        { fileId: "ide/ws",      symbol: "WorkspaceLoader",                startMs: 0,   durationMs: 543, selfMs: 18,  depth: 0 },
        { fileId: "ide/bridge",  symbol: "handleMessage",                  startMs: 8,   durationMs: 12,  selfMs: 12,  depth: 1 },
        { fileId: "ce/index",    symbol: "buildGraph",                     startMs: 22,  durationMs: 480, selfMs: 5,   depth: 1 },
        { fileId: "ce/g/build",  symbol: "buildGraph",                     startMs: 25,  durationMs: 240, selfMs: 80,  depth: 2 },
        { fileId: "ce/g/rollup", symbol: "rollup",                         startMs: 30,  durationMs: 50,  selfMs: 50,  depth: 3 },
        { fileId: "ce/g/scc",    symbol: "findStronglyConnectedComponents",startMs: 85,  durationMs: 55,  selfMs: 55,  depth: 3 },
        { fileId: "ce/g/arch",   symbol: "detectArchViolations",           startMs: 145, durationMs: 35,  selfMs: 35,  depth: 3 },
        { fileId: "ce/layout/sq",symbol: "squarifyInto",                   startMs: 270, durationMs: 210, selfMs: 210, depth: 2 },
        { fileId: "ce/g/metrics",symbol: "computeWorkspaceMetrics",        startMs: 485, durationMs: 30,  selfMs: 30,  depth: 2 },
      ],
      edges: [
        { from: "ide/ws",      to: "ide/bridge",   fromSymbol: "WorkspaceLoader", toSymbol: "handleMessage",                  callCount: 1, totalDurationMs: 12 },
        { from: "ide/ws",      to: "ce/index",     fromSymbol: "WorkspaceLoader", toSymbol: "buildGraph",                     callCount: 1, totalDurationMs: 480 },
        { from: "ce/index",    to: "ce/g/build",   fromSymbol: "buildGraph",      toSymbol: "buildGraph",                     callCount: 1, totalDurationMs: 240 },
        { from: "ce/g/build",  to: "ce/g/rollup",  fromSymbol: "buildGraph",      toSymbol: "rollup",                         callCount: 3, totalDurationMs: 50 },
        { from: "ce/g/build",  to: "ce/g/scc",     fromSymbol: "buildGraph",      toSymbol: "findStronglyConnectedComponents", callCount: 1, totalDurationMs: 55 },
        { from: "ce/g/build",  to: "ce/g/arch",    fromSymbol: "validate",        toSymbol: "detectArchViolations",           callCount: 1, totalDurationMs: 35 },
        { from: "ce/index",    to: "ce/layout/sq", fromSymbol: "buildGraph",      toSymbol: "squarifyInto",                   callCount: 1, totalDurationMs: 210 },
        { from: "ce/index",    to: "ce/g/metrics", fromSymbol: "buildGraph",      toSymbol: "computeWorkspaceMetrics",        callCount: 1, totalDurationMs: 30 },
      ],
    },
  ],
};

// ─── export ──────────────────────────────────────────────────────────────────

export const MOCK_GRAPH: WorkspaceGraph = {
  files:    FILES,
  fileEdges: EDGES,
  comments: [],
  history:  HISTORY,
  blame:    BLAME,
  latency:  LATENCY,
  effects:  EFFECTS,
  traces:   TRACES,
};
