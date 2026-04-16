export interface InsDelta {
  dir: "up" | "down" | "flat";
  value: string;
  from?: string;
}

export type InsTone = "low" | "med" | "high" | "warn" | "crit";

export interface InsCardData {
  title: string;
  hero: string;
  unit?: string;
  delta?: InsDelta;
  sub: string;
  foot: string;
  tone: InsTone;
}

export const METRIC_CARDS: InsCardData[] = [
  {
    title: "Blast Radius",
    hero: "23",
    unit: "files",
    delta: { dir: "up", value: "+5", from: "was 18 on main" },
    sub: "transitively affected",
    foot: "4 cross-service hops",
    tone: "high",
  },
  {
    title: "Structural Risk",
    hero: "0.72",
    delta: { dir: "up", value: "+0.18", from: "was 0.54 last PR" },
    sub: "engine score · threshold 0.60",
    foot: "2 blockers · 5 high",
    tone: "crit",
  },
  {
    title: "Coverage",
    hero: "38.6%",
    delta: { dir: "down", value: "\u22123.4pp", from: "from 42.0%" },
    sub: "line coverage in payments/*",
    foot: "2 new tests · 4 regressions",
    tone: "warn",
  },
  {
    title: "Complexity",
    hero: "18",
    unit: "cyc",
    delta: { dir: "up", value: "+6", from: "was 12 on main" },
    sub: "retry_handler · budget 15",
    foot: "4 files over budget",
    tone: "warn",
  },
  {
    title: "Test Pass Rate",
    hero: "98.1%",
    delta: { dir: "up", value: "+0.4pp", from: "from 97.7%" },
    sub: "412 / 420 passing",
    foot: "+12 new tests · 0 flaky",
    tone: "low",
  },
  {
    title: "API Latency p99",
    hero: "142",
    unit: "ms",
    delta: { dir: "up", value: "+8ms", from: "budget 200ms" },
    sub: "payments/* · 30d window",
    foot: "stable · within budget",
    tone: "med",
  },
];

export interface CallEdge {
  from: string;
  to: string;
  kind: string;
  hops: number;
}

export const CALL_EDGES: CallEdge[] = [
  { from: "webhook.handle", to: "retry_handler.retry_with_backoff", kind: "modified", hops: 3 },
  { from: "retry_handler.retry_with_backoff", to: "orchestrator.execute", kind: "signature", hops: 1 },
  { from: "orchestrator.execute", to: "ledger.update", kind: "concurrency", hops: 2 },
  { from: "ledger.update", to: "metrics.emit", kind: "new", hops: 1 },
];

export interface IncidentEntry {
  id: string;
  title: string;
  sim: number;
  when: string;
}

export const INCIDENTS: IncidentEntry[] = [
  { id: "INC-842", title: "ledger double-write on refund retry", sim: 0.89, when: "2025-11" },
  { id: "INC-701", title: "jitterless backoff storm on webhooks", sim: 0.74, when: "2025-08" },
  { id: "INC-655", title: "guard leak in auth rotation", sim: 0.52, when: "2025-06" },
];

export interface OwnerEntry {
  team: string;
  owner: string;
  share: number;
  files: number;
}

export const OWNERS: OwnerEntry[] = [
  { team: "Payments Core", owner: "alice", share: 0.62, files: 5 },
  { team: "Shared Infra", owner: "bento", share: 0.23, files: 2 },
  { team: "QA Automation", owner: "claire", share: 0.15, files: 2 },
];
