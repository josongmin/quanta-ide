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
  const layer = spec.layer ?? "domain";
  const ext = layer === "ui" ? ".tsx" : ".ts";
  const basename = spec.id.split("/").pop() ?? spec.id;
  return {
    id:    spec.id,
    name:  basename + ext,
    layer,
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
  file({ id: "canvas-engine/graph/types",   loc: 220, riskScore: 10, layer: "domain", signals: { cpxMax: 2 } }),
  file({ id: "canvas-engine/graph/scc",     loc: 180, riskScore: 45, layer: "domain",
    fns: [{ name: "findStronglyConnectedComponents", start: 10, end: 170, cpx: 12 }] }),
  file({ id: "canvas-engine/graph/build",   loc: 200, riskScore: 30, layer: "domain",
    fns: [{ name: "buildGraph",     start: 10,  end: 80,  cpx: 5 },
          { name: "mergeSubgraphs", start: 85,  end: 130, cpx: 3 },
          { name: "validate",       start: 135, end: 195, cpx: 3 }] }),
  file({ id: "canvas-engine/graph/rollup",  loc: 90,  riskScore: 15, layer: "domain",
    fns: [{ name: "rollup",    start: 5,  end: 55, cpx: 2 },
          { name: "rollupKind",start: 60, end: 85, cpx: 1 }] }),
  file({ id: "canvas-engine/graph/metrics", loc: 150, riskScore: 25, layer: "domain",
    fns: [{ name: "computeWorkspaceMetrics", start: 10, end: 140, cpx: 7 }] }),
  file({ id: "canvas-engine/graph/blast",   loc: 210, riskScore: 40, layer: "domain",
    fns: [{ name: "computeBlastCone", start: 10,  end: 100, cpx: 9 },
          { name: "computeFixCone",   start: 105, end: 200, cpx: 8 }] }),
  file({ id: "canvas-engine/graph/arch",    loc: 170, riskScore: 35, layer: "domain",
    fns: [{ name: "detectArchViolations", start: 10, end: 160, cpx: 10 }] }),
  file({ id: "canvas-engine/graph/debt",    loc: 140, riskScore: 28, layer: "domain",
    fns: [{ name: "computeDebtTrajectory", start: 10, end: 130, cpx: 8 }] }),
  file({ id: "canvas-engine/graph/refactor",loc: 160, riskScore: 32, layer: "domain",
    fns: [{ name: "computeRefactorROI", start: 10, end: 90,  cpx: 7 },
          { name: "rankStartHere",      start: 95, end: 155, cpx: 5 }] }),
  file({ id: "canvas-engine/graph/suggest", loc: 140, riskScore: 25, layer: "domain",
    fns: [{ name: "buildRefactorSuggestions", start: 10, end: 130, cpx: 6 }] }),
  file({ id: "canvas-engine/graph/rank",    loc: 120, riskScore: 20, layer: "domain",
    fns: [{ name: "rankStartHere", start: 10, end: 115, cpx: 5 }] }),

  // ── canvas-engine layout ─────────────────────────────────────────────────
  file({ id: "canvas-engine/layout/sq",   loc: 220, riskScore: 55, layer: "domain",
    signals: { cpxMax: 8, deadCount: 2 },
    fns: [{ name: "squarifyInto", start: 15,  end: 120, cpx: 8 },
          { name: "worstAspect",  start: 125, end: 155, cpx: 4 },
          { name: "flushRow",     start: 160, end: 215, cpx: 6 }] }),
  file({ id: "canvas-engine/layout/msdf", loc: 190, riskScore: 40, layer: "domain",
    fns: [{ name: "buildMSDFAtlas", start: 10,  end: 100, cpx: 6 },
          { name: "measureText",    start: 105, end: 185, cpx: 4 }] }),
  file({ id: "canvas-engine/layout/hier", loc: 150, riskScore: 25, layer: "domain",
    fns: [{ name: "buildHierarchicalLayout", start: 20, end: 90,  cpx: 3 },
          { name: "rollupWeight",             start: 95, end: 145, cpx: 3 }] }),
  file({ id: "canvas-engine/shared/layout",    loc: 90,  riskScore: 18, layer: "domain" }),

  // ── canvas-engine tier ───────────────────────────────────────────────────
  file({ id: "canvas-engine/tier/ladder", loc: 80,  riskScore: 15, layer: "domain",
    fns: [{ name: "resolveTierByApparentSize", start: 20, end: 50, cpx: 3 }] }),
  file({ id: "canvas-engine/tier/rollup", loc: 140, riskScore: 20, layer: "domain",
    fns: [{ name: "rollupEdges",         start: 15, end: 60,  cpx: 2 },
          { name: "makeAncestorResolver", start: 65, end: 100, cpx: 3 }] }),

  // ── canvas-engine pixi renderer — adapter ───────────────────────────────
  file({ id: "canvas-engine/pixi/scene",  loc: 580, riskScore: 72, layer: "adapter",
    signals: { cpxMax: 14, taintCount: 1, blastCritical: 2 },
    fns: [{ name: "PixiScene",    start: 10,  end: 200, cpx: 14 },
          { name: "renderTier",   start: 205, end: 340, cpx: 8 },
          { name: "syncEntities", start: 345, end: 450, cpx: 6 },
          { name: "teardown",     start: 455, end: 570, cpx: 3 }] }),
  file({ id: "canvas-engine/pixi/sprite",  loc: 200, riskScore: 35, layer: "adapter",
    fns: [{ name: "makeSprite",  start: 10,  end: 100, cpx: 4 },
          { name: "recyclePool", start: 105, end: 195, cpx: 3 }] }),
  file({ id: "canvas-engine/pixi/canvas",  loc: 160, riskScore: 28, layer: "adapter",
    fns: [{ name: "initCanvas", start: 10, end: 80,  cpx: 3 },
          { name: "resize",     start: 85, end: 155, cpx: 2 }] }),

  // ── canvas-engine view renderers — adapter ───────────────────────────────
  file({ id: "canvas-engine/renderer/chord",   loc: 250, riskScore: 42, layer: "adapter",
    fns: [{ name: "renderChord", start: 10,  end: 140, cpx: 7 },
          { name: "chordArc",    start: 145, end: 245, cpx: 5 }] }),
  // canvas-engine/renderer/heb has a violation: adapter importing ui-layer code-universe/shared/pixi
  file({ id: "canvas-engine/renderer/heb",     loc: 220, riskScore: 38, layer: "adapter",
    signals: { archViolations: 1 },
    fns: [{ name: "renderHEB",   start: 10,  end: 130, cpx: 8 },
          { name: "bundleEdges", start: 135, end: 215, cpx: 5 }] }),
  file({ id: "canvas-engine/renderer/arc",     loc: 180, riskScore: 32, layer: "adapter",
    fns: [{ name: "renderArc", start: 10,  end: 100, cpx: 5 },
          { name: "arcPath",   start: 105, end: 175, cpx: 3 }] }),

  // ── canvas-engine utils ──────────────────────────────────────────────────
  file({ id: "canvas-engine/util/fnv",  loc: 30, riskScore: 5,  layer: "util" }),
  file({ id: "canvas-engine/util/hull", loc: 60, riskScore: 12, layer: "util",
    fns: [{ name: "convexHull", start: 5, end: 55, cpx: 4 }] }),
  file({ id: "canvas-engine/util/geom", loc: 50, riskScore: 8,  layer: "util" }),

  // ── canvas-engine barrel ─────────────────────────────────────────────────
  file({ id: "canvas-engine/index", loc: 40, riskScore: 5, layer: "adapter" }),

  // ══ code-universe entities (cu/ent) ════════════════════════════════════════
  file({ id: "code-universe/entities/entity",      loc: 140, riskScore: 20, layer: "domain" }),
  file({ id: "code-universe/entities/tree",        loc: 260, riskScore: 35, layer: "adapter",
    fns: [{ name: "buildEntityTree", start: 10,  end: 180, cpx: 9 },
          { name: "kindFromPath",    start: 185, end: 255, cpx: 4 }] }),
  file({ id: "code-universe/entities/interaction",  loc: 220, riskScore: 45, layer: "adapter",
    fns: [{ name: "interactionReducer",   start: 10,  end: 120, cpx: 7 },
          { name: "useInteractionStore",   start: 125, end: 215, cpx: 3 }] }),
  file({ id: "code-universe/entities/sel",          loc: 180, riskScore: 30, layer: "adapter",
    fns: [{ name: "selectEntity", start: 10,  end: 100, cpx: 5 },
          { name: "multiSelect",  start: 105, end: 175, cpx: 4 }] }),
  file({ id: "code-universe/entities/hover",        loc: 120, riskScore: 22, layer: "adapter" }),
  file({ id: "code-universe/entities/render",       loc: 320, riskScore: 55, layer: "adapter",
    signals: { cpxMax: 10 },
    fns: [{ name: "renderEntity", start: 10,  end: 180, cpx: 10 },
          { name: "batchUpdate",  start: 185, end: 315, cpx: 7 }] }),

  // ══ code-universe features (cu/f) ══════════════════════════════════════════
  file({ id: "code-universe/features/chord/build", loc: 280, riskScore: 42, layer: "adapter",
    fns: [{ name: "buildChordLayout",  start: 10,  end: 200, cpx: 8 },
          { name: "normalizeWeights",  start: 205, end: 275, cpx: 3 }] }),
  file({ id: "code-universe/features/chord/ui",  loc: 320, riskScore: 35, layer: "ui",
    fns: [{ name: "ChordView", start: 15, end: 315, cpx: 6 }] }),

  file({ id: "code-universe/features/mind-map/store",  loc: 120, riskScore: 25, layer: "adapter",
    fns: [{ name: "mindMapStore", start: 5, end: 115, cpx: 3 }] }),
  file({ id: "code-universe/features/mind-map/build",    loc: 240, riskScore: 38, layer: "adapter",
    fns: [{ name: "buildMindMapLayout", start: 10, end: 235, cpx: 9 }] }),
  file({ id: "code-universe/features/mind-map/ui",     loc: 380, riskScore: 42, layer: "ui",
    signals: { cpxMax: 8 },
    fns: [{ name: "MindMapView", start: 15, end: 375, cpx: 8 }] }),

  // view-mode store (code-universe/features/view-mode/store → code-universe/features/mind-map/store is the "normal" half of the cycle)
  file({ id: "code-universe/features/view-mode/store",  loc: 90,  riskScore: 12, layer: "adapter",
    fns: [{ name: "viewModeStore", start: 5, end: 85, cpx: 2 }] }),
  file({ id: "code-universe/features/view-mode/ui",     loc: 130, riskScore: 15, layer: "ui",
    fns: [{ name: "ViewModePicker", start: 5, end: 125, cpx: 3 }] }),

  file({ id: "code-universe/features/quadrant/build",   loc: 160, riskScore: 30, layer: "adapter",
    fns: [{ name: "buildQuadrantLayout", start: 10, end: 155, cpx: 6 }] }),
  file({ id: "code-universe/features/quadrant/ui",    loc: 220, riskScore: 28, layer: "ui",
    fns: [{ name: "QuadrantView", start: 15, end: 215, cpx: 5 }] }),

  file({ id: "code-universe/features/arc-view/build",  loc: 180, riskScore: 32, layer: "adapter",
    fns: [{ name: "buildArcLayout", start: 10, end: 175, cpx: 7 }] }),
  file({ id: "code-universe/features/arc-view/ui",   loc: 200, riskScore: 25, layer: "ui",
    fns: [{ name: "ArcView", start: 15, end: 195, cpx: 5 }] }),

  file({ id: "code-universe/features/embedding/build",  loc: 190, riskScore: 28, layer: "adapter",
    fns: [{ name: "buildEmbeddingLayout", start: 10, end: 185, cpx: 7 }] }),
  file({ id: "code-universe/features/embedding/ui",   loc: 240, riskScore: 22, layer: "ui",
    fns: [{ name: "EmbeddingMapView", start: 15, end: 235, cpx: 5 }] }),

  file({ id: "code-universe/features/blast/build", loc: 210, riskScore: 35, layer: "adapter",
    fns: [{ name: "buildBlastLayout", start: 10, end: 205, cpx: 8 }] }),
  file({ id: "code-universe/features/blast/ui",  loc: 260, riskScore: 30, layer: "ui",
    fns: [{ name: "BlastView", start: 15, end: 255, cpx: 6 }] }),

  file({ id: "code-universe/features/arch-layer/build",   loc: 220, riskScore: 38, layer: "adapter",
    fns: [{ name: "buildArchLayerLayout", start: 10, end: 215, cpx: 8 }] }),
  file({ id: "code-universe/features/arch-layer/ui",    loc: 280, riskScore: 32, layer: "ui",
    fns: [{ name: "ArchLayerView", start: 15, end: 275, cpx: 6 }] }),

  file({ id: "code-universe/features/debt/build", loc: 160, riskScore: 28, layer: "adapter",
    fns: [{ name: "buildDebtChartLayout", start: 10, end: 155, cpx: 6 }] }),
  file({ id: "code-universe/features/debt/ui",  loc: 240, riskScore: 22, layer: "ui",
    fns: [{ name: "DebtChartView", start: 15, end: 235, cpx: 5 }] }),

  file({ id: "code-universe/features/refactor/build",   loc: 180, riskScore: 30, layer: "adapter",
    fns: [{ name: "buildRefactorTerrainLayout", start: 10, end: 175, cpx: 6 }] }),
  file({ id: "code-universe/features/refactor/ui",    loc: 220, riskScore: 25, layer: "ui",
    fns: [{ name: "RefactorTerrainView", start: 15, end: 215, cpx: 5 }] }),

  file({ id: "code-universe/features/analyze/ui", loc: 260, riskScore: 35, layer: "ui",
    fns: [{ name: "AnalyzePanel", start: 15, end: 255, cpx: 6 }] }),
  file({ id: "code-universe/features/analyze/q",  loc: 100, riskScore: 15, layer: "domain" }),

  // ══ code-universe widgets (cu/w) ═══════════════════════════════════════════
  // CanvasShell is the largest file — integrates all 11 view overlays.
  // ui→infra violation stamped (imports p0-ide/ipc directly).
  file({ id: "code-universe/widgets/shell", loc: 730, riskScore: 88, layer: "ui",
    signals: { cpxMax: 15, blastCritical: 3, archViolations: 1 },
    fns: [{ name: "CanvasShell",      start: 50,  end: 400, cpx: 15 },
          { name: "useOverlayMemos",  start: 405, end: 550, cpx: 8 },
          { name: "renderOverlay",    start: 555, end: 680, cpx: 6 },
          { name: "useKeyBindings",   start: 685, end: 725, cpx: 4 }] }),
  file({ id: "code-universe/widgets/viewport",   loc: 480, riskScore: 65, layer: "ui",
    signals: { cpxMax: 11 },
    fns: [{ name: "CanvasViewport", start: 20,  end: 320, cpx: 11 },
          { name: "usePanZoom",     start: 325, end: 475, cpx: 7 }] }),
  file({ id: "code-universe/widgets/minimap",   loc: 220, riskScore: 40, layer: "ui",
    fns: [{ name: "MiniMap", start: 15, end: 215, cpx: 6 }] }),
  file({ id: "code-universe/widgets/left-panel",   loc: 280, riskScore: 45, layer: "ui",
    fns: [{ name: "LeftPanel", start: 15, end: 275, cpx: 7 }] }),
  file({ id: "code-universe/widgets/toolbar",   loc: 240, riskScore: 38, layer: "ui",
    fns: [{ name: "CanvasToolbar", start: 15, end: 235, cpx: 5 }] }),
  file({ id: "code-universe/widgets/hover-tooltip",   loc: 120, riskScore: 20, layer: "ui",
    fns: [{ name: "HoverTooltip", start: 15, end: 115, cpx: 3 }] }),

  // ══ code-universe shared (cu/s) ════════════════════════════════════════════
  // pixi-scene.ts — highest risk in the repo. God file, 890 LoC.
  file({ id: "code-universe/shared/pixi",  loc: 890, riskScore: 95, layer: "ui",
    signals: { cpxMax: 18, taintCount: 3, blastCritical: 4, deadCount: 5 },
    fns: [{ name: "PixiSceneManager", start: 20,  end: 320, cpx: 18 },
          { name: "buildTierSprites", start: 325, end: 520, cpx: 11 },
          { name: "handleEvents",     start: 525, end: 700, cpx: 9 },
          { name: "dispose",          start: 705, end: 885, cpx: 4 }] }),
  file({ id: "code-universe/shared/graph",  loc: 180, riskScore: 15, layer: "domain" }),
  file({ id: "code-universe/shared/tokens", loc: 80,  riskScore: 5,  layer: "ui" }),
  file({ id: "code-universe/shared/mock",   loc: 120, riskScore: 8,  layer: "util" }),
  file({ id: "code-universe/shared/entity", loc: 220, riskScore: 42, layer: "domain" }),
  // code-universe/entity/store: adapter→ui violation (imports code-universe/shared/pixi)
  file({ id: "code-universe/entity/store",  loc: 180, riskScore: 38, layer: "adapter",
    signals: { archViolations: 1 },
    fns: [{ name: "entityStore", start: 5, end: 175, cpx: 5 }] }),

  // ══ ide-shell ══════════════════════════════════════════════════════════════
  file({ id: "p0-ide/main",    loc: 160, riskScore: 35, layer: "infra",
    fns: [{ name: "main", start: 10, end: 155, cpx: 4 }] }),
  file({ id: "p0-ide/bridge",  loc: 240, riskScore: 48, layer: "adapter",
    fns: [{ name: "createBridge",  start: 10,  end: 140, cpx: 6 },
          { name: "handleMessage", start: 145, end: 235, cpx: 5 }] }),
  // p0-ide/ipc: infra→ui violation (imports code-universe/shared/tokens at startup)
  file({ id: "p0-p0-ide/ipc",     loc: 280, riskScore: 52, layer: "infra",
    fns: [{ name: "IpcHandler",  start: 10,  end: 160, cpx: 8 },
          { name: "registerCmd", start: 165, end: 275, cpx: 5 }] }),
  file({ id: "p0-ide/ws",      loc: 220, riskScore: 45, layer: "infra",
    fns: [{ name: "WorkspaceLoader", start: 10, end: 215, cpx: 7 }] }),
  file({ id: "p0-ide/host",    loc: 150, riskScore: 28, layer: "adapter" }),
  file({ id: "p0-ide/auth",    loc: 300, riskScore: 60, layer: "infra",
    signals: { taintCount: 2, cpxMax: 9 },
    fns: [{ name: "AuthHandler",   start: 10,  end: 180, cpx: 9 },
          { name: "validateToken", start: 185, end: 295, cpx: 5 }] }),
  file({ id: "p0-ide/overlay", loc: 140, riskScore: 25, layer: "ui" }),
  file({ id: "p0-ide/routes",  loc: 100, riskScore: 18, layer: "ui" }),
];

