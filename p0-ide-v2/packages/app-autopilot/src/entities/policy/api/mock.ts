import type { EngineeringPolicy } from "../model/types";
import { daysAgo } from "@quanta/app-autopilot/shared/lib";

export const POLICIES: readonly EngineeringPolicy[] = [
  {
    id: "policy_repo_default",
    name: "Repo default safety",
    scope: { repo: true },
    allowedOperators: ["rule_repair", "test_generation"],
    allowedOperations: [
      "add_tests",
      "delete_dead_code",
      "safe_rename",
      "extract_function",
      "rewrite_imports",
      "repair_layer_violation",
      "repair_import_boundary",
    ],
    forbiddenOperations: [
      "public_api_break",
      "schema_change",
      "security_semantics_change",
    ],
    protectedZones: [
      {
        path: "services/auth/src/session/",
        reason: "Auth session code — human review required on any change.",
        mode: "approval_required",
      },
      {
        path: "services/billing/src/public-api/",
        reason: "Billing public surface — breakage here cascades to 6 consumers.",
        mode: "approval_required",
      },
      {
        path: "infra/",
        reason: "Deploy + secrets. Never auto-edit.",
        mode: "read_only",
      },
    ],
    approvalPolicy: {
      requireApprovalForRisk: ["medium", "high", "critical"],
      requireApprovalForProtectedZone: true,
      requireApprovalForPublicSurface: true,
    },
    riskPolicy: {
      maxRisk: "medium",
      maxFilesPerPr: 12,
      maxChangedLinesPerPr: 400,
      maxPrsPerRun: 3,
    },
    createdAt: daysAgo(42),
    updatedAt: daysAgo(3),
  },
  {
    id: "policy_payments_strict",
    name: "Payments — strict",
    scope: { paths: ["services/billing/**", "services/ledger/**"] },
    allowedOperators: ["rule_repair"],
    allowedOperations: ["repair_layer_violation", "repair_import_boundary", "safe_rename"],
    forbiddenOperations: [
      "public_api_break",
      "schema_change",
      "security_semantics_change",
      "delete_dead_code",
    ],
    protectedZones: [
      {
        path: "services/billing/src/domain/",
        reason: "Billing domain model — senior review required.",
        mode: "approval_required",
      },
    ],
    approvalPolicy: {
      requireApprovalForRisk: ["medium", "high", "critical"],
      requireApprovalForProtectedZone: true,
      requireApprovalForPublicSurface: true,
    },
    riskPolicy: {
      maxRisk: "low",
      maxFilesPerPr: 6,
      maxChangedLinesPerPr: 200,
      maxPrsPerRun: 2,
    },
    createdAt: daysAgo(18),
    updatedAt: daysAgo(1),
  },
];
