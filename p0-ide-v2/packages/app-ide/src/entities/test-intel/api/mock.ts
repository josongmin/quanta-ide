import type {
  ChangedLine,
  Scenario,
  ScenarioResult,
  TestCase,
  TestIntel,
} from "../model/types";

/* ══════════════════════════════════════════════════════════════
   Greedy set-cover with cost budget.
   Picks tests maximising (risk-gain / cost) until either no test
   adds positive gain or every candidate exceeds remaining budget.
   ══════════════════════════════════════════════════════════════ */
function greedyCover(
  lines: ChangedLine[],
  tests: TestCase[],
  budget: number,
): ScenarioResult {
  const remaining = new Map<number, number>();
  for (const l of lines) remaining.set(l.line, l.riskWeight);

  const pickedIds: string[] = [];
  const pickedSet = new Set<string>();
  let spent = 0;
  const totalRisk = lines.reduce((acc, l) => acc + l.riskWeight, 0);

  while (true) {
    let best: TestCase | null = null;
    let bestRatio = 0;
    let bestGain = 0;

    for (const t of tests) {
      if (pickedSet.has(t.id)) continue;
      if (spent + t.costSec > budget) continue;
      let gain = 0;
      for (const l of t.covers) gain += remaining.get(l) ?? 0;
      if (gain <= 0) continue;
      const ratio = gain / Math.max(t.costSec, 0.001);
      if (best === null || ratio > bestRatio) {
        best = t;
        bestRatio = ratio;
        bestGain = gain;
      }
    }

    if (!best) break;
    pickedIds.push(best.id);
    pickedSet.add(best.id);
    spent += best.costSec;
    for (const l of best.covers) remaining.delete(l);
    // prevent unused warning without changing control flow
    if (bestGain < 0) break;
  }

  const uncoveredLines: number[] = [];
  for (const [ln] of remaining) uncoveredLines.push(ln);
  uncoveredLines.sort((a, b) => a - b);

  const coveredRisk = totalRisk - uncoveredLines.reduce((acc, ln) => {
    const w = lines.find((l) => l.line === ln)?.riskWeight ?? 0;
    return acc + w;
  }, 0);

  return {
    budgetSec: budget,
    selected: pickedIds,
    coveredRisk,
    uncoveredLines,
  };
}

function buildScenarios(
  lines: ChangedLine[],
  tests: TestCase[],
  budgets: Record<Scenario, number>,
): Record<Scenario, ScenarioResult> {
  return {
    "ci-all": greedyCover(lines, tests, budgets["ci-all"]),
    "pr-gate": greedyCover(lines, tests, budgets["pr-gate"]),
    "pre-push": greedyCover(lines, tests, budgets["pre-push"]),
  };
}

function buildIntel(
  lines: ChangedLine[],
  tests: TestCase[],
  budgets: Record<Scenario, number>,
): TestIntel {
  const totalRiskWeight = lines.reduce((acc, l) => acc + l.riskWeight, 0);
  return {
    changedLines: lines,
    tests,
    totalRiskWeight,
    scenarios: buildScenarios(lines, tests, budgets),
  };
}

/* ─── orchestrator.py — showcase (8 lines, 10 tests) ───────────── */
const ORCH_LINES: ChangedLine[] = [
  { line: 42,  riskWeight: 2, hunkId: "h1" },
  { line: 55,  riskWeight: 3, hunkId: "h1" },
  { line: 88,  riskWeight: 5, hunkId: "h2" },
  { line: 120, riskWeight: 8, hunkId: "h2" },
  { line: 155, riskWeight: 4, hunkId: "h3" },
  { line: 210, riskWeight: 6, hunkId: "h3" },
  { line: 244, riskWeight: 2, hunkId: "h4" },
  { line: 301, riskWeight: 9, hunkId: "h4" },
];

const ORCH_TESTS: TestCase[] = [
  {
    id: "o1",
    name: "test_orchestrator_dispatch_happy_path",
    file: "tests/test_orchestrator.py",
    costSec: 3.2,
    covers: [42, 55, 88],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "o2",
    name: "test_orchestrator_dispatch_fast_path",
    file: "tests/test_orchestrator.py",
    costSec: 4.5,
    covers: [42, 120, 155],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "o3",
    name: "test_orchestrator_deep_v2_route",
    file: "tests/test_orchestrator.py",
    costSec: 6.0,
    covers: [88, 120, 210],
    lastOutcome: "pass",
    tags: ["integration"],
  },
  {
    id: "o4",
    name: "test_orchestrator_legacy_fallback",
    file: "tests/test_orchestrator.py",
    costSec: 2.8,
    covers: [210, 244],
    lastOutcome: "flaky",
    tags: ["unit"],
  },
  {
    id: "o5",
    name: "test_orchestrator_retry_sequence",
    file: "tests/test_orchestrator.py",
    costSec: 5.4,
    covers: [155, 210, 301],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "o6",
    name: "test_orchestrator_timeout_guard",
    file: "tests/test_orchestrator.py",
    costSec: 8.0,
    covers: [88, 120, 301],
    lastOutcome: "pass",
    tags: ["integration"],
  },
  {
    id: "o7",
    name: "test_orchestrator_e2e_deep_chain",
    file: "tests/e2e/test_deep_chain.py",
    costSec: 45.0,
    covers: [42, 55, 88, 120, 155, 210, 244, 301],
    lastOutcome: "pass",
    tags: ["e2e"],
  },
  {
    id: "o8",
    name: "test_orchestrator_cancel_flow",
    file: "tests/test_orchestrator.py",
    costSec: 3.6,
    covers: [55, 244],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "o9",
    name: "test_orchestrator_concurrent_dispatch",
    file: "tests/test_orchestrator_concurrency.py",
    costSec: 9.5,
    covers: [120, 301],
    lastOutcome: "flaky",
    tags: ["integration"],
  },
  {
    id: "o10",
    name: "test_orchestrator_trace_emission",
    file: "tests/test_orchestrator.py",
    costSec: 2.2,
    covers: [42, 244],
    lastOutcome: "pass",
    tags: ["unit"],
  },
];