// ─── edges ──────────────────────────────────────────────────────────────────

// Named IDs for edges that appear in GraphHistory deltas.
const EID = {
  // cycle-closing edges (absent from base snapshot, added later)
  MM_VM:    "e-mm-vm",     // code-universe/features/mind-map/store → code-universe/features/view-mode/store (cycle! added at snapshot 5)
  ROLL_BLD: "e-roll-bld",  // canvas-engine/graph/rollup → canvas-engine/graph/build (cycle! added at snapshot 7)
  // violation edges (added incrementally — see history)
  VIO1: "e-vio1",  // canvas-engine/renderer/heb (adapter) → code-universe/shared/pixi (ui):    adapter→ui
  VIO2: "e-vio2",  // code-universe/widgets/shell (ui)      → p0-ide/ipc  (infra):  ui→infra
  VIO3: "e-vio3",  // code-universe/entity/store (adapter) → code-universe/shared/pixi (ui):    adapter→ui
  VIO4: "e-vio4",  // p0-ide/ipc   (infra)    → code-universe/shared/tokens (ui):  infra→ui
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
  edge("canvas-engine/graph/build",    "canvas-engine/graph/types"),
  edge("canvas-engine/graph/build",    "canvas-engine/graph/rollup"),
  edge("canvas-engine/graph/scc",      "canvas-engine/graph/types"),
  edge("canvas-engine/graph/metrics",  "canvas-engine/graph/types"),
  edge("canvas-engine/graph/metrics",  "canvas-engine/graph/scc"),
  edge("canvas-engine/graph/metrics",  "canvas-engine/graph/blast"),
  edge("canvas-engine/graph/blast",    "canvas-engine/graph/types"),
  edge("canvas-engine/graph/arch",     "canvas-engine/graph/types"),
  edge("canvas-engine/graph/debt",     "canvas-engine/graph/types"),
  edge("canvas-engine/graph/debt",     "canvas-engine/graph/scc"),
  edge("canvas-engine/graph/debt",     "canvas-engine/graph/arch"),
  edge("canvas-engine/graph/debt",     "canvas-engine/graph/metrics"),
  edge("canvas-engine/graph/refactor", "canvas-engine/graph/types"),
  edge("canvas-engine/graph/refactor", "canvas-engine/graph/scc"),
  edge("canvas-engine/graph/refactor", "canvas-engine/graph/suggest"),
  edge("canvas-engine/graph/refactor", "canvas-engine/graph/rank"),
  edge("canvas-engine/graph/rank",     "canvas-engine/graph/types"),
  edge("canvas-engine/graph/rank",     "canvas-engine/graph/metrics"),
  edge("canvas-engine/graph/suggest",  "canvas-engine/graph/types"),

  // ── canvas-engine layout ──────────────────────────────────────────────────
  edge("canvas-engine/layout/sq",   "canvas-engine/graph/types"),
  edge("canvas-engine/layout/sq",   "canvas-engine/util/geom"),
  edge("canvas-engine/layout/msdf", "canvas-engine/util/fnv"),
  edge("canvas-engine/layout/hier", "canvas-engine/graph/types"),
  edge("canvas-engine/layout/hier", "canvas-engine/layout/sq"),
  edge("canvas-engine/shared/layout",    "canvas-engine/util/geom"),

  // ── canvas-engine tier ────────────────────────────────────────────────────
  edge("canvas-engine/tier/ladder", "canvas-engine/graph/types"),
  edge("canvas-engine/tier/rollup", "canvas-engine/graph/types"),
  edge("canvas-engine/tier/rollup", "canvas-engine/tier/ladder"),

  // ── canvas-engine pixi ────────────────────────────────────────────────────
  edge("canvas-engine/pixi/scene",  "canvas-engine/graph/types"),
  edge("canvas-engine/pixi/scene",  "canvas-engine/layout/sq",   { weight: 4 }),
  edge("canvas-engine/pixi/scene",  "canvas-engine/pixi/sprite"),
  edge("canvas-engine/pixi/scene",  "canvas-engine/pixi/canvas"),
  edge("canvas-engine/pixi/scene",  "canvas-engine/layout/msdf"),
  edge("canvas-engine/pixi/scene",  "canvas-engine/tier/rollup", { weight: 3 }),
  edge("canvas-engine/pixi/scene",  "canvas-engine/graph/arch"),
  edge("canvas-engine/pixi/sprite", "canvas-engine/graph/types"),
  edge("canvas-engine/pixi/canvas", "canvas-engine/graph/types"),

  // ── canvas-engine renderers ───────────────────────────────────────────────
  edge("canvas-engine/renderer/chord",   "canvas-engine/graph/types"),
  edge("canvas-engine/renderer/chord",   "canvas-engine/util/geom"),
  edge("canvas-engine/renderer/heb",     "canvas-engine/graph/types"),
  edge("canvas-engine/renderer/heb",     "canvas-engine/util/geom"),
  edge("canvas-engine/renderer/arc",     "canvas-engine/graph/types"),
  edge("canvas-engine/renderer/arc",     "canvas-engine/graph/scc"),

  // ── canvas-engine utils ───────────────────────────────────────────────────
  edge("canvas-engine/util/hull",   "canvas-engine/util/geom"),

  // ── canvas-engine barrel ──────────────────────────────────────────────────
  edge("canvas-engine/index", "canvas-engine/graph/types"),
  edge("canvas-engine/index", "canvas-engine/graph/build"),
  edge("canvas-engine/index", "canvas-engine/graph/scc"),
  edge("canvas-engine/index", "canvas-engine/graph/metrics"),
  edge("canvas-engine/index", "canvas-engine/graph/blast"),
  edge("canvas-engine/index", "canvas-engine/graph/arch"),
  edge("canvas-engine/index", "canvas-engine/graph/debt"),
  edge("canvas-engine/index", "canvas-engine/graph/refactor"),
  edge("canvas-engine/index", "canvas-engine/graph/rank"),
  edge("canvas-engine/index", "canvas-engine/graph/suggest"),

  // ── cu/ent (entities) ─────────────────────────────────────────────────────
  edge("code-universe/entities/entity",      "code-universe/shared/graph"),
  edge("code-universe/entities/tree",        "code-universe/entities/entity"),
  edge("code-universe/entities/tree",        "canvas-engine/graph/types"),
  edge("code-universe/entities/tree",        "canvas-engine/graph/rollup"),
  edge("code-universe/entities/interaction", "code-universe/entities/entity"),
  edge("code-universe/entities/interaction", "code-universe/entities/sel"),
  edge("code-universe/entities/sel",         "code-universe/entities/entity"),
  edge("code-universe/entities/hover",       "code-universe/entities/entity"),
  edge("code-universe/entities/render",      "code-universe/shared/pixi"),
  edge("code-universe/entities/render",      "code-universe/entities/entity"),
  edge("code-universe/shared/entity",        "code-universe/shared/graph"),
  edge("code-universe/entity/store",         "code-universe/shared/entity"),
  edge("code-universe/entity/store",         "code-universe/entities/entity"),

  // ── cu/f features ─────────────────────────────────────────────────────────
  // chord
  edge("code-universe/features/chord/build", "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/chord/build", "canvas-engine/graph/metrics"),
  edge("code-universe/features/chord/ui",  "code-universe/features/chord/build"),
  edge("code-universe/features/chord/ui",  "code-universe/entities/interaction"),
  // mind-map
  edge("code-universe/features/mind-map/build",    "canvas-engine/index",         { weight: 3 }),
  edge("code-universe/features/mind-map/build",    "canvas-engine/graph/scc"),
  edge("code-universe/features/mind-map/build",    "canvas-engine/graph/metrics"),
  edge("code-universe/features/mind-map/ui",     "code-universe/features/mind-map/build"),
  edge("code-universe/features/mind-map/ui",     "code-universe/features/mind-map/store"),
  edge("code-universe/features/mind-map/ui",     "code-universe/entities/interaction"),
  // view-mode (vm/store → mm/store: normal dep; cycle closes when mm/store → vm/store)
  edge("code-universe/features/view-mode/store",  "code-universe/features/mind-map/store"),
  edge("code-universe/features/view-mode/ui",     "code-universe/features/view-mode/store"),
  // quadrant
  edge("code-universe/features/quadrant/build",    "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/quadrant/build",    "canvas-engine/graph/metrics"),
  edge("code-universe/features/quadrant/ui",     "code-universe/features/quadrant/build"),
  edge("code-universe/features/quadrant/ui",     "code-universe/entities/hover"),
  // arc
  edge("code-universe/features/arc-view/build",   "canvas-engine/index"),
  edge("code-universe/features/arc-view/build",   "canvas-engine/graph/metrics"),
  edge("code-universe/features/arc-view/ui",    "code-universe/features/arc-view/build"),
  edge("code-universe/features/arc-view/ui",    "code-universe/entities/hover"),
  // embedding
  edge("code-universe/features/embedding/build",   "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/embedding/build",   "canvas-engine/graph/scc"),
  edge("code-universe/features/embedding/ui",    "code-universe/features/embedding/build"),
  // blast
  edge("code-universe/features/blast/build", "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/blast/build", "canvas-engine/graph/metrics"),
  edge("code-universe/features/blast/ui",  "code-universe/features/blast/build"),
  // arch-layer
  edge("code-universe/features/arch-layer/build",    "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/arch-layer/ui",     "code-universe/features/arch-layer/build"),
  // debt
  edge("code-universe/features/debt/build",  "canvas-engine/index"),
  edge("code-universe/features/debt/ui",   "code-universe/features/debt/build"),
  // refactor
  edge("code-universe/features/refactor/build",    "canvas-engine/index",         { weight: 2 }),
  edge("code-universe/features/refactor/ui",     "code-universe/features/refactor/build"),
  // analyze
  edge("code-universe/features/analyze/ui","code-universe/features/analyze/q"),
  edge("code-universe/features/analyze/ui","canvas-engine/index"),

  // ── cu/w widgets ──────────────────────────────────────────────────────────
  edge("code-universe/widgets/shell", "code-universe/features/chord/ui",        { weight: 2 }),
  edge("code-universe/widgets/shell", "code-universe/features/mind-map/ui",           { weight: 3 }),
  edge("code-universe/widgets/shell", "code-universe/features/view-mode/store",        { weight: 2 }),
  edge("code-universe/widgets/shell", "code-universe/features/quadrant/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/arc-view/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/embedding/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/blast/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/arch-layer/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/debt/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/refactor/ui"),
  edge("code-universe/widgets/shell", "code-universe/features/analyze/ui"),
  edge("code-universe/widgets/shell", "code-universe/shared/pixi",            { weight: 5, severity: "high" }),
  edge("code-universe/widgets/shell", "code-universe/entities/interaction",   { weight: 3 }),
  edge("code-universe/widgets/viewport",    "code-universe/shared/pixi",            { weight: 4 }),
  edge("code-universe/widgets/viewport",    "code-universe/entities/interaction"),
  edge("code-universe/widgets/minimap",    "code-universe/shared/pixi",            { weight: 2 }),
  edge("code-universe/widgets/left-panel",    "code-universe/entities/entity"),
  edge("code-universe/widgets/left-panel",    "code-universe/entities/sel"),
  edge("code-universe/widgets/toolbar",    "code-universe/features/view-mode/store"),
  edge("code-universe/widgets/toolbar",    "code-universe/features/view-mode/ui"),
  edge("code-universe/widgets/toolbar",    "code-universe/features/analyze/q"),
  edge("code-universe/widgets/hover-tooltip",    "code-universe/entities/hover"),

  // ── ide-shell ─────────────────────────────────────────────────────────────
  edge("p0-ide/main",    "p0-ide/bridge"),
  edge("p0-ide/main",    "p0-ide/ws"),
  edge("p0-ide/main",    "p0-ide/auth"),
  edge("p0-ide/main",    "p0-ide/routes"),
  edge("p0-ide/bridge",  "p0-p0-ide/ipc"),
  edge("p0-ide/bridge",  "p0-ide/host"),
  edge("p0-ide/ws",      "p0-ide/host"),
  edge("p0-ide/ws",      "canvas-engine/index",            { weight: 3 }),
  edge("p0-ide/ws",      "canvas-engine/graph/types"),
  edge("p0-ide/host",    "canvas-engine/index"),
  edge("p0-ide/overlay", "code-universe/widgets/shell"),
  edge("p0-ide/routes",  "p0-ide/overlay"),
  edge("p0-ide/routes",  "p0-ide/auth"),
];

