import type { MetricDefinition } from "../model/types";

/**
 * Metric Registry (mock).
 *
 * In production, this is owned by the static-analyzer product. ARE consumes
 * metrics by id only. Here we hard-code a realistic catalog so goals/proofs
 * can reference real metrics.
 */
export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  {
    id: "dependency_cycles",
    name: "Dependency cycles",
    description: "Count of cycles detected in the package-level import graph.",
    unit: "count",
    direction: "lower-better",
    version: "2.1.0",
    source: "quanta.analyzer.deps",
    computeCost: "moderate",
  },
  {
    id: "layer_violations",
    name: "Layer violations",
    description: "Imports that cross architecture layer boundaries.",
    unit: "count",
    direction: "lower-better",
    version: "3.0.0",
    source: "quanta.analyzer.arch",
    computeCost: "cheap",
  },
  {
    id: "god_class_burden",
    name: "God-class burden",
    description:
      "Sum of (responsibilities × fan-in) for classes that exceed the responsibility threshold.",
    unit: "score",
    direction: "lower-better",
    version: "1.4.2",
    source: "quanta.analyzer.struct",
    computeCost: "moderate",
  },
  {
    id: "dead_code_loc",
    name: "Dead code (LoC)",
    description: "Lines of code unreachable from any public entry.",
    unit: "loc",
    direction: "lower-better",
    version: "1.0.0",
    source: "quanta.analyzer.deadcode",
    computeCost: "expensive",
  },
  {
    id: "coverage",
    name: "Test coverage",
    description: "Line coverage from unit tests across production code.",
    unit: "percent",
    direction: "higher-better",
    version: "1.1.0",
    source: "quanta.analyzer.tests",
    computeCost: "moderate",
  },
  {
    id: "flaky_rate",
    name: "Flaky-test rate",
    description: "Share of tests with inconsistent verdict across recent CI runs.",
    unit: "percent",
    direction: "lower-better",
    version: "0.3.0",
    source: "quanta.analyzer.tests",
    computeCost: "cheap",
  },
  {
    id: "public_api_breakages",
    name: "Public API breakages",
    description: "Exports removed or signature-changed since baseline.",
    unit: "count",
    direction: "lower-better",
    version: "1.0.0",
    source: "quanta.analyzer.api",
    computeCost: "cheap",
  },
  {
    id: "layer_violations_delta",
    name: "Layer-violations delta",
    description: "New layer violations introduced vs. baseline. Guardrail metric.",
    unit: "count",
    direction: "lower-better",
    version: "3.0.0",
    source: "quanta.analyzer.arch",
    computeCost: "cheap",
  },
];

const BY_ID = new Map(METRIC_REGISTRY.map((m) => [m.id, m]));

export function findMetric(id: string): MetricDefinition | undefined {
  return BY_ID.get(id);
}
