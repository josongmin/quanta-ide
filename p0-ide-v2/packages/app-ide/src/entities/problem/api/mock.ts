import type { ProblemGroup } from "../model/types";

export const MOCK_PROBLEMS: ProblemGroup[] = [
  {
    path: "codegraph_agent/orchestrator.py",
    items: [
      { id: "p1", severity: "error", line: 142, col: 9, message: "Argument of type 'StrategyId | None' is not assignable to 'StrategyId'.", source: "pyright(reportArgumentType)" },
      { id: "p2", severity: "warn", line: 88, col: 3, message: "Function 'resolve_policy' has a cyclomatic complexity of 14 (max 10).", source: "ruff(C901)" },
    ],
  },
  {
    path: "codegraph_agent/security.py",
    items: [
      { id: "p3", severity: "error", line: 57, col: 12, message: "Possible SQL injection via string concatenation in query builder.", source: "ruff(S608)" },
    ],
  },
  {
    path: "orchestrator/routing_policy.py",
    items: [
      { id: "p4", severity: "warn", line: 31, col: 1, message: "'_legacy_inference_bridge' imported but unused.", source: "ruff(F401)" },
      { id: "p5", severity: "info", line: 204, col: 5, message: "Consider using 'match' statement instead of nested if/elif chain.", source: "ruff(SIM114)" },
    ],
  },
  {
    path: "shared/audit_store.py",
    items: [
      { id: "p6", severity: "info", line: 12, col: 1, message: "Missing docstring on public module.", source: "ruff(D100)" },
    ],
  },
];