// Named/special edges — violations and cycle-closers.
const EDGES_SPECIAL: FileEdge[] = [
  // ── violation edges (added incrementally per GraphHistory) ────────────────
  edge("canvas-engine/renderer/heb",   "code-universe/shared/pixi",     { id: EID.VIO1, severity: "high",     kind: "call",   weight: 2 }),
  edge("code-universe/widgets/shell",   "p0-p0-ide/ipc",       { id: EID.VIO2, severity: "high",     kind: "call",   weight: 2 }),
  edge("code-universe/entity/store",   "code-universe/shared/pixi",     { id: EID.VIO3, severity: "critical", kind: "import", weight: 3 }),
  edge("p0-p0-ide/ipc",      "code-universe/shared/tokens",   { id: EID.VIO4, severity: "high",     kind: "import", weight: 1 }),
  // ── cycle-closing edges (absent from base snapshot) ───────────────────────
  // mm/store begins importing vm/store (snapshot 5) → cycle: vm/store↔mm/store
  edge("code-universe/features/mind-map/store","code-universe/features/view-mode/store", { id: EID.MM_VM,    severity: "critical", kind: "import", weight: 1 }),
  // rollup starts calling back into build (snapshot 7) → cycle: build↔rollup
  edge("canvas-engine/graph/rollup",  "canvas-engine/graph/build",    { id: EID.ROLL_BLD, severity: "critical", kind: "call",   weight: 1 }),
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
      message:    "canvas-engine/renderer/heb bypasses the engine abstraction and imports code-universe/shared/pixi directly",
    },
    // ── 3: second violation — CanvasShell reaches into p0-ide/ipc ───────────
    {
      timestamp:  NOW - 4 * M,
      label:      "fix: force-close IPC on canvas unmount",
      commitSha:  "e0f1a2b",
      author:     "Jo",
      added:      [EID.VIO2],
      additions:  38, deletions: 5,
      message:    "ui/CanvasShell imports infra/p0-ide/ipc — crosses layer boundary",
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
      message:    "mm/store now reads vm/store.mode → introduces code-universe/features/view-mode/store ↔ code-universe/features/mind-map/store cycle",
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
      message:    "canvas-engine/graph/rollup calls build.validate() → introduces canvas-engine/graph/build ↔ canvas-engine/graph/rollup cycle",
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
  "code-universe/shared/pixi": {
    fileId: "code-universe/shared/pixi", lineCount: 890,
    entries: [
      { startLine: 1,   endLine: 50,  committedAt: NOW - 2*D,  author: "Jo", commitSha: "f4a5b6c", message: "fix: dispose race condition" },
      { startLine: 51,  endLine: 200, committedAt: NOW - 5*D,  author: "Jo", commitSha: "a1b2c3e", message: "feat: LOD-aware sprite batching" },
      { startLine: 201, endLine: 400, committedAt: NOW - 2*W,  author: "Jo", commitSha: "a1b2c3e", message: "feat: tier-5 render path" },
      { startLine: 401, endLine: 650, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f", message: "refactor: extract pool manager" },
      { startLine: 651, endLine: 890, committedAt: NOW - 6*W,  author: "Jo", commitSha: "b9c0d1e", message: "feat: initial pixi scene" },
    ],
  },
  "code-universe/widgets/shell": {
    fileId: "code-universe/widgets/shell", lineCount: 730,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - D,    author: "Jo", commitSha: "f4a5b6c", message: "feat: add all 7 new overlay views" },
      { startLine: 81,  endLine: 250, committedAt: NOW - 4*D,  author: "Jo", commitSha: "a1b2c3e", message: "refactor: OVERLAY_STYLE constant" },
      { startLine: 251, endLine: 500, committedAt: NOW - 2*W,  author: "Jo", commitSha: "a1b2c3e", message: "feat: blast + arch-layer integration" },
      { startLine: 501, endLine: 730, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f", message: "feat: initial canvas shell" },
    ],
  },
  "code-universe/widgets/viewport": {
    fileId: "code-universe/widgets/viewport", lineCount: 480,
    entries: [
      { startLine: 1,   endLine: 120, committedAt: NOW - 3*D,  author: "Jo", commitSha: "f4a5b6c" },
      { startLine: 121, endLine: 320, committedAt: NOW - 3*W,  author: "Jo", commitSha: "a1b2c3e" },
      { startLine: 321, endLine: 480, committedAt: NOW - M,    author: "Jo", commitSha: "c8d9e0f" },
    ],
  },
  "code-universe/features/mind-map/build": {
    fileId: "code-universe/features/mind-map/build", lineCount: 240,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - 5*D,  author: "Jo", commitSha: "a1b2c3e" },
      { startLine: 81,  endLine: 240, committedAt: NOW - 6*W,  author: "Jo", commitSha: "b9c0d1e" },
    ],
  },
  // ── medium churn: last touched 1–8 weeks ago ─────────────────────────────
  "canvas-engine/pixi/scene": {
    fileId: "canvas-engine/pixi/scene", lineCount: 580,
    entries: [
      { startLine: 1,   endLine: 150, committedAt: NOW - 2*W,  author: "Jo" },
      { startLine: 151, endLine: 350, committedAt: NOW - 6*W,  author: "Jo" },
      { startLine: 351, endLine: 580, committedAt: NOW - 3*M,  author: "Jo" },
    ],
  },
  "code-universe/entities/render": {
    fileId: "code-universe/entities/render", lineCount: 320,
    entries: [
      { startLine: 1,   endLine: 100, committedAt: NOW - 3*W,  author: "Jo" },
      { startLine: 101, endLine: 320, committedAt: NOW - 2*M,  author: "Jo" },
    ],
  },
  "code-universe/features/chord/build": {
    fileId: "code-universe/features/chord/build", lineCount: 280,
    entries: [
      { startLine: 1,   endLine: 280, committedAt: NOW - 5*W,  author: "Jo" },
    ],
  },
  "code-universe/features/arch-layer/build": {
    fileId: "code-universe/features/arch-layer/build", lineCount: 220,
    entries: [
      { startLine: 1,   endLine: 220, committedAt: NOW - 2*W,  author: "Jo" },
    ],
  },
  "p0-ide/auth": {
    fileId: "p0-ide/auth", lineCount: 300,
    entries: [
      { startLine: 1,   endLine: 100, committedAt: NOW - W,    author: "Jo" },
      { startLine: 101, endLine: 300, committedAt: NOW - 4*M,  author: "Jo" },
    ],
  },
  "p0-p0-ide/ipc": {
    fileId: "p0-p0-ide/ipc", lineCount: 280,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - M,    author: "Jo" },
      { startLine: 81,  endLine: 280, committedAt: NOW - 4*M,  author: "Jo" },
    ],
  },
  // ── low churn: last touched > 3 months ago ────────────────────────────────
  "canvas-engine/layout/sq": {
    fileId: "canvas-engine/layout/sq", lineCount: 220,
    entries: [
      { startLine: 1,   endLine: 80,  committedAt: NOW - 4*M,  author: "Jo" },
      { startLine: 81,  endLine: 220, committedAt: NOW - 5*M,  author: "Jo" },
    ],
  },
  "canvas-engine/graph/types": {
    fileId: "canvas-engine/graph/types", lineCount: 220,
    entries: [{ startLine: 1, endLine: 220, committedAt: NOW - 5*M, author: "Jo" }],
  },
  "canvas-engine/graph/scc": {
    fileId: "canvas-engine/graph/scc", lineCount: 180,
    entries: [{ startLine: 1, endLine: 180, committedAt: NOW - 5*M, author: "Jo" }],
  },
  "canvas-engine/util/fnv": {
    fileId: "canvas-engine/util/fnv", lineCount: 30,
    entries: [{ startLine: 1, endLine: 30,  committedAt: NOW - 6*M, author: "Jo" }],
  },
  "canvas-engine/util/geom": {
    fileId: "canvas-engine/util/geom", lineCount: 50,
    entries: [{ startLine: 1, endLine: 50,  committedAt: NOW - 5*M, author: "Jo" }],
  },
};

