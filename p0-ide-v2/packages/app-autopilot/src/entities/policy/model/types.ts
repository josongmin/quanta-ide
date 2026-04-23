import type { GoalScope } from "@quanta/app-autopilot/entities/goal";

export type OperationKind =
  | "add_tests"
  | "delete_dead_code"
  | "safe_rename"
  | "extract_function"
  | "extract_class"
  | "move_method"
  | "move_module"
  | "dependency_inversion"
  | "rewrite_imports"
  | "repair_layer_violation"
  | "repair_import_boundary"
  | "public_api_break"
  | "schema_change"
  | "security_semantics_change"
  | "runtime_config_change";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface ProtectedZone {
  path: string;
  reason: string;
  mode: "read_only" | "approval_required";
}

export interface ApprovalPolicy {
  requireApprovalForRisk: Array<"medium" | "high" | "critical">;
  requireApprovalForProtectedZone: boolean;
  requireApprovalForPublicSurface: boolean;
}

export interface RiskPolicy {
  maxRisk: "low" | "medium" | "high";
  maxFilesPerPr: number;
  maxChangedLinesPerPr: number;
  maxPrsPerRun: number;
}

export interface EngineeringPolicy {
  id: string;
  name: string;
  scope: GoalScope;
  allowedOperators: string[];
  allowedOperations: OperationKind[];
  forbiddenOperations: OperationKind[];
  protectedZones: ProtectedZone[];
  approvalPolicy: ApprovalPolicy;
  riskPolicy: RiskPolicy;
  createdAt: string;
  updatedAt: string;
}
