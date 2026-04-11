export interface FileMeta {
  name: string;
  path: string;
  type: "file" | "folder";
  // file-level
  role?: string;
  risk?: 1 | 2 | 3 | 4 | 5;
  blast?: number;
  complexity?: number;
  coverage?: number;
  taintPaths?: number;
  owner?: string;
  lastEdit?: string;
  lastEditMsg?: string;
  churn?: string;
  busFactor?: number;
  exports?: string[];
  importsInternal?: number;
  importsExternal?: number;
  dependents?: number;
  // RFC additions
  incidentMatch?: { id: string; title: string; similarity: number };
  changeForecast?: { tests: number; uncovered: number };
  activePr?: { num: string; author: string };
  // folder-level
  fileCount?: number;
  totalLoc?: string;
  health?: 1 | 2 | 3 | 4 | 5;
  hottest?: { name: string; blast: number };
  deadCode?: string;
  team?: { name: string; pct: number }[];
  incidents?: number;
  archLayer?: string;
  violations?: number;
  depDrift?: { target: string; pct: number };
}

export const FILE_META: Record<string, FileMeta> = {
  "refund.ts": {
    name: "refund.ts",
    path: "payments/",
    type: "file",
    role: "refund processing core",
    risk: 4,
    blast: 31,
    complexity: 8.2,
    coverage: 0,
    taintPaths: 2,
    owner: "@kimdev",
    lastEdit: "3w ago",
    lastEditMsg: "hotfix retry logic",
    churn: "14 commits / 3mo",
    busFactor: 1,
    exports: ["processRefund", "sendWebhook"],
    importsInternal: 12,
    importsExternal: 3,
    dependents: 14,
    incidentMatch: { id: "INC-2024-0312", title: "double refund", similarity: 87 },
    changeForecast: { tests: 12, uncovered: 4 },
    activePr: { num: "#234", author: "@parkdev" },
  },
  "charge.ts": {
    name: "charge.ts",
    path: "payments/",
    type: "file",
    role: "stripe charge handler",
    risk: 3,
    blast: 18,
    complexity: 5.1,
    coverage: 67,
    taintPaths: 0,
    owner: "@parkdev",
    lastEdit: "1w ago",
    lastEditMsg: "add retry on 429",
    churn: "8 commits / 3mo",
    busFactor: 2,
    exports: ["processCharge"],
    importsInternal: 8,
    importsExternal: 2,
    dependents: 12,
    changeForecast: { tests: 6, uncovered: 1 },
  },
  "ledger.ts": {
    name: "ledger.ts",
    path: "payments/",
    type: "file",
    role: "immutable transaction log",
    risk: 2,
    blast: 8,
    complexity: 2.4,
    coverage: 100,
    taintPaths: 0,
    owner: "@leedev",
    lastEdit: "2mo ago",
    lastEditMsg: "add index on created_at",
    churn: "3 commits / 3mo",
    busFactor: 3,
    exports: ["appendLedger"],
    importsInternal: 4,
    importsExternal: 1,
    dependents: 4,
  },
  "payments": {
    name: "payments/",
    path: "src/",
    type: "folder",
    fileCount: 4,
    totalLoc: "2.1k",
    health: 2,
    hottest: { name: "refund.ts", blast: 31 },
    deadCode: "847 LOC across 2 files",
    coverage: 12,
    team: [
      { name: "@kimdev", pct: 68 },
      { name: "@parkdev", pct: 22 },
      { name: "@leedev", pct: 10 },
    ],
    busFactor: 1,
    incidents: 2,
    archLayer: "domain",
    violations: 1,
    depDrift: { target: "auth", pct: 367 },
  },
  "auth": {
    name: "auth/",
    path: "src/",
    type: "folder",
    fileCount: 3,
    totalLoc: "890",
    health: 3,
    hottest: { name: "session.ts", blast: 12 },
    coverage: 45,
    team: [
      { name: "@parkdev", pct: 55 },
      { name: "@leedev", pct: 45 },
    ],
    busFactor: 2,
    incidents: 1,
    archLayer: "infra",
    violations: 0,
  },
};