// ─── latency ─────────────────────────────────────────────────────────────────

const LATENCY: Record<string, FileLatency> = {
  // CanvasShell — heavy mount cost, all overlays computed on first render
  "code-universe/widgets/shell":    { fileId: "code-universe/widgets/shell",    p50: 2.1,  p95: 8.4,    p99: 22.0,   callCount: 4 },
  // pixi-scene — main render loop, called every animation frame
  "code-universe/shared/pixi":     { fileId: "code-universe/shared/pixi",     p50: 0.8,  p95: 3.2,    p99: 9.5,    callCount: 60 },
  // squarified treemap — CPU-bound recursive packer
  "canvas-engine/layout/sq":  { fileId: "canvas-engine/layout/sq",  p50: 45.0, p95: 120.0,  p99: 280.0,  callCount: 2 },
  // SCC — Tarjan's DFS over full graph, O(V+E)
  "canvas-engine/graph/scc":      { fileId: "canvas-engine/graph/scc",      p50: 18.0, p95: 55.0,   p99: 130.0,  callCount: 3 },
  // entity batch renderer — runs every entity update
  "code-universe/entities/render": { fileId: "code-universe/entities/render",  p50: 1.4,  p95: 5.8,    p99: 14.0,   callCount: 30 },
  // workspace loader — I/O bound (reads git + AST)
  "p0-ide/ws":        { fileId: "p0-ide/ws",         p50: 420.0, p95: 1100.0, p99: 2800.0, callCount: 1 },
  // IPC bridge — round-trip Tauri → main process
  "p0-ide/bridge":    { fileId: "p0-ide/bridge",     p50: 1.2,  p95: 4.0,    p99: 12.0,   callCount: 25 },
  // workspace metrics — runs all sub-analyses; triggered on graph change
  "canvas-engine/graph/metrics":  { fileId: "canvas-engine/graph/metrics",   p50: 32.0, p95: 95.0,   p99: 220.0,  callCount: 1 },
};

