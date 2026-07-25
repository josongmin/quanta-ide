import type { InspectorMode } from "@quanta/app-ide/stores/focus-store";

export type { InspectorMode };

export interface InspectorModeMeta {
  id: InspectorMode;
  label: string;
  shortcutDigit?: number;
}

export const INSPECTOR_MODES: readonly InspectorModeMeta[] = [
  { id: "overview", label: "Overview", shortcutDigit: 1 },
  { id: "flow", label: "Flow", shortcutDigit: 2 },
  { id: "request", label: "Request", shortcutDigit: 3 },
  { id: "authz", label: "AuthZ", shortcutDigit: 4 },
  { id: "blast", label: "Blast", shortcutDigit: 5 },
  { id: "incidents", label: "Incidents", shortcutDigit: 6 },
  { id: "behavior", label: "Behavior", shortcutDigit: 7 },
  { id: "ownership", label: "Ownership", shortcutDigit: 8 },
  { id: "config", label: "Config", shortcutDigit: 9 },
  { id: "cve", label: "CVE" },
  { id: "observability", label: "Obs" },
  { id: "transaction", label: "Tx" },
  { id: "idempotency", label: "Idem" },
  { id: "context", label: "Context" },
  { id: "test-impact", label: "Tests" },
  { id: "flags", label: "Flags" },
  { id: "concurrency", label: "Races" },
  { id: "replay", label: "Replay" },
  { id: "refactor-sim", label: "Refactor" },
  { id: "knowledge", label: "Knowledge" },
  { id: "test-intel", label: "TestIntel" },
  { id: "service-mesh", label: "Mesh" },
  { id: "error-flow", label: "Errors" },
  { id: "rollout", label: "Rollout" },
  { id: "intent-gap", label: "Intent" },
  { id: "collab", label: "Reviewers" },
  { id: "eval-bench", label: "Bench" },
  { id: "token-radar", label: "TokenRadar" },
];
