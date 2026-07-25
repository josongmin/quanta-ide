export interface ChangedLine {
  line: number;
  /** 0-10, higher = more important to cover. */
  riskWeight: number;
  /** Hunk identifier for grouping related lines. */
  hunkId: string;
}

export interface TestCase {
  id: string;
  /** Fully-qualified test name, e.g. "test_orchestrator_dispatch_happy_path". */
  name: string;
  /** Relative path to the test file, e.g. "tests/test_orchestrator.py". */
  file: string;
  /** Runtime cost in seconds. */
  costSec: number;
  /** Changed-line numbers this test exercises. Subset of ChangedLine.line. */
  covers: number[];
  lastOutcome: "pass" | "fail" | "flaky";
  /** Free-form tags — "unit" | "integration" | "e2e" | "security" | … */
  tags?: string[];
}

export type Scenario = "ci-all" | "pr-gate" | "pre-push";

export interface ScenarioResult {
  budgetSec: number;
  /** Test ids picked by greedy set-cover under the scenario budget. */
  selected: string[];
  /** Sum of riskWeight covered by the selected tests. */
  coveredRisk: number;
  /** Changed lines with no selected test covering them. */
  uncoveredLines: number[];
}

export interface TestIntel {
  changedLines: ChangedLine[];
  tests: TestCase[];
  /** Sum of all ChangedLine.riskWeight. */
  totalRiskWeight: number;
  scenarios: Record<Scenario, ScenarioResult>;
}