// ─── effects ─────────────────────────────────────────────────────────────────

const EFFECTS: Record<string, FileEffects> = {
  "p0-ide/ws":       { fileId: "p0-ide/ws",       effects: ["fs", "io"],            pureFunctions: 2, totalFunctions: 4 },
  "p0-p0-ide/ipc":      { fileId: "p0-p0-ide/ipc",      effects: ["net", "io"],           pureFunctions: 1, totalFunctions: 6 },
  "p0-ide/auth":     { fileId: "p0-ide/auth",     effects: ["net", "crypto", "env"],pureFunctions: 2, totalFunctions: 8 },
  "p0-ide/bridge":   { fileId: "p0-ide/bridge",   effects: ["net"],                 pureFunctions: 3, totalFunctions: 7 },
  "code-universe/shared/pixi":    { fileId: "code-universe/shared/pixi",    effects: ["io"],                  pureFunctions: 5, totalFunctions: 18 },
  "canvas-engine/graph/metrics": { fileId: "canvas-engine/graph/metrics", effects: ["time"],                pureFunctions: 3, totalFunctions: 5 },
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
        { fileId: "p0-ide/ws",      symbol: "WorkspaceLoader",                startMs: 0,   durationMs: 543, selfMs: 18,  depth: 0 },
        { fileId: "p0-ide/bridge",  symbol: "handleMessage",                  startMs: 8,   durationMs: 12,  selfMs: 12,  depth: 1 },
        { fileId: "canvas-engine/index",    symbol: "buildGraph",                     startMs: 22,  durationMs: 480, selfMs: 5,   depth: 1 },
        { fileId: "canvas-engine/graph/build",  symbol: "buildGraph",                     startMs: 25,  durationMs: 240, selfMs: 80,  depth: 2 },
        { fileId: "canvas-engine/graph/rollup", symbol: "rollup",                         startMs: 30,  durationMs: 50,  selfMs: 50,  depth: 3 },
        { fileId: "canvas-engine/graph/scc",    symbol: "findStronglyConnectedComponents",startMs: 85,  durationMs: 55,  selfMs: 55,  depth: 3 },
        { fileId: "canvas-engine/graph/arch",   symbol: "detectArchViolations",           startMs: 145, durationMs: 35,  selfMs: 35,  depth: 3 },
        { fileId: "canvas-engine/layout/sq",symbol: "squarifyInto",                   startMs: 270, durationMs: 210, selfMs: 210, depth: 2 },
        { fileId: "canvas-engine/graph/metrics",symbol: "computeWorkspaceMetrics",        startMs: 485, durationMs: 30,  selfMs: 30,  depth: 2 },
      ],
      edges: [
        { from: "p0-ide/ws",      to: "p0-ide/bridge",   fromSymbol: "WorkspaceLoader", toSymbol: "handleMessage",                  callCount: 1, totalDurationMs: 12 },
        { from: "p0-ide/ws",      to: "canvas-engine/index",     fromSymbol: "WorkspaceLoader", toSymbol: "buildGraph",                     callCount: 1, totalDurationMs: 480 },
        { from: "canvas-engine/index",    to: "canvas-engine/graph/build",   fromSymbol: "buildGraph",      toSymbol: "buildGraph",                     callCount: 1, totalDurationMs: 240 },
        { from: "canvas-engine/graph/build",  to: "canvas-engine/graph/rollup",  fromSymbol: "buildGraph",      toSymbol: "rollup",                         callCount: 3, totalDurationMs: 50 },
        { from: "canvas-engine/graph/build",  to: "canvas-engine/graph/scc",     fromSymbol: "buildGraph",      toSymbol: "findStronglyConnectedComponents", callCount: 1, totalDurationMs: 55 },
        { from: "canvas-engine/graph/build",  to: "canvas-engine/graph/arch",    fromSymbol: "validate",        toSymbol: "detectArchViolations",           callCount: 1, totalDurationMs: 35 },
        { from: "canvas-engine/index",    to: "canvas-engine/layout/sq", fromSymbol: "buildGraph",      toSymbol: "squarifyInto",                   callCount: 1, totalDurationMs: 210 },
        { from: "canvas-engine/index",    to: "canvas-engine/graph/metrics", fromSymbol: "buildGraph",      toSymbol: "computeWorkspaceMetrics",        callCount: 1, totalDurationMs: 30 },
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
