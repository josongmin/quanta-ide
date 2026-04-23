# Autonomous Repo Engineer — Spec Package v0

## 목적

이 문서는 `Autonomous Repo Engineer`의 핵심 runtime contract를 정의하기 위한 초안이다.
주요 대상은 다음 6개다.

- Goal
- Policy
- Work Item
- Operator Contract
- Proof Artifact
- Execution Run

---

## 1. Goal Schema

Goal은 사용자가 선언하는 원하는 엔지니어링 상태다.

```ts
export type EngineeringGoal = {
  id: string
  name: string
  description?: string
  scope: GoalScope
  targets: GoalTarget[]
  guardrails: GoalGuardrail[]
  owner?: GoalOwner
  mode: "observe" | "suggest" | "enforce"
  autonomyProfile: AutonomyProfileId
  executionBudget: ExecutionBudget
  baselineSnapshotId: string
  metricVersionSet: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type AutonomyProfileId = string

export type ExecutionBudget = {
  maxFilesPerPr: number
  maxPrsPerRun: number
  maxParallelTasks: number
}

export type GoalScope = {
  repo?: boolean
  paths?: string[]
  packages?: string[]
  teams?: string[]
  services?: string[]
}

export type GoalTarget = {
  metric: string
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte"
  value: number | string | boolean
  weight?: number
}

export type GoalGuardrail = {
  metric: string
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte"
  value: number | string | boolean
  severity: "warn" | "block"
}

export type GoalOwner = {
  kind: "team" | "person"
  id: string
  displayName: string
}
```

### 예시

```yaml
id: goal_billing_structural_health
name: Billing structural health
scope:
  paths:
    - services/billing/**
targets:
  - metric: god_class_burden
    operator: lte
    value: 20
  - metric: dependency_cycles
    operator: eq
    value: 0
guardrails:
  - metric: public_api_breakages
    operator: eq
    value: 0
    severity: block
  - metric: layer_violations_delta
    operator: lte
    value: 0
    severity: block
mode: enforce
autonomyProfile: senior_guided_refactor
executionBudget:
  maxFilesPerPr: 10
  maxPrsPerRun: 3
  maxParallelTasks: 2
baselineSnapshotId: snap_2026_04_23_billing
```

---

## 2. Policy Schema

Policy는 AI가 어디까지 해도 되는지를 정의한다.
Goal과 결합될 수도 있고 repo/team default로도 존재할 수 있다.

```ts
export type EngineeringPolicy = {
  id: string
  name: string
  scope: GoalScope
  allowedOperators: string[]
  allowedOperations: OperationKind[]
  forbiddenOperations: OperationKind[]
  protectedZones: ProtectedZone[]
  approvalPolicy: ApprovalPolicy
  riskPolicy: RiskPolicy
  createdAt: string
  updatedAt: string
}

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
  | "public_api_break"
  | "schema_change"
  | "security_semantics_change"
  | "runtime_config_change"

export type ProtectedZone = {
  path: string
  reason: string
  mode: "read_only" | "approval_required"
}

export type ApprovalPolicy = {
  requireApprovalForRisk: Array<"medium" | "high" | "critical">
  requireApprovalForProtectedZone: boolean
  requireApprovalForPublicSurface: boolean
}

export type RiskPolicy = {
  maxRisk: "low" | "medium" | "high"
  maxFilesPerPr: number
  maxChangedLinesPerPr: number
  maxPrsPerRun: number
}
```

### 예시

```yaml
id: policy_repo_default
name: Repository default safety
scope:
  repo: true
allowedOperators:
  - refactor
  - test_generation
  - rule_repair
allowedOperations:
  - add_tests
  - delete_dead_code
  - safe_rename
  - extract_function
  - extract_class
  - move_method
  - rewrite_imports
forbiddenOperations:
  - public_api_break
  - schema_change
  - security_semantics_change
protectedZones:
  - path: desktop/src-tauri/src/domain/**
    reason: Domain layer requires explicit human review
    mode: approval_required
approvalPolicy:
  requireApprovalForRisk: [medium, high, critical]
  requireApprovalForProtectedZone: true
  requireApprovalForPublicSurface: true
riskPolicy:
  maxRisk: medium
  maxFilesPerPr: 12
  maxChangedLinesPerPr: 400
  maxPrsPerRun: 3
```

---

## 3. Autonomy Profile Schema

Autonomy Profile은 같은 goal이라도 어떤 execution envelope에서 돌릴지 정한다.

```ts
export type AutonomyProfile = {
  id: string
  name: string
  level: 0 | 1 | 2 | 3 | 4
  description: string
  executionMode: "observe" | "interactive" | "guided" | "autonomous" | "continuous"
  allowedRisk: Array<"low" | "medium" | "high">
  requiresCheckpointReview: boolean
  allowsAutoPr: boolean
  allowsContinuousRuns: boolean
}
```

### 추천 기본 profile

```yaml
- id: safe_production
  level: 3
  executionMode: autonomous
  allowedRisk: [low]
  requiresCheckpointReview: false
  allowsAutoPr: true
  allowsContinuousRuns: true

- id: senior_guided_refactor
  level: 2
  executionMode: guided
  allowedRisk: [low, medium]
  requiresCheckpointReview: true
  allowsAutoPr: true
  allowsContinuousRuns: false

- id: interactive_editor
  level: 1
  executionMode: interactive
  allowedRisk: [low, medium, high]
  requiresCheckpointReview: false
  allowsAutoPr: false
  allowsContinuousRuns: false
```

---

## 4. Work Item Schema

실제 agent에 전달하는 단위는 파일 수정 요청이 아니라 structured work item이어야 한다.

```ts
export type WorkItem = {
  id: string
  source: WorkItemSource
  title: string
  description: string
  scope: GoalScope
  operatorId: string
  taskClass: TaskClass
  riskTier: RiskTier
  relatedGoals: string[]
  relatedOpportunities: string[]
  selectedActions: OperationKind[]
  constraints: WorkConstraints
  proofRequirements: ProofRequirement[]
  expectedOutcome: ExpectedOutcome
  status: WorkItemStatus
  createdAt: string
  updatedAt: string
}

export type WorkItemSource =
  | { kind: "goal_reconciliation"; goalId: string }
  | { kind: "opportunity_engine"; opportunityId: string }
  | { kind: "human_guided_plan"; planId: string }

export type TaskClass =
  | "deterministic_production"
  | "bounded_structural_refactor"
  | "design_sensitive_refactor"
  | "review_governance"

export type RiskTier = "low" | "medium" | "high" | "critical"

export type WorkConstraints = {
  doNotTouchPaths?: string[]
  preservePublicApi?: boolean
  preserveRuntimeSemantics?: boolean
  maxFiles?: number
  maxChangedLines?: number
  requiredTests?: string[]
}

export type ProofRequirement =
  | "typecheck"
  | "lint"
  | "tests"
  | "metric_delta"
  | "api_diff"
  | "rule_diff"
  | "uncertainty_summary"

export type ExpectedOutcome = {
  expectedMetricDeltas?: Array<{
    metric: string
    before?: number
    after?: number
    delta?: number
  }>
  expectedFilesTouched?: number
  expectedPrCount?: number
}

export type WorkItemStatus =
  | "queued"
  | "planned"
  | "running"
  | "blocked"
  | "awaiting_review"
  | "completed"
  | "abandoned"
```

### 예시

```yaml
id: work_billing_cycle_break_01
source:
  kind: goal_reconciliation
  goalId: goal_billing_structural_health
title: Break billing import cycle between orchestrator and resolver
operatorId: refactor
taskClass: bounded_structural_refactor
riskTier: medium
relatedGoals:
  - goal_billing_structural_health
selectedActions:
  - dependency_inversion
  - move_module
constraints:
  doNotTouchPaths:
    - services/billing/public-api/**
  preservePublicApi: true
  preserveRuntimeSemantics: true
  maxFiles: 8
  maxChangedLines: 300
proofRequirements:
  - typecheck
  - lint
  - tests
  - metric_delta
  - api_diff
  - uncertainty_summary
expectedOutcome:
  expectedMetricDeltas:
    - metric: dependency_cycles
      before: 4
      after: 3
      delta: -1
```

---

## 5. Operator Contract

각 operator는 공통 contract를 만족해야 한다.

```ts
export type OperatorContract = {
  id: string
  displayName: string
  supportedTaskClasses: TaskClass[]
  supportedOperations: OperationKind[]
  detect(input: RepositorySnapshot): OperatorCandidate[]
  plan(input: OperatorPlanInput): OperatorPlan
  estimateRisk(input: OperatorPlanInput): RiskEstimate
  buildProofPlan(input: OperatorPlanInput): ProofPlan
  shouldAbandon(input: OperatorPlanInput): AbandonDecision | null
}

export type OperatorCandidate = {
  id: string
  title: string
  scope: GoalScope
  contributingMetrics: string[]
  estimatedValue: number
}

export type OperatorPlan = {
  workItems: WorkItem[]
  sequence: string[]
  expectedDeltaSummary: Array<{ metric: string; delta: number }>
}

export type RiskEstimate = {
  tier: RiskTier
  reasons: string[]
  confidence: number
}

export type ProofPlan = {
  requirements: ProofRequirement[]
  validations: ValidationStep[]
}

export type ValidationStep = {
  kind: string
  command?: string
  blocking: boolean
}

export type AbandonDecision = {
  reason: string
  blockingSignals: string[]
}
```

### 초기 operator 최소셋

- `refactor`
- `test_generation`
- `rule_repair`
- `dependency_hygiene`
- `review_prep`

---

## 6. Proof Artifact Schema

모든 execution run은 proof artifact를 생성해야 한다.

```ts
export type ProofArtifact = {
  id: string
  runId: string
  workItemId: string
  operatorId: string
  goalLinks: string[]
  opportunityLinks: string[]
  changedFiles: string[]
  validations: ValidationResult[]
  metricDiffs: MetricDiff[]
  apiDiff?: ApiDiffSummary
  ruleDiff?: RuleDiffSummary
  risk: RiskEstimate
  uncertainties: string[]
  reviewerRecommendation: ReviewerRecommendation
  createdAt: string
}

export type ValidationResult = {
  kind: string
  status: "pass" | "fail" | "skipped" | "unknown"
  summary: string
}

export type MetricDiff = {
  metric: string
  before: number
  after: number
  delta: number
}

export type ApiDiffSummary = {
  changed: boolean
  details: string[]
}

export type RuleDiffSummary = {
  newViolations: number
  resolvedViolations: number
  details: string[]
}

export type ReviewerRecommendation = {
  kind: "skip" | "skim" | "review" | "focus"
  rationale: string
  suggestedReviewerKinds: string[]
}
```

### reviewer recommendation 기준 예시

- `skip`: mechanical, 100% proof-complete, no public surface change
- `skim`: behavior-preserving structural change, strong proof
- `review`: intended behavior addition or medium-risk structural work
- `focus`: unresolved uncertainty or risky hunk 존재

---

## 7. Execution Run Schema

실제 runtime execution 단위.

```ts
export type ExecutionRun = {
  id: string
  workItemId: string
  branchName?: string
  prNumber?: number
  mode: "interactive" | "guided" | "autonomous" | "continuous"
  status: "created" | "running" | "failed" | "awaiting_review" | "completed" | "abandoned"
  startedAt?: string
  completedAt?: string
  proofArtifactId?: string
  logs: ExecutionLogEntry[]
}

export type ExecutionLogEntry = {
  at: string
  kind: "plan" | "patch" | "validation" | "metric" | "review" | "abort"
  message: string
}
```

---

## 8. Repository Snapshot Schema

planning과 operator detection의 입력.

```ts
export type RepositorySnapshot = {
  id: string
  repoRevision: string
  capturedAt: string
  metrics: Record<string, number>
  hotspots: Hotspot[]
  ownership: OwnershipFact[]
  violations: ViolationFact[]
  opportunities: OpportunityFact[]
}

export type Hotspot = {
  id: string
  kind: string
  path: string
  score: number
  drivers: string[]
}

export type OwnershipFact = {
  path: string
  team?: string
  contributors?: string[]
}

export type ViolationFact = {
  id: string
  kind: string
  path: string
  severity: string
}

export type OpportunityFact = {
  id: string
  kind: string
  path?: string
  score: number
  rationale: string
}
```

---

## 9. Example End-to-End Contracts

### A. Safe test backfill

- Goal: coverage increase
- Operator: `test_generation`
- Task class: `deterministic_production`
- Risk: `low`
- Profile: `safe_production`
- Proof:
  - tests
  - typecheck
  - metric_delta

### B. Senior-guided refactor

- Goal: reduce god class burden
- Operator: `refactor`
- Task class: `bounded_structural_refactor`
- Risk: `medium`
- Profile: `senior_guided_refactor`
- Constraints:
  - preservePublicApi
  - doNotTouchPaths
  - checkpoint review
- Proof:
  - lint
  - tests
  - api_diff
  - metric_delta
  - uncertainty_summary

### C. Rule repair

- Goal: layer violations = 0
- Operator: `rule_repair`
- Task class: `deterministic_production`
- Risk: `low` or `medium`
- Profile: `safe_production` or `senior_guided_refactor`

---

## 10. Recommended First Implementation Slice

가장 먼저 만드는 것이 좋은 최소셋:

1. `EngineeringGoal`
2. `EngineeringPolicy`
3. `AutonomyProfile`
4. `WorkItem`
5. `ProofArtifact`
6. `ExecutionRun`
7. `RepositorySnapshot`

그리고 초기 operator는 다음 3개로 제한:

- `refactor`
- `test_generation`
- `rule_repair`

초기 safe lane도 제한:

- add tests
- delete dead code
- safe rename
- rewrite imports
- bounded extract

---

## 11. Open Questions

1. Goal/Policy를 repo file로 저장할지 server-side only로 둘지?
2. structured plan schema와 natural-language plan을 어떻게 혼합할지?
3. ProofArtifact를 PR comment/check run/UI 중 어디를 canonical로 삼을지?
4. ExecutionRun의 retry/rollback semantics를 얼마나 세밀하게 둘지?
5. AutonomyProfile을 사람이 직접 고를지 trust model이 추천할지?

---

## 12. Recommendation

이 spec package는 다음 원칙으로 유지해야 한다.

- file-level prompting 금지
- work-item contract 우선
- proof artifact 필수
- goal/policy/autonomy를 분리
- operator federation 전제
- ambiguity를 data model에서 숨기지 않기

즉 이 문서의 목적은 AI가 "코드를 고치게" 하는 것이 아니라,
**AI가 어떤 제약과 증빙 하에서 레포 엔지니어링 work를 수행할지 명시하는 것**이다.

