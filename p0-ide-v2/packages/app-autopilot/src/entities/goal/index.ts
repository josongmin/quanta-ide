export type {
  GoalMode,
  ComparisonOp,
  GoalScope,
  GoalTarget,
  GoalGuardrail,
  GoalOwner,
  ExecutionBudget,
  EngineeringGoal,
  GoalTargetStatus,
  GoalStatus,
} from "./model/types";
export { evaluateGoal, targetLabel, compareTarget } from "./lib/evaluate";
export { GOALS, GOAL_STATUS } from "./api/mock";