/* ─── routing_policy.py — 4 lines, 5 tests ─────────────────────── */
const ROUTE_LINES: ChangedLine[] = [
  { line: 14,  riskWeight: 3, hunkId: "h1" },
  { line: 52,  riskWeight: 6, hunkId: "h1" },
  { line: 88,  riskWeight: 4, hunkId: "h2" },
  { line: 140, riskWeight: 7, hunkId: "h2" },
];

const ROUTE_TESTS: TestCase[] = [
  {
    id: "r1",
    name: "test_routing_shard_aware",
    file: "tests/test_routing_policy.py",
    costSec: 2.5,
    covers: [14, 52],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "r2",
    name: "test_routing_retry_on_5xx",
    file: "tests/test_routing_policy.py",
    costSec: 3.1,
    covers: [52, 88],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "r3",
    name: "test_routing_hash_fallback_legacy",
    file: "tests/test_routing_policy.py",
    costSec: 4.0,
    covers: [140],
    lastOutcome: "flaky",
    tags: ["unit"],
  },
  {
    id: "r4",
    name: "test_routing_full_matrix",
    file: "tests/test_routing_policy.py",
    costSec: 12.0,
    covers: [14, 52, 88, 140],
    lastOutcome: "pass",
    tags: ["integration"],
  },
  {
    id: "r5",
    name: "test_routing_health_probe",
    file: "tests/test_routing_policy.py",
    costSec: 1.8,
    covers: [14, 88],
    lastOutcome: "pass",
    tags: ["unit"],
  },
];

/* ─── security.py — 6 lines, 8 tests incl. security-tagged ─────── */
const SEC_LINES: ChangedLine[] = [
  { line: 21,  riskWeight: 4, hunkId: "h1" },
  { line: 77,  riskWeight: 5, hunkId: "h1" },
  { line: 132, riskWeight: 7, hunkId: "h2" },
  { line: 188, riskWeight: 9, hunkId: "h2" },
  { line: 240, riskWeight: 3, hunkId: "h3" },
  { line: 305, riskWeight: 6, hunkId: "h3" },
];

const SEC_TESTS: TestCase[] = [
  {
    id: "s1",
    name: "test_security_mtls_enforced",
    file: "tests/test_security.py",
    costSec: 3.4,
    covers: [21, 77],
    lastOutcome: "pass",
    tags: ["unit", "security"],
  },
  {
    id: "s2",
    name: "test_security_guest_read_denied",
    file: "tests/test_security.py",
    costSec: 4.2,
    covers: [77, 132],
    lastOutcome: "pass",
    tags: ["unit", "security"],
  },
  {
    id: "s3",
    name: "test_security_token_rebind_handshake",
    file: "tests/test_security.py",
    costSec: 11.0,
    covers: [188, 240],
    lastOutcome: "fail",
    tags: ["integration"],
  },
  {
    id: "s4",
    name: "test_security_audit_log_present",
    file: "tests/test_security.py",
    costSec: 2.1,
    covers: [240, 305],
    lastOutcome: "pass",
    tags: ["unit"],
  },
  {
    id: "s5",
    name: "test_security_critical_rebind_path",
    file: "tests/test_security.py",
    costSec: 6.8,
    covers: [132, 188, 305],
    lastOutcome: "pass",
    tags: ["integration", "security"],
  },
  {
    id: "s6",
    name: "test_security_e2e_full_trust_chain",
    file: "tests/e2e/test_trust_chain.py",
    costSec: 38.0,
    covers: [21, 77, 132, 188, 240, 305],
    lastOutcome: "pass",
    tags: ["e2e", "security"],
  },
  {
    id: "s7",
    name: "test_security_session_replay",
    file: "tests/test_security.py",
    costSec: 5.0,
    covers: [188, 240],
    lastOutcome: "flaky",
    tags: ["integration"],
  },
  {
    id: "s8",
    name: "test_security_header_sanitize",
    file: "tests/test_security.py",
    costSec: 1.9,
    covers: [21, 305],
    lastOutcome: "pass",
    tags: ["unit"],
  },
];

export const TEST_INTELS: Record<string, TestIntel> = {
  "orchestrator.py": buildIntel(ORCH_LINES, ORCH_TESTS, {
    "ci-all": 300,
    "pr-gate": 60,
    "pre-push": 15,
  }),
  "routing_policy.py": buildIntel(ROUTE_LINES, ROUTE_TESTS, {
    "ci-all": 120,
    "pr-gate": 30,
    "pre-push": 8,
  }),
  "security.py": buildIntel(SEC_LINES, SEC_TESTS, {
    "ci-all": 180,
    "pr-gate": 45,
    "pre-push": 10,
  }),
};

export function getTestIntel(fileName: string): TestIntel | null {
  return TEST_INTELS[fileName] ?? null;
}
