import {
  IconComplexity,
  IconDead,
  IconNoTests,
  IconTaint,
} from "@/shared/ui/icons";

export type FolderTab =
  | "overview"
  | "structure"
  | "duplication"
  | "blast"
  | "incidents"
  | "ownership";

export interface FolderFile { name: string; risk: number; loc: number; issues: number; }
export interface FolderSub { name: string; files: number; risk: number; }
export interface ArchViolation { kind: "layer" | "cycle" | "forbidden"; rule: string; detail: string; sev: 1 | 2 | 3; }
export interface CycleEdge { from: string; to: string; via: string; }
export interface CloneCluster { id: string; size: number; locs: number; sites: string[]; sim: number; }
export interface BoundaryExport { name: string; kind: "fn" | "class" | "const"; usedBy: number; tag?: "unused" | "internal-only"; }
export interface DepEdge { folder: string; weight: number; allowed: boolean; }
export interface BlastCorridor { symbol: string; outFiles: number; outFolders: number; risk: number; }
export interface IncidentMatch { id: string; date: string; pattern: string; matches: number; severity: 1 | 2 | 3; }
export interface Contributor { name: string; commits: number; share: number; ownsRisk: number; }

export const FOLDER_DATA = {
  files: 8,
  subfolders: 2,
  totalLoc: 2_140,
  avgRisk: 41,
  issues: 7,
  coverage: 42,

  // engineering intelligence signature metrics
  archViolations: 4,
  cycles: 1,
  cohesion: 0.38,           // 0..1 (LCOM-derived)
  coupling: 0.71,           // 0..1 (afferent+efferent normalized)
  boundaryExports: 24,
  boundaryUsedExternally: 6,
  duplicationPct: 18,        // % of LoC in clone clusters
  driftPct: 27,              // spec/observed divergence
  hotspotDensity: 0.5,       // |hot ∩ risky| / files
  spark: [32, 35, 38, 40, 42, 44, 46, 49],

  topFiles: [
    { name: "orchestrator.py", risk: 78, loc: 1974, issues: 5 },
    { name: "routing_policy.py", risk: 44, loc: 220, issues: 1 },
    { name: "base.py", risk: 18, loc: 96, issues: 0 },
    { name: "registry.py", risk: 12, loc: 84, issues: 0 },
    { name: "__init__.py", risk: 4, loc: 18, issues: 0 },
  ] as FolderFile[],
  subfoldersList: [
    { name: "tools/", files: 6, risk: 38 },
    { name: "plan_orchestration/", files: 4, risk: 24 },
  ] as FolderSub[],

  signals: [
    { Icon: IconTaint, label: "Boundary leak", detail: "experience_store.save reachable from agents/ without sanitizer", sev: 3 as const },
    { Icon: IconComplexity, label: "Layer break", detail: "domain/ imports infra/storage — should go through ports/", sev: 3 as const },
    { Icon: IconNoTests, label: "Coverage gap", detail: "orchestrator.py 0/12 tests on critical path", sev: 2 as const },
    { Icon: IconDead, label: "Dead surface", detail: "_select_strategy + 3 exports unreferenced", sev: 1 as const },
  ],

  archIssues: [
    { kind: "layer", rule: "domain → infra forbidden", detail: "orchestrator.py:84 imports infra.storage.s3", sev: 3 },
    { kind: "cycle", rule: "import cycle (len 3)", detail: "domain.orchestrator → tools.runner → domain.registry", sev: 3 },
    { kind: "forbidden", rule: "no direct ORM", detail: "routing_policy.py:31 calls Session.execute", sev: 2 },
    { kind: "layer", rule: "public-api leak", detail: "_internal_select exported via __init__.py", sev: 1 },
  ] as ArchViolation[],

  cycleEdges: [
    { from: "domain.orchestrator", to: "tools.runner", via: "execute → run_tool" },
    { from: "tools.runner", to: "domain.registry", via: "run_tool → resolve_strategy" },
    { from: "domain.registry", to: "domain.orchestrator", via: "resolve_strategy → Strategy" },
  ] as CycleEdge[],

  boundary: [
    { name: "Orchestrator", kind: "class", usedBy: 12 },
    { name: "execute", kind: "fn", usedBy: 8 },
    { name: "Strategy", kind: "class", usedBy: 4 },
    { name: "DEFAULT_POLICY", kind: "const", usedBy: 1, tag: "internal-only" },
    { name: "_select_strategy", kind: "fn", usedBy: 0, tag: "unused" },
    { name: "LegacyRouter", kind: "class", usedBy: 0, tag: "unused" },
  ] as BoundaryExport[],

  inbound: [
    { folder: "agents/", weight: 18, allowed: true },
    { folder: "api/", weight: 11, allowed: true },
    { folder: "tools/", weight: 7, allowed: true },
    { folder: "infra/", weight: 2, allowed: false },
  ] as DepEdge[],
  outbound: [
    { folder: "shared/", weight: 14, allowed: true },
    { folder: "ports/", weight: 9, allowed: true },
    { folder: "infra/storage/", weight: 4, allowed: false },
  ] as DepEdge[],

  clones: [
    { id: "cl-1", size: 4, locs: 38, sim: 0.94, sites: ["orchestrator.py:212", "tools/runner.py:88", "agents/exec.py:140", "plan_orchestration/run.py:55"] },
    { id: "cl-2", size: 3, locs: 22, sim: 0.88, sites: ["routing_policy.py:31", "tools/policy.py:14", "agents/router.py:60"] },
    { id: "cl-3", size: 2, locs: 14, sim: 0.81, sites: ["base.py:42", "registry.py:18"] },
  ] as CloneCluster[],

  blastCorridors: [
    { symbol: "Orchestrator.execute", outFiles: 38, outFolders: 6, risk: 78 },
    { symbol: "resolve_strategy",     outFiles: 21, outFolders: 4, risk: 52 },
    { symbol: "Strategy",             outFiles: 14, outFolders: 3, risk: 31 },
  ] as BlastCorridor[],
  blastBoundaryCrossings: 17,

  incidents: [
    { id: "INC-2031", date: "2026-03-22", pattern: "Unvalidated trace persisted to ledger", matches: 3, severity: 3 },
    { id: "INC-1987", date: "2026-02-14", pattern: "Strategy retried after irrecoverable error", matches: 2, severity: 2 },
    { id: "INC-1844", date: "2026-01-09", pattern: "Tool runner swallowed exception", matches: 1, severity: 2 },
  ] as IncidentMatch[],

  busFactor: 1,
  orphanedFiles: 1,
  staleFiles: 2,
  contributors: [
    { name: "@songmin", commits: 142, share: 0.62, ownsRisk: 78 },
    { name: "@carol", commits: 38, share: 0.21, ownsRisk: 22 },
    { name: "@devops-bot", commits: 24, share: 0.13, ownsRisk: 8 },
  ] as Contributor[],
};

export type FolderData = typeof FOLDER_DATA;

export const FOLDER_TABS: { id: FolderTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "structure", label: "Structure" },
  { id: "duplication", label: "Duplication" },
  { id: "blast", label: "Blast" },
  { id: "incidents", label: "Incidents" },
  { id: "ownership", label: "Ownership" },
];

export const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };
