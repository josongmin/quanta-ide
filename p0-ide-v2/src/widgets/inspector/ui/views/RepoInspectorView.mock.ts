export interface RiskFile { name: string; risk: number; issues: number; path: string; }
export interface HotspotAuthor { name: string; riskOwned: number; files: number; }
export interface RepoSignal { icon: string; label: string; severity: 1 | 2 | 3; detail: string; }

export const REPO_DATA = {
  repoName: "codegraph-agent",
  totalFiles: 47,
  analyzedFiles: 47,
  totalLoc: 6_812,
  avgComplexity: 4.7,
  repoRisk: 64,
  taintPaths: 5,
  deadSymbols: 8,
  testCoverage: 38,
  busFactor: 1,
  blastHotspots: 3,
  signals: [
    { icon: "⬇", severity: 3, label: "Unguarded taint sinks", detail: "execute(), save() — tainted strategy written to DB without validation" },
    { icon: "⊘", severity: 3, label: "Test coverage 38%", detail: "0 of 14 critical entrypoints covered by tests" },
    { icon: "⚑", severity: 2, label: "Bus factor = 1", detail: "@songmin owns 74% of the high-risk execution path" },
    { icon: "◎", severity: 2, label: "3 blast-radius hotspots", detail: "execute → 38 files, _select_strategy → 21 files" },
    { icon: "◌", severity: 1, label: "8 dead symbols", detail: "_legacy_inference_bridge +7 — last touched 3–6 months ago" },
  ] as RepoSignal[],
  riskFiles: [
    { name: "orchestrator.py",  path: "codegraph_agent", risk: 78, issues: 5 },
    { name: "security.py",      path: "codegraph_agent", risk: 52, issues: 3 },
    { name: "routing_policy.py",path: "orchestrator",    risk: 44, issues: 2 },
    { name: "audit_store.py",   path: "shared",          risk: 23, issues: 1 },
    { name: "domain/models.py", path: "domain",          risk: 18, issues: 1 },
  ] as RiskFile[],
  authors: [
    { name: "@songmin",    riskOwned: 74, files: 18 },
    { name: "@devops-bot", riskOwned: 28, files: 12 },
    { name: "@carol",      riskOwned: 14, files:  9 },
  ] as HotspotAuthor[],
};

export const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };
