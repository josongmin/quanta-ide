# RFC: 분석 기능 카탈로그 체계 — Insight Catalog OS

**날짜**: 2026-04-23  
**상태**: 제안  
**작성**: Jo + Codex  
**대상**: Code Universe / IDE feature catalog / analysis view registry

---

## 한 줄 정의

> Quanta의 100개+ 분석/통계/AI-native view를 “목록”이 아니라 **관리 가능한 Insight Catalog OS**로 재편한다.  
> 각 기능은 `무엇을 분석하는가(domain)` · `어느 레벨인가(scope)` · `사용자가 뭘 하려는가(intent)` · `얼마나 믿을 수 있고 행동 가능한가(quality)`로 검색/관리/노출된다.

---

## 왜 지금 필요한가

현재 Code Universe는 이미 다음 단계에 들어섰다.

- SE 분석: architecture, quality, testing, refactor, history, ownership, security
- AI-native 분석: token/context/model/cost, agent execution, trust/evidence, governance
- 생산성 분석: DORA, review burden, task flow, budget, DevEx
- 탐색 분석: treemap, mindmap, symbol, path, semantic neighborhood

문제는 기능 수가 늘수록 “좋은 기능이 많다”가 아니라 **찾기 어렵고, 중복되고, 어떤 상황에 써야 할지 모르는 상태**가 된다는 점이다.

현재 구조의 한계:

1. `ViewDescriptor.category`는 11개 정도의 UI 그룹일 뿐, 제품 관리/검색/분석 의도를 표현하지 못한다.
2. `contexts: repo | folder | file`은 너무 얕다. 실제로는 `team`, `project`, `package`, `symbol`, `diff`, `task`, `agent-run`, `model`, `budget` 등이 필요하다.
3. `FeatureManifest`와 `ViewDescriptor`가 분리되어 있어, feature catalog와 view picker가 서로 다른 언어를 쓴다.
4. AI 기능이 `ai` 한 그룹으로 커지면 내부적으로 `AI Agent`, `AI Context`, `AI Trust`, `AI Governance`가 섞인다.
5. 신규 기능 추가 시 “어느 그룹에 넣을지 / 기존 기능과 겹치는지 / 어느 persona가 쓰는지 / 탭으로 열어야 하는지”를 검증하는 관리 체계가 없다.

따라서 카탈로그를 단순 카드 목록이 아니라 **분석 기능의 registry + search index + governance layer + launch surface**로 설계해야 한다.

---

## 목표

1. 분석 기능을 **도메인별/스코프별/의도별**로 찾을 수 있게 한다.
2. “레포 레벨”, “프로젝트/패키지 레벨”, “파일 레벨”, “심볼/디프/에이전트 실행 레벨”을 명확히 구분한다.
3. feature catalog, view picker, command palette, 탭 런처가 같은 메타데이터를 사용한다.
4. 신규 view 추가 시 taxonomy 누락/중복/관리 부채를 CI에서 잡는다.
5. 사용자에게는 “전체 목록”보다 **상황별 추천 경로**를 보여준다.
6. merge/delegate/govern 같은 **decision target**에 insight를 연결한다.
7. admission gate와 agent planner가 catalog를 capability registry로 질의할 수 있게 한다.

비목표:

- 기존 view를 없애는 것.
- 모든 기능을 한 번에 완벽히 재분류하는 것.
- 카탈로그가 실제 분석 엔진 품질을 대체하는 것. 카탈로그는 surfacing/governance layer다.

---

## 리뷰 반영: v2에서 반드시 올라가는 지점

1차 RFC의 방향은 유지하되, 다음 6개는 설계에 **반드시 반영**한다.

1. **Primary Facet 강제**  
   모든 insight는 대표 정체성 `primaryFacet = domain + scope + intent`를 가진다. Secondary facet은 검색 확장용이다.

2. **Intent 축 축소**  
   intent는 9개가 아니라 `explore / explain / diagnose / decide / verify / optimize / govern` 7개로 줄인다. 과도한 intent는 taxonomy inflation을 만든다.

3. **Decision Grade 추가**  
   insight가 단순 참고용인지, 실제 gate 판단에 들어갈 수 있는지 구분한다.

4. **Action Hook 추가**  
   catalog는 `open tab`만 제공하는 viewer가 아니라 `run-analysis / attach-to-review / attach-to-agent-plan / attach-to-admission-gate`를 제공해야 한다.

5. **Executable Workflow Stack**  
   recommended stack은 문서용 묶음이 아니라 실행 가능한 stack spec이어야 한다.

6. **Admission / Agent Binding**  
   catalog는 merge gate와 agent planner가 질의하는 capability registry여야 한다.

따라서 v2 포지셔닝은 다음과 같다.

> Insight Catalog = capability registry + decision surface registry + execution attachment registry.

"찾고 여는 체계"에서 "판단하고 실행시키는 control plane"으로 승격한다.


## 핵심 원칙

### 1. Category가 아니라 facet이다

하나의 기능은 여러 축을 동시에 가진다.

예: `Diff Evidence`

- domain: `ai-trust`
- subdomain: `evidence`
- scope: `diff`, `file`
- intent: `verify`, `decide`
- persona: `reviewer`, `tech-lead`
- surface: `view`, `tab`, `diff-inline`

단일 category로는 표현이 안 된다.

### 2. “어디에 쓰는가”가 “무엇인가”보다 중요하다

사용자는 “AI Trust 기능 보여줘”보다 다음처럼 찾는다.

- “이 PR 믿어도 되나?”
- “이 파일 agent한테 맡겨도 되나?”
- “리팩터 어디부터 해야 하지?”
- “이번 주 리뷰 병목이 어디야?”
- “이 패키지 아키텍처가 왜 흔들렸지?”

그래서 catalog UI는 domain보다 intent entrypoint가 먼저 보여야 한다.

### 3. Scope는 계층형이어야 한다

`repo/folder/file`만으로는 부족하다. 분석 기능은 서로 다른 추상도에서 작동한다.

```ts
type InsightScope =
  | "org"
  | "team"
  | "workspace"
  | "repo"
  | "project"
  | "package"
  | "folder"
  | "module"
  | "file"
  | "symbol"
  | "diff"
  | "task"
  | "agent-run"
  | "model"
  | "budget"
  | "policy";
```

### 4. 카탈로그는 기능 설명서가 아니라 control plane이다

각 card는 “무슨 기능인지”만 말하면 부족하다. 다음 액션을 제공해야 한다.

- Open as tab
- Open in current Universe
- Pin to workspace dashboard
- Compare with related view
- Add to review workflow
- Mark as core/experimental/deprecated
- Show owner / maturity / input dependency

---

## 제안 정보 구조

### 최상위 domain

```ts
type InsightDomain =
  | "explore"
  | "productivity"
  | "ai-agent"
  | "ai-context-model"
  | "ai-trust-governance"
  | "se-architecture"
  | "se-quality"
  | "se-testing"
  | "se-refactor-change"
  | "se-security-supply-chain"
  | "se-evolution"
  | "se-ownership-team";
```

### Domain별 의미

| Domain | 의미 | 대표 기능 |
|---|---|---|
| `explore` | 코드 탐색/이해/이동 | Treemap, Mindmap, Pathfinder, Structure Outline, Symbol Inventory |
| `productivity` | delivery, flow, cost, throughput | DORA, DevEx, Task Queue, Review Burden, Budget Console |
| `ai-agent` | 에이전트 실행/실패/성공률 | Agent Success, Agent Trajectory, Trajectory Decompose, Stuck Pattern, Planning Horizon |
| `ai-context-model` | context/token/model/cost | Token Economy, Context Waste, Context Curator, Model Router, Model Swap, Thinking Budget |
| `ai-trust-governance` | AI 결과 신뢰/감사/안전 | Diff Evidence, Message-Code Mismatch, Spec Gaming, Blind Spot, Audit Trail, Prompt Injection |
| `se-architecture` | 구조/의존성/레이어 | Arch Layers, Layer Audit, Service Topo, Package Instability, Chord |
| `se-quality` | maintainability/complexity/smell | Quality Gate, Cognitive Complexity, Maintainability Index, God File, Dead Code |
| `se-testing` | test/verification/coverage | Test Pyramid, Mutation Score, Coverage Holes, Verification Surface |
| `se-refactor-change` | 변경 영향/리팩터링 | Refactor Terrain, Refactor Sim, Move Hint, Shotgun Surgery, Feature Envy |
| `se-security-supply-chain` | 보안/취약점/SBOM | Vulnerabilities, SBOM, Dependency Health, Prompt Injection |
| `se-evolution` | 시간/히스토리/드리프트 | Timelapse, Heat Rainfall, Evolution DNA, Blame Clock, Temporal Coupling |
| `se-ownership-team` | 소유권/리뷰/팀 리스크 | Ownership Sankey, Truck Factor, Review Heat, Skill Atrophy |

---

## Scope 체계

### Scope hierarchy

```
org
└─ team
   └─ workspace
      └─ repo
         ├─ project
         │  └─ package
         │     └─ module
         │        └─ file
         │           ├─ symbol
         │           └─ diff
         ├─ task
         ├─ agent-run
         ├─ model
         ├─ budget
         └─ policy
```

### Scope별 대표 질문

| Scope | 질문 | 대표 기능 |
|---|---|---|
| `org` | 전사 AI 비용/감사/정책은 안전한가? | Budget Console, Audit Trail |
| `team` | 리뷰 capacity와 skill health는 괜찮은가? | Review Burden, Skill Atrophy, Review Heat |
| `workspace/repo` | 이 코드베이스 전체의 건강도는? | DORA, Quality Gate, SBOM, Agent ROI |
| `project/package` | 이 패키지 구조/instability는? | Package Surface, Instability, Evolution |
| `module/file` | 이 파일을 이해/수정/위임할 수 있나? | Agentability, Context Waste, File Gauge |
| `symbol` | 이 함수/클래스의 usage/risk는? | Symbol Card, Symbol Fan, Symbol Usage Map |
| `diff` | 이 변경을 믿고 merge할 수 있나? | Diff Evidence, Message-Code Mismatch, Spec Gaming |
| `task` | 이 태스크는 몇 step/chunk/model이 필요한가? | Task Composer, Planning Horizon, Model Router |
| `agent-run` | 에이전트가 어디서 실패했나? | Trajectory Decompose, Replay Theater, Stuck Pattern |
| `model` | 모델 교체/업데이트 리스크는? | Model Swap, Determinism Drift, Model Router |
| `budget` | token/cost/caching ROI는? | Token Economy, Cache ROI, Budget Console |
| `policy` | 규정/감사/권한 위반은? | Audit Trail, Prompt Injection, Red Team |

---

## Intent 체계

Intent는 user action 기준으로 줄인다. 너무 많은 intent는 같은 기능을 다른 intent로 포장해 중복을 숨긴다.

```ts
type InsightIntent =
  | "explore"    // 어디 있는지 찾기
  | "explain"    // 무엇인지 이해하기
  | "diagnose"   // 왜 문제인지 원인 분석
  | "decide"     // merge/delegate/refactor/model-route 등 행동 선택
  | "verify"     // 사실/증거/테스트/정책 검증
  | "optimize"   // 비용/속도/토큰/흐름 개선
  | "govern";    // 감사/정책/권한/조직 통제
```

삭제/흡수:

- `understand` → `explain`
- `prioritize` → `decide` 또는 `diagnose`
- `forecast` → 구체적 용도에 따라 `decide`, `optimize`, `govern`

### Intent 기반 entrypoint

카탈로그 홈은 domain보다 intent를 먼저 보여주는 것이 좋다.

```
What are you trying to do?

[Explore code] [Explain behavior] [Diagnose failure]
[Decide action] [Verify evidence] [Optimize cost]
[Govern usage]
```

각 버튼은 facet query다.

예:

- `Decide action` + `delegate` → domain: `ai-agent | ai-context-model`, scope: `file | task`, target: `delegate`
- `Verify evidence` + `merge` → domain: `ai-trust-governance`, scope: `diff | file`, target: `merge`
- `Optimize cost` → domain: `ai-context-model | productivity`, scope: `budget | model | task`
- `Govern usage` → domain: `ai-trust-governance | productivity`, scope: `team | org | policy`

## Descriptor 확장 제안

현재 `ViewDescriptor`는 다음을 가진다.

- id, label, glyph
- hint, tech, usecase
- category
- contexts
- needs
- order
- Component

여기에 optional taxonomy + decision binding + action hooks를 추가한다.  
핵심은 **primary facet**이다. Secondary facet은 검색 확장용이고, 관리/중복/행렬 배치는 primary가 담당한다.

```ts
export interface PrimaryFacet {
  domain: InsightDomain;
  scope: InsightScope;
  intent: InsightIntent;
}

export interface ViewTaxonomy {
  /** Canonical identity. Duplicate detection, matrix placement, tab grouping의 기준. */
  primary: PrimaryFacet;

  /** 검색/추천 확장용 secondary facets. primary 값은 여기에 포함되어야 한다. */
  domains?: readonly InsightDomain[];
  scopes: readonly InsightScope[];
  intents: readonly InsightIntent[];

  subdomain?: string;
  personas?: readonly InsightPersona[];
  surfaces?: readonly InsightSurface[];
  maturity?: InsightMaturity;
  signal?: InsightSignalProfile;
  decision?: InsightDecisionBinding;
  actions?: readonly InsightActionHook[];
  workflow?: InsightWorkflowBinding;
  related?: readonly ViewMode[];
  replaces?: readonly ViewMode[];
  keywords?: readonly string[];
}

export type InsightPersona =
  | "developer"
  | "reviewer"
  | "tech-lead"
  | "security"
  | "manager"
  | "platform"
  | "ai-operator";

export type InsightSurface =
  | "view"
  | "tab"
  | "hover"
  | "gutter"
  | "diff-inline"
  | "dashboard-card"
  | "command";

export type InsightMaturity =
  | "core"
  | "advanced"
  | "experimental"
  | "deprecated";
```

### Capability kind

기능은 더 이상 UI surface만이 아니다. 하나의 insight는 여러 capability kind를 가질 수 있다.

```ts
export type InsightCapabilityKind =
  | "view"              // 시각화/분석 surface
  | "decision-input"    // 판단 입력으로 사용 가능
  | "workflow-step"     // workflow의 step으로 attach 가능
  | "gate-check"        // merge/admission gate check로 사용 가능
  | "policy-control"    // 정책/감사/권한 계층
  | "external";
```

예:

- `Diff Evidence` = `view + decision-input + gate-check`
- `Agentability` = `view + decision-input + workflow-step`
- `Review Burden` = `view + policy-control`
- `Prompt Injection` = `view + gate-check + policy-control`

### Decision grade

```ts
export type InsightDecisionGrade =
  | "informational" // 참고용
  | "triage"        // 우선순위/검토 필요
  | "advisory"      // 추천 근거 가능
  | "gating"        // 실제 gate 입력 가능
  | "blocking";     // fail-closed block 가능

export type DecisionTarget =
  | "merge"
  | "delegate"
  | "refactor"
  | "route-model"
  | "approve-agent-run"
  | "escalate-review"
  | "policy-audit";

export interface InsightDecisionBinding {
  grade: InsightDecisionGrade;
  supports: readonly DecisionTarget[];
  evidenceClass?: "none" | "weak" | "strong" | "auditable";
  failClosedEligible?: boolean;
  humanReviewRequired?: boolean;
}
```

중요한 구분:

| 기능 | decision grade | target |
|---|---|---|
| Treemap | informational | 없음 |
| Trajectory Decompose | triage | approve-agent-run, delegate |
| Agentability | advisory | delegate |
| Diff Evidence | gating | merge |
| Prompt Injection | blocking | merge, policy-audit |
| Verification Surface | gating | merge |

UI에서는 이를 더 단순하게 표시할 수 있다.

| Internal grade | 사용자 표시 | 의미 |
|---|---|---|
| informational | informational | 참고/탐색용 |
| triage, advisory | needs-review | 판단 보조. 사람 검토 필요 |
| gating, blocking | safe-to-act / blocked | 증거 기반 gate input. 결과에 따라 allow/hold/reject |

### Action hooks

```ts
export type InsightActionHook =
  | "open-view"
  | "open-tab"
  | "run-analysis"
  | "attach-to-pr-review"
  | "attach-to-agent-plan"
  | "attach-to-task-routing"
  | "attach-to-admission-gate"
  | "attach-to-policy-check"
  | "pin-dashboard"
  | "compare-related";
```

예:

- `Diff Evidence` → `open-tab`, `run-analysis`, `attach-to-pr-review`, `attach-to-admission-gate`
- `Agentability` → `open-view`, `run-analysis`, `attach-to-agent-plan`, `attach-to-task-routing`
- `Context Waste` → `open-view`, `run-analysis`, `attach-to-agent-plan`
- `Review Burden` → `pin-dashboard`, `attach-to-policy-check`, `open-tab`

### Signal profile 강화

```ts
export interface InsightSignalProfile {
  dataFreshness: "live" | "snapshot" | "synthetic";
  confidence: "measured" | "estimated" | "heuristic";
  actionability: "direct-action" | "triage" | "explain";
  cost: "low" | "medium" | "high";
  latency: "instant" | "interactive" | "batch";

  /** merge gate / audit / agent planner에서 중요 */
  determinism?: "deterministic" | "bounded" | "heuristic";
  evidenceLevel?: "none" | "weak" | "strong" | "auditable";
  decisionGrade?: InsightDecisionGrade;
}
```

`deterministic`, `evidence-bearing`, `auditable` 여부가 admission system에서 핵심이다.

### Descriptor 예시

```ts
export const trajectoryDecomposeViewDescriptor: ViewDescriptor = {
  id: "trajectory-decompose",
  label: "TrajDx",
  glyph: "⇢",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1110,
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "agent-run",
      intent: "diagnose",
    },
    scopes: ["file", "task", "agent-run"],
    intents: ["diagnose", "decide"],
    subdomain: "agent-failure",
    personas: ["developer", "tech-lead", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "instant",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "triage",
    },
    decision: {
      grade: "triage",
      supports: ["approve-agent-run", "delegate"],
      evidenceClass: "weak",
      failClosedEligible: false,
      humanReviewRequired: true,
    },
    actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
    related: ["agent-trajectory", "replay-theater", "stuck-pattern"],
    keywords: ["agent", "failure", "trajectory", "search", "read", "edit", "verify"],
  },
  Component: TrajectoryDecomposeModeView,
};
```

## CatalogRecord: 통합 메타데이터 모델

`ViewDescriptor`와 `FeatureManifest`를 그대로 UI에 뿌리면 관리가 분산된다. 중간에 normalized catalog record를 둔다.

v2의 `AnalysisCatalogRecord`는 UI metadata뿐 아니라 **decision binding**과 **workflow attachment**를 가진다.

```ts
export interface AnalysisCatalogRecord {
  id: string;                 // view id 또는 feature id
  kind: "view" | "workflow" | "external";
  capabilityKinds: readonly InsightCapabilityKind[];

  title: string;
  shortLabel: string;
  glyph: string;
  summary: string;
  tech: string;
  usecase: string;

  taxonomy: ViewTaxonomy;

  launch: {
    mode?: ViewMode;
    commandId?: string;
    tabTitle?: string;
    defaultSurface: InsightSurface;
  };

  availability: {
    contexts: readonly ViewCtx[];
    needs?: ViewDescriptorNeeds;
    requiresSelection: boolean;
  };

  decision: {
    grade: InsightDecisionGrade;
    supports: readonly DecisionTarget[];
    evidenceClass?: "none" | "weak" | "strong" | "auditable";
    failClosedEligible?: boolean;
    humanReviewRequired?: boolean;
  };

  actions: readonly InsightActionHook[];

  workflow: {
    usableInStacks?: readonly WorkflowStackId[];
    canBeAutoSuggested?: boolean;
    canBeAutoAttached?: boolean;
    requiresOrderedExecution?: boolean;
  };

  quality: {
    maturity: InsightMaturity;
    owner?: string;
    docs?: string;
    lastReviewed?: string;
    deprecatedBy?: string;
  };
}
```

생성 규칙:

1. `VIEW_DESCRIPTORS` → view catalog records 자동 생성
2. `FeatureManifest` 중 `universe-*` → view record와 merge
3. command palette / home catalog / view picker는 이 record를 사용
4. 수동 feature는 `kind: workflow | external`
5. taxonomy 없는 legacy view는 fallback record를 만들되 admin에서 hygiene debt로 표시

---

## Control Plane Binding

v2의 catalog는 다음 pipeline의 앞단이다.

```txt
Insight Definition
  → Catalog Record
  → Runtime Capability Binding
  → Decision Attachment
  → Workflow / Gate / Agent Execution
```

즉 각 insight는 다음 셋 중 하나 이상이어야 한다.

### Observe

보여주고 이해시키는 기능.

예: Treemap, Mindmap, Semantic Neighbors, Heat Rainfall

### Decide

merge / delegate / escalate / reject 판단에 쓰이는 기능.

예: Agentability, Diff Evidence, Message-Code Mismatch, Verification Surface

### Act

review workflow, agent workflow, policy gate, tab workflow에 attach되는 기능.

예: Prompt Injection, Audit Trail, Context Curator, Task Composer

이 구분이 없으면 catalog는 다시 viewer catalog로 내려간다.

---

## Admission System Binding

Admission system은 insight를 verdict input으로 소비한다.

```ts
export interface AdmissionVerdictInput {
  insightId: string;
  score?: number;
  confidence?: number;
  decisionGrade: InsightDecisionGrade;
  status: "pass" | "warn" | "fail" | "unknown";
  rationale?: string;
  evidenceRef?: string;
}

export interface AdmissionVerdict {
  target: "diff" | "pr" | "task";
  status: "allow" | "hold" | "reject";
  inputs: readonly AdmissionVerdictInput[];
  blockingReasons: readonly string[];
  requiredHumanChecks: readonly string[];
  evidenceBundleRef?: string;
}
```

모든 insight가 gate에 들어가면 안 된다. Gate eligible insight만 따로 선언한다.

```ts
decision: {
  grade: "gating",
  supports: ["merge"],
  failClosedEligible: true,
  evidenceClass: "auditable",
}
```

### Merge gate에 들어갈 수 있는 것

- Diff Evidence
- Message-Code Mismatch
- Verification Surface
- Prompt Injection
- Policy violation류
- Spec Gaming 일부

### Merge gate 참고만 가능한 것

- Review Burden
- Agentability
- Context Waste
- Planning Horizon

### Merge gate에 넣으면 안 되는 것

- Treemap
- Mindmap
- Galaxy 3D
- Semantic Neighbors
- 대부분의 exploratory view

---

## Agent Planning Binding

Agent planner도 catalog를 질의해야 한다.

질문: “이 파일 수정 작업을 agent에게 맡겨도 되나?”

Planner query:

```ts
{
  target: "delegate",
  scope: "file",
  intent: "decide",
  supports: "delegate",
  canBeAutoSuggested: true,
}
```

추천 stack:

- Agentability
- Context Waste
- Planning Horizon
- Verification Surface
- Model Router

즉 catalog는 agent planner의 **retrieval registry**다.

---

## Executable Workflow Stack

기존 “Recommended Stacks”는 설명용이었다. v2에서는 실행 가능한 spec으로 승격한다.

```ts
export interface InsightWorkflowStack {
  id: string;
  title: string;
  goal: string;
  targetDecision?: DecisionTarget;
  primaryScopes: readonly InsightScope[];
  steps: readonly InsightWorkflowStep[];
}

export interface InsightWorkflowStep {
  insightId: string;
  role:
    | "screening"
    | "risk-check"
    | "verification"
    | "decision-support"
    | "policy-check";
  required: boolean;
  blockingOnFail?: boolean;
}
```

### AI Review Stack

```ts
{
  id: "ai-review-stack",
  title: "AI Review Stack",
  goal: "Determine whether an AI-generated diff is safe to merge",
  targetDecision: "merge",
  primaryScopes: ["diff", "file"],
  steps: [
    { insightId: "diff-evidence", role: "verification", required: true, blockingOnFail: true },
    { insightId: "message-code-mismatch", role: "risk-check", required: true },
    { insightId: "verification-surface", role: "verification", required: true, blockingOnFail: true },
    { insightId: "prompt-injection", role: "policy-check", required: false, blockingOnFail: true },
  ],
}
```

### Agent Delegation Stack

```ts
{
  id: "agent-delegation-stack",
  title: "Agent Delegation Stack",
  goal: "Decide whether a task/file can be safely delegated to an agent",
  targetDecision: "delegate",
  primaryScopes: ["file", "task"],
  steps: [
    { insightId: "agentability", role: "screening", required: true },
    { insightId: "context-waste", role: "risk-check", required: true },
    { insightId: "planning-horizon", role: "risk-check", required: true },
    { insightId: "model-router", role: "decision-support", required: false },
    { insightId: "verification-surface", role: "verification", required: true },
  ],
}
```

### Dynamic stack generation

Hardcoded stack만으로는 부족하다. 사용자의 질의와 현재 context로 stack을 생성한다.

예:

- User: “이 PR 믿어도 되냐?”
- Scope: `diff`
- Intent: `verify + decide`
- DecisionTarget: `merge`

자동 stack:

1. Diff Evidence
2. Message-Code Mismatch
3. Verification Surface
4. Spec Gaming
5. Prompt Injection if untrusted context exists

Stack generation algorithm:

```ts
candidate = catalog.filter(record =>
  record.taxonomy.scopes.includes(scope) &&
  record.taxonomy.intents.some(i => wantedIntents.includes(i)) &&
  record.decision.supports.includes(target) &&
  record.workflow.canBeAutoSuggested
)

rank by:
  required role coverage
  decision grade
  evidence level
  maturity
  availability in current context
```

## UI 제안

## 1. Catalog Home — “분석 기능 Control Center”

현재 Browse All은 list/card catalog다. 다음 구조가 더 좋다.

```
┌────────────────────────────────────────────────────────────────────┐
│ Insight Catalog                                                    │
│ 132 analysis surfaces · 12 domains · 16 scopes · 7 intents          │
│ decision-ready · gate-aware · agent-attachable                      │
├────────────────────────────────────────────────────────────────────┤
│ What are you trying to do?                                         │
│ [Explore] [Explain] [Diagnose] [Decide] [Verify]                   │
│ [Optimize] [Govern] [Delegate] [Merge Gate]                        │
├────────────────────────────────────────────────────────────────────┤
│ Scope                                                              │
│ [Team] [Repo] [Project] [Package] [File] [Symbol] [Diff]           │
│ [Task] [Agent Run] [Model] [Budget] [Policy]                       │
├────────────────────────────────────────────────────────────────────┤
│ Featured stacks                                                    │
│ ┌ AI Review Stack ───────────────────────────────────────────────┐  │
│ │ Diff Evidence → Message-Code Mismatch → Spec Gaming            │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ┌ Agent Delegation Stack ────────────────────────────────────────┐  │
│ │ Agentability → Context Waste → Planning Horizon                │  │
│ └────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│ Results                                                            │
│ [card] [card] [card] ...                                           │
└────────────────────────────────────────────────────────────────────┘
```

### Catalog card v2

각 카드는 “설명”보다 **결정 가능성 + 실행 hook**을 먼저 보여준다.

```
┌──────────────────────────────────────────────┐
│ ⇢ Trajectory Decompose              advanced │
│ primary: ai-agent / agent-run / diagnose      │
│ scopes: file · task · agent-run               │
│ intents: diagnose · decide                    │
│ decision: triage · delegate · needs review    │
│ signal: estimated · bounded · weak evidence   │
│ actions: open-tab · run · attach-agent-plan   │
│                                                │
│ search/read/edit/verify/recover 병목...       │
│                                                │
│ [Open tab] [Run] [Attach] [Stack] [Related]   │
└──────────────────────────────────────────────┘
```

카드 색은 domain accent, chip은 scope/intent, 우측 상단은 maturity.
단, `gate-check` 또는 `blocking` capability가 있으면 evidence badge를 항상 노출한다.

### Domain accent 제안

| Domain | Accent |
|---|---|
| Explore | blue |
| Productivity | green |
| AI Agent | violet |
| AI Context/Model | cyan |
| AI Trust/Governance | red/orange |
| SE Architecture | amber |
| SE Quality | emerald |
| SE Testing | teal |
| SE Refactor/Change | orange |
| SE Security/Supply Chain | red |
| SE Evolution | purple |
| SE Ownership/Team | indigo |

---

## 2. Scope Matrix — 전체 기능을 한눈에 보는 지도

기능 수가 많아지면 list보다 matrix가 필요하다.

```
                Team  Repo Project Package File Symbol Diff Task Agent Model Budget
AI Agent          ·     ·      ·       ·     4     ·     ·    5     6     ·     ·
AI Context        ·     2      ·       ·     7     ·     ·    3     ·     4     3
AI Trust          2     4      ·       ·     6     ·     4    ·     1     ·     ·
SE Quality        ·     6      ·       2     8     3     ·    ·     ·     ·     ·
SE Architecture   ·     7      3       8     2     ·     ·    ·     ·     ·     ·
Productivity      5     6      ·       ·     ·     ·     ·    4     ·     ·     3
```

클릭하면 해당 facet query가 실행된다. 단순 coverage heatmap이면 부족하다. 각 cell은 아래 4개 값을 함께 보여준다.

- `count`: 기능 수
- `usage`: 최근 30/90일 사용량 또는 tab open 수
- `impact`: merge/delegate/govern decision에 미친 영향 점수
- `decisionCoverage`: gating/advisory/triage capability 분포

예: `AI Trust × Diff = 4 views · usage high · impact critical · 2 gating`.

```ts
interface ScopeMatrixCell {
  domain: InsightDomain;
  scope: InsightScope;
  count: number;
  usage: "none" | "low" | "medium" | "high";
  impact: "none" | "low" | "high" | "critical";
  decisionCoverage: Partial<Record<InsightDecisionGrade, number>>;
  topRecords: readonly AnalysisCatalogRecord[];
}
```

관리 insight:

- AI Trust × Diff가 부족하면 PR trust surface 부족
- AI Trust × Diff의 count는 충분하지만 impact가 낮으면 “보여주기만 하는 기능” 과다
- SE Testing × Symbol이 부족하면 함수 단위 verification 약함
- Productivity × Team은 많지만 File은 없으면 개인 개발자 피드백 부족
- AI Agent × Agent-run이 많고 Task가 적으면 실행 관찰은 많은데 planning 도구가 부족

---

## 3. Recommended Stacks — 기능 묶음으로 보여주기

개별 view보다 **workflow stack**이 더 제품답다.

### Agent Delegation Stack

- `Agentability`
- `Context Waste`
- `Planning Horizon`
- `Model Router`
- `Task Composer`

사용 질문: “이 작업을 AI에게 맡겨도 되나?”

### AI Review Stack

- `Diff Evidence`
- `Message-Code Mismatch`
- `Spec Gaming`
- `Verification Surface`
- `Review Burden`

사용 질문: “AI PR을 merge해도 되나?”

### Context Engineering Stack

- `Token Economy`
- `Context Footprint`
- `Context Waste`
- `Context Curator`
- `Context Shape`
- `Cache ROI`

사용 질문: “왜 이 agent run이 비싸고 불안정하지?”

### Agent Failure Stack

- `Agent Trajectory`
- `Trajectory Decompose`
- `Replay Theater`
- `Stuck Pattern`
- `Convergence Score`
- `Compounding Error`

사용 질문: “에이전트가 어디서 무너졌나?”

### Architecture Fitness Stack

- `Arch Layers`
- `Layer Audit`
- `Arch Drift`
- `Package Instability`
- `Service Topo`
- `Chord View`

사용 질문: “시스템 구조가 건강한가?”

### Maintainability Stack

- `Quality Gate`
- `Cognitive Complexity`
- `Maintainability Index`
- `God File`
- `Dead Code`
- `Dupe Clusters`

사용 질문: “어디부터 정리해야 하나?”

### Delivery Flow Stack

- `DORA`
- `DevEx Health`
- `Task Queue`
- `Review Burden`
- `Budget Console`
- `Agent ROI`

사용 질문: “팀 throughput을 막는 건 뭔가?”

---

## 4. View Picker v2

현재 picker는 category group 중심이다. 다음을 추가한다.

### 빠른 facet chips

상단:

```
Scope: [repo] [package] [file] [symbol] [diff] [agent-run]
Intent: [explore] [explain] [diagnose] [decide] [verify] [optimize] [govern]
```

### group label 변경

기존 `AI 효율` 하나 대신 내부 section을 나눈다.

- AI Agent
- AI Context/Model
- AI Trust/Governance
- Productivity
- SE Architecture
- SE Quality/Test
- SE Refactor/Change
- SE Evolution/Ownership
- Explore

`ViewDescriptor.category`는 backward compatibility로 남기고, UI grouping은 taxonomy를 우선 사용한다.

---

## 5. 탭 런칭 정책

탭 이름은 domain prefix를 붙인다.

| View | Tab title |
|---|---|
| Trajectory Decompose | `AI Agent · TrajDx` |
| Context Waste | `AI Context · Waste` |
| Diff Evidence | `AI Trust · DiffProof` |
| Agentability | `AI Agent · AgentFit` |
| Message-Code Mismatch | `AI Trust · MsgCode` |
| Review Burden | `Productivity · RevLoad` |
| Quality Gate | `SE Quality · Gate` |
| Arch Drift | `SE Architecture · Drift` |

탭 런처는 `AnalysisCatalogRecord.launch.tabTitle`을 사용한다. 지금처럼 `openUniverseView(mode, label)`에 string을 직접 넘기지 말고, catalog record에서 꺼낸다.

---

## 관리 체계

## Single Source of Truth

추천 파일 구조:

```
products/code-universe/src/features/view-mode/model/
├── view-descriptor.ts       // descriptor type + taxonomy type
├── view-registry.tsx        // descriptors 등록
├── view-catalogue.ts        // flat projection
├── analysis-catalog.ts      // normalized catalog records
├── taxonomy.ts              // domain/scope/intent constants
└── catalog-stacks.ts        // workflow stacks
```

`FeatureManifest`는 top-level shell catalog용이고, 분석 기능의 canonical metadata는 `AnalysisCatalogRecord`가 가진다.

---

## Governance gates

신규 view 추가 시 다음을 CI에서 검사한다.

### 필수 검사

1. `ViewMode` union에 id 존재
2. `ViewDescriptor.id`와 union id 일치
3. registry 등록 존재
4. `taxonomy.primary.domain/scope/intent` 존재
5. `taxonomy.primary` 값이 `domains/scopes/intents` 확장 facet에 포함됨
6. `taxonomy.scopes` 1개 이상
7. `taxonomy.intents` 1개 이상
8. `taxonomy.personas` 1개 이상
9. `taxonomy.signal` 존재
10. `taxonomy.signal.determinism`과 `taxonomy.signal.evidenceLevel` 존재
11. `capabilityKinds` 1개 이상
12. `decision.grade` 존재. 최소 `informational`이어야 함
13. `actions` 1개 이상. 최소 `open-view` 또는 `open-tab`
14. `gate-check` capability는 `decision.supports`와 `evidenceClass` 필수
15. `blocking` grade는 `evidenceClass: auditable | strong` 없으면 fail
16. `failClosedEligible: true`는 `humanReviewRequired` 또는 auditable evidence 필요
17. `order` band가 primary domain과 일치
18. `related` id가 실제 존재
19. deprecated view는 `deprecatedBy` 필요
20. tab-launch view는 FeatureManifest 또는 generated command 필요

### 중복 검사

- 1차 비교: 동일 `primary.domain + primary.scope + primary.intent` 안에서 중복 후보 탐지
- 2차 비교: secondary facet, keyword, `hint/usecase/tech` 유사도 탐지
- 서로 다른 intent로 포장했지만 action/decision target이 같으면 duplicate warning
- `gate-check`가 같은 `DecisionTarget`을 지원하면서 evidence source가 동일하면 overlap warning
- AI 기능이 `ai` category에만 있고 taxonomy가 없으면 fail

### 네이밍 검사

- id는 kebab-case
- label은 12자 내외
- glyph는 중복 허용하되 같은 domain 내 과다 중복 warning
- tab title은 `Domain · Label` 형식

---

## Lifecycle

각 기능은 maturity lifecycle을 가진다.

```
proposed → experimental → advanced → core → deprecated → removed
```

### maturity 기준

| 단계 | 조건 |
|---|---|
| proposed | RFC/아이디어만 존재 |
| experimental | synth data 기반 UI 존재, 실제 workflow 검증 전 |
| advanced | 특정 persona/workflow에서 유용, catalog 노출 |
| core | 기본 workflow stack에 포함, command/tab 런치 제공 |
| deprecated | 대체 view 존재, 신규 노출 제한 |
| removed | registry에서 제거 |

### 운영 필드

```ts
interface CatalogGovernance {
  owner: string;
  maturity: InsightMaturity;
  createdAt: string;
  lastReviewedAt: string;
  reviewCadenceDays: number;
  usageTelemetryKey?: string;
  deprecatedBy?: ViewMode;
  rationale?: string;
}
```

---

## Quality score

카탈로그 관리자는 “기능이 많다”가 아니라 “좋은 기능이 좋은 위치에 있다”를 봐야 한다.

각 기능에 catalog quality score를 계산한다.

```ts
catalogQuality =
  actionability * 0.30 +
  signalConfidence * 0.20 +
  workflowFit * 0.20 +
  discoverability * 0.15 +
  nonOverlap * 0.15
```

### 세부

| 지표 | 의미 |
|---|---|
| actionability | 보고 나서 할 수 있는 행동이 명확한가 |
| signalConfidence | measured/estimated/heuristic 수준 |
| workflowFit | stack/intent/persona와 연결되는가 |
| discoverability | 검색 키워드/설명/카드가 명확한가 |
| nonOverlap | 다른 view와 중복이 낮은가 |

Catalog admin view에서는 낮은 score를 우선 정리 대상으로 보여준다.

---

## 검색 체계

### 검색 대상

- id
- label
- hint
- tech
- usecase
- domain/subdomain
- scopes
- intents
- personas
- keywords
- related view labels

### query parsing

단순 substring을 넘어서 facet parser를 둔다.

예:

| Query | 해석 |
|---|---|
| `agent file fail` | domain: ai-agent, scope: file, intent: diagnose |
| `merge trust` | domain: ai-trust-governance, scope: diff, intent: verify/decide |
| `package architecture` | domain: se-architecture, scope: package |
| `cost model` | domain: ai-context-model, scope: model/budget, intent: optimize |
| `team review` | domain: productivity/se-ownership-team, scope: team |

### 검색 결과 랭킹

```ts
rank =
  exactIdMatch * 100 +
  labelMatch * 60 +
  facetMatch * 45 +
  keywordMatch * 30 +
  relatedStackBoost * 20 +
  maturityBoost * 10 -
  unavailablePenalty
```

현재 selection이 file이면 file-scope 기능을 boost한다. repo selection이면 repo/team 기능을 boost한다.

---

## Catalog Admin 화면

사용자용 catalog와 별도로 관리용 화면이 필요하다.

### Admin dashboard

```
┌ Insight Catalog Admin ───────────────────────────────────────┐
│ 138 records · 12 domains · 92% taxonomized · 14 duplicates   │
├──────────────────────────────────────────────────────────────┤
│ Coverage Matrix                                               │
│ Domain × Scope heatmap                                        │
├──────────────────────────────────────────────────────────────┤
│ Hygiene                                                       │
│ [Missing taxonomy 8] [No owner 42] [No related 31]            │
│ [Duplicate candidates 14] [Deprecated still exposed 2]        │
├──────────────────────────────────────────────────────────────┤
│ Lifecycle                                                     │
│ core 28 · advanced 44 · experimental 58 · deprecated 8        │
├──────────────────────────────────────────────────────────────┤
│ Top cleanup candidates                                        │
│ 1. X — overlaps with Y/Z                                      │
│ 2. A — no intent/persona                                      │
│ 3. B — low actionability                                      │
└──────────────────────────────────────────────────────────────┘
```

이 화면은 dev-only로 시작해도 좋다.

### Decision System Admin 추가

Catalog Admin은 taxonomy completeness만 보면 안 된다. v2에서는 **decision system completeness**를 별도 패널로 둔다.

```
┌ Decision Coverage ───────────────────────────────────────────┐
│ Merge gate: 9 inputs · 4 gating · 2 blocking · 3 advisory    │
│ Delegate:   7 inputs · 0 blocking · 5 advisory · 2 triage    │
│ Policy:     6 inputs · 3 blocking · 2 auditable gaps         │
├──────────────────────────────────────────────────────────────┤
│ Evidence Quality                                             │
│ auditable 18 · strong 31 · weak 52 · none 19                 │
│ blocking without auditable: 0                                │
├──────────────────────────────────────────────────────────────┤
│ Overlap / Gap                                                │
│ AI Trust × Diff: impact critical · coverage good             │
│ SE Testing × Symbol: impact high · coverage weak             │
│ Delegate × Model route: missing verification step            │
└──────────────────────────────────────────────────────────────┘
```

필수 관리 지표:

- gate eligibility coverage: merge/delegate/policy target별 gating 가능한 insight 수
- evidence quality coverage: auditable/strong/weak/none 비율
- blocking safety: blocking인데 auditable evidence가 아닌 항목 수
- decision overlap: 같은 target을 같은 evidence source로 중복 판단하는 항목
- decision gap: stack에는 필요한데 catalog에 없는 role

---

## 현재 기능 그룹 초안

### Productivity / Delivery

- DORA Metrics
- DevEx Health
- Task Queue
- Task Kanban
- Task Graph
- Review Burden
- Agent ROI
- Budget Console
- Audit Trail 일부

### AI Agent

- Agent Success
- Agent Trajectory
- Trajectory Decompose
- Tool Profile
- Turn Depth
- Blast Radius Agent
- Readiness Score
- Replay Theater
- Convergence Score
- Compounding Error
- Planning Horizon
- Stuck Pattern
- Agent Orchestra

### AI Context / Model

- Token Economy
- Context Footprint
- Context Waste
- Context Window Fit
- Context Curator
- Context Shape
- Cache ROI
- Model Router
- Model Swap Sim
- Thinking Budget
- Determinism Drift
- Budget Console 일부

### AI Trust / Governance

- Diff Evidence
- Message-Code Mismatch
- Verification Surface
- Hallucination Risk
- Blind Spot
- Spec Gaming
- Prompt Injection
- Eval Contamination
- Audit Trail
- Red Team
- Uncertainty Map
- Memory Vault 일부

### SE Architecture

- Arch Layers
- Arch Drift
- Layer Audit
- Service Topo
- Matrix
- Chord
- Dependency Health
- Package Surface
- Package Instability
- Package Evolution 일부

### SE Quality / Testing

- Quality Gate
- Cognitive Complexity
- Maintainability Index
- CK Matrix
- Debt Ratio
- DIT
- Problems Panel
- Test Pyramid
- Mutation Score
- Coverage Holes
- God File
- Dead Code
- Dupe Clusters
- Comment Atlas

### SE Refactor / Change

- Refactor Terrain
- Refactor Weather
- Refactor Sim
- Move Hint
- Shotgun Surgery
- Feature Envy
- Change Impact
- Program Slice
- Control Flow
- Call Graph

### SE Evolution / Ownership / Security

- Timelapse
- New Since
- Smell History
- Blame Clock
- Heat Rainfall
- Evolution DNA
- Temporal Coupling
- Ownership Sankey
- Author Territory
- Truck Factor
- Review Heat
- Review Recommender
- Skill Atrophy
- Vulnerabilities
- SBOM

### Explore / Navigation

- Treemap
- Mindmap
- Galaxy 3D
- Embedding
- Pathfinder
- Neighborhood
- Start Here
- Structure Outline
- Language Breakdown
- Inner City
- File Gauge
- File History
- File Twins
- Symbol Inventory
- Symbol Card
- Symbol Fan
- Symbol Usage Map
- Semantic Neighbors

---

## Order band 제안

현재 `order`는 이미 view picker 정렬의 핵심이다. taxonomy와 맞춰 band를 명시한다.

| Band | 영역 |
|---:|---|
| 0–99 | Explore core |
| 100–199 | Architecture/dependency |
| 200–299 | Metrics/productivity |
| 300–399 | Refactor/change |
| 400–499 | History/evolution |
| 500–599 | Industry/academia SE |
| 600–699 | Quality/testing/security |
| 700–799 | Entity scoped |
| 800–899 | Industry must-haves |
| 900–999 | AI context/token/model wave |
| 1000–1099 | AI limits awareness |
| 1100–1199 | AI runtime reliability |
| 1200–1299 | AI trust/review |
| 1300–1399 | AI governance/org |
| 1400–1499 | AI interpretability/composability |

CI는 order가 domain band와 크게 어긋나면 warning을 낸다.

---

## RFC 분리 전략

이 문서 하나에 admission/agent orchestration까지 모두 구현 세부를 넣으면 무거워진다. 따라서 문서는 다음 4개로 분리해 운영한다.

| RFC | 범위 | 산출물 |
|---|---|---|
| RFC-A Insight Catalog OS | taxonomy, primary facet, catalog record, picker/home/admin | `taxonomy.ts`, `analysis-catalog.ts`, catalog UI |
| RFC-B Insight Workflow Stack System | executable stack, static/generated stack, stack launcher | `catalog-stacks.ts`, stack composer |
| RFC-C Admission Insight Binding | insight → gate input, fail-closed eligibility, verdict aggregation | `AdmissionVerdict`, merge gate adapter |
| RFC-D Agent Planning Insight Binding | delegate/model-route/task planning과 catalog query 연결 | planner retrieval query, insight attachment log |

이 RFC는 RFC-A를 중심으로 하되, B/C/D로 자연스럽게 확장될 타입 seam을 미리 고정한다.

---

## 구현 계획

### Phase 0 — Taxonomy + decision primitives

- 이 RFC 확정
- `taxonomy.ts` 추가
- `PrimaryFacet`, `InsightIntent`, `InsightDomain`, `InsightScope` constants 추가
- `InsightCapabilityKind`, `InsightDecisionGrade`, `DecisionTarget`, `InsightActionHook` 타입 추가
- `ViewDescriptor.taxonomy?`를 optional로 추가하되 신규 view는 필수로 운영

### Phase 1 — Normalized catalog projection

- `analysis-catalog.ts` 추가
- `VIEW_DESCRIPTORS`에서 `AnalysisCatalogRecord[]` 생성
- `FeatureManifest` 중 `universe-*`는 view record와 merge
- taxonomy 없는 legacy view는 fallback record를 만들되 `hygieneDebt: true`로 표시
- fallback record에는 `maturity: experimental`, `confidence: heuristic`, `decision.grade: informational` 적용

### Phase 2 — 신규 AI-native view 정식 taxonomy 부여

우선 최근 추가된 6개부터 정확히 태깅한다.

| View | Primary domain | Primary scope | Primary intent | Secondary scopes | Decision grade | Actions |
|---|---|---|---|---|---|---|
| Trajectory Decompose | ai-agent | agent-run | diagnose | file, task | triage | open-tab, run-analysis, attach-to-agent-plan |
| Context Waste | ai-context-model | file | optimize | task, budget | advisory | open-tab, run-analysis, attach-to-agent-plan |
| Diff Evidence | ai-trust-governance | diff | verify | file | gating | open-tab, run-analysis, attach-to-pr-review, attach-to-admission-gate |
| Agentability | ai-agent | file | decide | task | advisory | open-tab, run-analysis, attach-to-agent-plan, attach-to-task-routing |
| Message-Code Mismatch | ai-trust-governance | diff | diagnose | file | gating | open-tab, run-analysis, attach-to-pr-review, attach-to-admission-gate |
| Review Burden | productivity | team | govern | repo | triage | open-tab, pin-dashboard, attach-to-policy-check |

### Phase 3 — Executable workflow stacks

- `catalog-stacks.ts` 추가
- AI Review Stack, Agent Delegation Stack, Context Engineering Stack을 `InsightWorkflowStack`으로 선언
- stack step은 `required`, `blockingOnFail`, `role`을 가진다
- Catalog Home에서 static stack + generated stack을 함께 노출

### Phase 4 — Admission insight binding

- `AdmissionVerdictInput` / `AdmissionVerdict` 타입 추가
- merge gate가 catalog에서 `gate-check + supports: merge` 항목만 소비하도록 제한
- `blocking` grade는 auditable/strong evidence 없으면 fail
- fail-closed 가능한 항목과 human-review-required 항목을 분리

### Phase 5 — Agent planning insight binding

- agent planner가 catalog query로 delegation/model-routing stack을 만든다
- query key: `targetDecision`, `scope`, `intent`, `availability`, `workflow.canBeAutoSuggested`
- agent plan에 insight attachment를 기록한다: 어떤 view가 왜 plan에 붙었는지 추적 가능해야 한다

### Phase 6 — Catalog UI v2 + Admin

- Browse All에 intent-first entrypoint 추가
- Domain/Scope/Intent/DecisionTarget filter 추가
- 카드에 primary facet, decision grade, evidence level, action hook 표시
- Scope Matrix cell에 count/usage/impact/decisionCoverage 표시
- Admin dashboard에 taxonomy coverage + decision coverage + evidence quality + duplicate/overlap 표시

---

## Acceptance Criteria

1. 모든 신규 view는 `taxonomy.primary` 없이 merge 불가.
2. 모든 신규 view는 `decision.grade`, `capabilityKinds`, `actions`, `signal.determinism`, `signal.evidenceLevel` 없이 merge 불가.
3. feature catalog에서 `agent failure`, `merge trust`, `context cost`, `package architecture`, `team review` 검색이 관련 기능을 상위에 보여준다.
4. catalog card는 primary facet, domain/scope/intent, maturity, decision grade, evidence level, action hooks를 표시한다.
5. Code Universe 탭 런처는 catalog record의 `launch` 정보를 사용한다.
6. View Picker는 현재 selection scope에 맞춰 관련 view를 boost한다.
7. Scope Matrix는 count뿐 아니라 usage/impact/decisionCoverage를 보여준다.
8. AI Review Stack과 Agent Delegation Stack은 `InsightWorkflowStack`으로 실행 가능하게 선언된다.
9. Merge gate는 `gate-check + supports: merge` insight만 소비한다.
10. Blocking gate input은 auditable/strong evidence 없이는 CI hygiene에서 실패한다.
11. Agent planner는 catalog query로 delegation/model-routing 관련 insight stack을 추천할 수 있다.
12. Admin dashboard에서 taxonomy coverage, duplicate candidates, deprecated exposure, gate eligibility, evidence quality, decision overlap을 볼 수 있다.
13. `pnpm typecheck`와 catalog hygiene script가 통과해야 한다.

---

## 최종 추천

가장 중요한 결정은 이것이다.

> **`ViewDescriptor.category`는 backward-compatible UI grouping으로 유지한다. Canonical product classification은 `primaryFacet + taxonomy + decision binding + action hooks`가 담당한다. Insight Catalog는 더 이상 단순 browse surface가 아니라, analysis capability registry이자 admission/agent/runtime workflow를 연결하는 control plane이다.**

그 다음 catalog를 다음 4개 레이어로 운영한다.

1. **User Catalog**: “내가 뭘 하려는지” 기준으로 찾는다.
2. **View Picker**: 현재 scope/selection에 맞는 view를 빠르게 연다.
3. **Workflow Stack**: hardcoded + generated stack으로 review/agent/task 흐름에 붙인다.
4. **Catalog Admin**: 기능 수가 아니라 taxonomy hygiene, decision coverage, evidence quality, gate eligibility를 관리한다.

즉 이 RFC는 “분석 기능 목록”이 아니라 **DevOS capability graph + admission control + agent orchestration의 공통 control plane**이다.
