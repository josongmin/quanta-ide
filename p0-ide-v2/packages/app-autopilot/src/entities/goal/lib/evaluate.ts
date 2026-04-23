import type { ComparisonOp, GoalTarget } from "../model/types";

export function targetLabel(op: ComparisonOp): string {
  switch (op) {
    case "eq":
      return "=";
    case "neq":
      return "≠";
    case "lt":
      return "<";
    case "lte":
      return "≤";
    case "gt":
      return ">";
    case "gte":
      return "≥";
  }
}

export function compareTarget(current: number, op: ComparisonOp, target: number): boolean {
  switch (op) {
    case "eq":
      return current === target;
    case "neq":
      return current !== target;
    case "lt":
      return current < target;
    case "lte":
      return current <= target;
    case "gt":
      return current > target;
    case "gte":
      return current >= target;
  }
}

/**
 * 0–1 satisfaction fraction for a target given current, baseline, and target.
 * - satisfied if `compareTarget(current, op, target)`
 * - otherwise interpolated from baseline → target linearly
 */
export function evaluateGoal(
  current: number,
  baseline: number,
  target: GoalTarget,
): { satisfied: boolean; progress: number } {
  const t = target.value as number;
  const satisfied = compareTarget(current, target.operator, t);
  if (satisfied) return { satisfied: true, progress: 1 };
  if (baseline === t) return { satisfied: false, progress: 0 };
  const span = Math.abs(baseline - t);
  const moved = Math.abs(baseline - current);
  const progress = Math.max(0, Math.min(1, moved / span));
  return { satisfied: false, progress };
}
