# RFC: Autonomous Repo Engineer

**날짜**: 2026-04-23
**상태**: Draft (exploratory — frontend-first)
**작성**: Songmin + Codex
**연관**: Proof-Carrying PR · Agent Orchestrator View · Counterfactual Branch
**구현 프로토타입**: [`p0-ide-v2/packages/app-autopilot/`](../../p0-ide-v2/packages/app-autopilot/) — Autopilot 탭에서 확인 (`⌘⌥A` 혹은 `Autopilot` 탭)

> **이 문서의 위상**
>
> - exploratory-as-code RFC다. 실제 backend execution engine보다 먼저 **프론트에서 개념을 만져보기 위한 contract** 를 정의한다.
> - 따라서 schema는 "frontend가 렌더링하고 mock할 수 있을 만큼"까지만 정밀하게 쓰고, validator / verifier / execution substrate 같은 backend-heavy 부분은 RFC 수준의 결정만 남기고 구체 구현은 별도 후속 RFC로 분리한다.
> - 이 문서에서 "결정"이라고 적힌 항목은 frontend exploration 동안 지켜지는 고정점이다. "open question"은 backend RFC에서 다룰 것.

---

## 한 줄 정의

> **"레포에 붙어 지속적으로 상태를 이해하고, 목표와 정책에 맞춰, 유지보수·리팩토링·생산 작업을 수행하는 자율주행 개발자 비서"**

이 RFC는 Quanta를 단순 분석 도구나 point refactoring tool이 아니라,
**Engineering Control Plane + Repository-Native Autonomous Engineer**로 확장하는 방향을 정의한다.

---

## 문제

현재 대부분의 개발 도구는 아래 셋 중 하나에 머문다.

1. **관측 도구** — 문제를 찾고 보여준다
2. **코드 생성 도구** — 시키는 코드를 생성한다
3. **자동화 도구** — 정해진 워크플로를 실행한다

하지만 실제 팀이 원하는 것은 더 상위의 존재다.

- 레포 상태를 계속 이해하고
- 해야 할 일을 스스로 발굴하고
- 안전한 일은 직접 하고
- 애매한 일은 사람과 협업하고
- 마지막에는 PR과 증빙으로 결과를 내는 존재

특히 리팩토링/유지보수/건강성 개선 영역은:

- measurable 하며
- backlog가 풍부하고
- 정적 엔진과 잘 맞고
- 실행노동을 많이 잡아먹으며
- 장기적으로 복리 효과가 크다

즉 자율주행 비서의 대표 workload가 되기 좋다.

---

## 결정 사항 (load-bearing)

아래 결정은 frontend exploration 기간 동안 고정된다. 뒤엎으려면 RFC 개정이 필요하다.

### D1. 제품 경계 — ARE는 Quanta IDE의 *상위 product layer*다

- ARE는 **Quanta IDE를 하나의 surface로 포함**하는 상위 개념이다. IDE에 기능 하나 추가하는 게 아니다.
- `Three-Axis Positioning (Engine × AI × IDE, bound by Workspace)` 와의 관계:
  - **workspace-bound 실행** (L0 ~ L3): Quanta IDE 내부 surface로 동작. 사람이 세션을 열고 있는 동안만 돈다.
  - **repo-attached 실행** (L4 Continuous Autopilot): workspace 경계 밖에서 daemon으로 도는 별도 런타임. IDE가 꺼져 있어도 살아 있음.
- 두 런타임은 **같은 Goal / Policy / Operator / Proof contract**를 공유한다. 배포 모드만 다르다.
- 따라서 이 RFC의 schema는 IDE surface와 daemon surface 양쪽이 동시에 구현한다는 전제로 설계한다.

### D2. Static analyzer와의 계층 분리

- `Static analyzer is separate product` 원칙을 유지한다. ARE 안에서 call-graph / symbol-edge extraction을 새로 하지 않는다.
- ARE는 analyzer의 출력 (`WorkspaceGraph`, metric catalog, violation feed) 을 **consume**할 뿐이다.
- 계층:
  ```
  [ Static Analyzer product ]
          │  (RepositorySnapshot, metrics, violations, opportunities)
          ▼
  [ ARE: Goal / Policy / Planner / Operators / Proof ]
          │  (WorkItem, ExecutionRun, ProofArtifact)
          ▼
  [ Quanta IDE surfaces ]  +  [ ARE Daemon (L4) ]
  ```
- 즉 analyzer 쪽에 requirement가 있으면 그쪽 RFC로 분리해서 적는다. 이 문서에서는 "analyzer가 X를 준다"는 전제로 쓴다.

### D3. Policy-as-Code (repo-stored canonical)

- Goal / Policy / AutonomyProfile은 **repo 내부 파일**이 canonical source다. UI는 editor.
- 권장 경로:
  ```
  .quanta/
    goals/*.yaml
    policies/*.yaml
    autonomy-profiles/*.yaml
    metrics.lock           # metric version pin
  ```
- 이유:
  - goal/policy 변경이 PR로 흘러야 팀 리뷰 / blame / revert가 작동한다.
  - UI-only로 두면 실질적으로 "세션 state"가 되고, 결국 side panel product로 축소된다.
  - ARE daemon (L4) 도 동일한 파일을 읽게 해서 workspace-bound / repo-attached 런타임이 같은 상태를 공유하게 만든다.
- frontend exploration 단계에서는 파일 I/O 없이 mock으로 작업해도 되지만, **schema는 이미 파일로 저장 가능한 형태**여야 한다.

### D4. Metric Registry는 prerequisite다

- Goal target이 `god_class_burden <= 20` 처럼 metric 이름을 참조하는 이상, **metric 정의 / 버전 / 계산 방법 / 입력** 이 먼저 존재해야 한다.
- Metric Registry는 Static Analyzer product에 속하며 ARE는 ID로만 참조한다.
- `metrics.lock` 은 현재 repo가 어떤 metric version set을 기준으로 goal을 평가하는지 pin한다. metric 정의가 바뀌면 baseline도 freezing 갱신이 필요하다.
- frontend exploration에서는 metric catalog를 mock fixture로 두고 진행해도 되지만, Goal 편집 UI는 **"존재하는 metric만 선택할 수 있다"** 는 제약을 처음부터 표현해야 한다.

### D5. Proof는 재계산 가능해야 한다 ("verifier-backed")

- ProofArtifact는 단순 report가 아니다. **ARE 자신이 아닌 독립 verifier** 가 같은 snapshot / 같은 metric version으로 돌렸을 때 재생산 가능해야 한다.
- 즉 proof는 다음 3-tuple로 성립:
  - `(inputSnapshotId, metricVersionSet, computedBy)` 가 전부 기록된다
  - `computedBy` 는 ARE executor가 아닌 "metric engine"이 수행한 것을 선호한다
  - 불가능할 경우 `selfReported: true` 플래그로 명시한다 (신뢰도 하향 근거)
- frontend exploration에서는 `ProofArtifact.verifier` 필드만 노출하고, 실제 verifier는 후속 backend RFC에서 정의한다.

### D6. Abandon은 planning과 runtime 양쪽에서 가능해야 한다

- Operator는 다음 두 종류의 abandon을 구분한다:
  - **plan-time abandon**: "이 goal을 내 operator로는 줄일 수 없음" → Planner에 no-op 반환
  - **runtime abandon**: patch 시도 중 invariant가 깨진 걸 감지 → 부분 결과 버리고 `AbandonSignal` 발행
- runtime abandon은 **billable failure**다. 조용히 삼키지 않고 inbox에 "abandoned with reason" 카드로 노출한다.
- frontend는 abandoned run을 failed run과 분리해서 렌더링한다 (abandoned는 "system이 멈춤을 선택한 결과").

### D7. v0 operator slice = `rule_repair` 하나

- 초기 frontend exploration이 end-to-end 파이프라인을 닫는 데 집중할 수 있도록, v0 operator는 **하나**로 좁힌다.
- 선택: **`rule_repair`** (layer violation / import boundary / simple architecture rule 위반 수정)
  - deterministic하고, proof가 가장 위조되기 어렵고 (rule diff는 재계산이 쉽다), risk가 낮다
  - IDE 쪽 기존 `architecture rules` / `layer violations` feed와 바로 붙는다
- `refactor / test_generation / dependency_hygiene / review_prep`는 전부 Phase 2+ 로 미룬다.
- frontend는 처음부터 "operator는 여러 개가 붙는다" 는 전제로 렌더링하되, 실제 demo는 rule_repair 하나만 wired up.

---

## 비(非)목표

- 범용 AGI형 "아무 일이든 하는" 에이전트는 목표가 아니다
- 비즈니스 요구사항 자체를 설계하는 시스템을 목표로 하지 않는다
- 초기부터 무인 auto-merge를 기본값으로 두지 않는다
- high-ambiguity domain redesign을 완전 자율화하지 않는다
- 기존 editor/PR UI를 대체하지 않고 그 위에 control plane을 얹는다

---

## 핵심 명제

우리가 만드는 것은 "AI refactor 기능"이 아니다.

우리가 만드는 것은:

> **A persistent autonomous engineer attached to a repository**

이다.

이 엔지니어는:

- repo-native signals를 읽고
- desired state와 actual state를 비교하며
- drift와 opportunity를 계산하고
- operator를 통해 일을 고르고
- autonomy profile에 맞춰 실행하고
- proof-carrying change로 결과를 제출한다

---

## 설계 원칙

1. **Repo-native first**
   - 파일 수정기가 아니라 repo state를 이해하는 시스템이어야 한다.
2. **Declarative over imperative**
   - 사용자는 원하는 상태를 선언하고, 시스템이 실행 경로를 선택해야 한다.
3. **Opportunity-aware**
   - goal만 보는 것이 아니라 repo에서 가치 있는 일을 스스로 찾아야 한다.
4. **Adjustable autonomy**
   - manual/auto 이분법이 아니라 task별로 자율성을 조절해야 한다.
5. **Proof before trust**
   - 모델의 confidence가 아니라 증빙과 결과 이력으로 신뢰를 형성해야 한다.
6. **Abandon safely**
   - 불확실할 때 억지 patch를 만들지 않고 멈출 수 있어야 한다.

---

## 핵심 개념

### 1. Goals
사용자가 선언하는 원하는 엔지니어링 상태.

예:
- `dependency_cycles == 0`
- `god_class_burden <= 20`
- `layer_violations == 0`
- `coverage >= 85%`

### 2. Policies
허용 작업, 금지 작업, budget, approval policy를 정의하는 제약.

### 3. Operators
전문 workload를 담당하는 작업기.

예:
- Refactor Operator
- Test Generation Operator
- Rule Repair Operator
- Dependency Hygiene Operator
- Review Prep Operator

### 4. Reconciliation
원하는 상태와 현재 상태 간 차이를 줄이는 루프.

`Observe → Diff → Plan → Act → Validate → Prove → Re-measure`

### 5. Opportunity Engine
명시적 goal이 없어도 repo 전반에서 가치 있는 일을 찾는 계층.

### 6. Autonomy Profiles
작업 리스크와 proof strength에 따라 실행권한을 조절하는 레버.

---

## 왜 refactoring이 대표 workload인가

refactoring은 이 시스템의 중요한 use case지만, 전체 제품 정의는 아니다.

대표 workload로서 적합한 이유:

1. 정적 엔진으로 구조적 문제를 잘 측정할 수 있다
2. debt 개선 효과가 누적된다
3. safe lane / guided lane / restricted lane을 모두 갖고 있어 autonomy 설계가 가능하다
4. test generation, dead code cleanup, rule repair와 결합된다
5. 사람 시간을 많이 잡아먹는 execution labor를 흡수할 수 있다

즉:

> refactoring은 point feature가 아니라,
> Autonomous Repo Engineer를 입증하는 가장 설득력 있는 대표 workload다.

---

## goal-driven + opportunity-driven

ARE는 두 축으로 움직인다.

### Goal-driven
사용자가 선언한 desired state에 맞춰 일한다.

예:
- cycle 제거
- coverage 확대
- god class burden 감소

### Opportunity-driven
시스템이 레포에서 가치 있는 일을 스스로 발굴한다.

예:
- 반복 실패하는 flaky tests
- 안전하게 제거 가능한 dead code
- deprecated API cleanup
- mechanical migration rollout
- low-risk test backfill

즉 시스템은 단순 KPI executor가 아니라:

> **repository-wide engineering work orchestrator**

여야 한다.

---

## Autonomy Ladder

### L0 — Observe
- 분석과 추천만
- 코드 변경 없음

### L1 — Assist
- IDE에서 제안
- 사람이 즉시 적용

### L2 — Guided Execution
- 사람이 intent, sequencing, non-goals를 준다
- agent가 백그라운드에서 실행
- checkpoint 또는 final approval 필요

### L3 — Autonomous PR
- safe lane 작업은 agent가 직접 branch/patch/PR 생성

### L4 — Continuous Autopilot
- 반복 스캔
- safe task 자동 큐잉
- repo health를 지속 수렴

핵심은 **같은 system 위에서 autonomy만 조절**하는 것이다.

---

## Work Profiles

### Safe Production Profile
- tests
- dead code cleanup
- safe rename
- import cleanup
- bounded extract

### Senior-Guided Refactor Profile
- class split
- dependency inversion
- module relocation
- multi-step decomposition

### Interactive Editor Profile
- pair mode
- 설계 탐색
- hotspot 기반 co-editing

### Continuous Health Ops Profile
- recurring scans
- backlog regeneration
- safe lane auto queueing

---

## System Architecture

### 1. Repo Intelligence Layer
입력:
- code graph
- call graph
- dependency graph
- ownership
- churn/history
- tests
- incidents
- architecture rules

출력:
- typed repository state
- metric snapshots
- hotspot attribution
- candidate opportunities

### 2. Goal & Policy Layer
- goal spec 저장
- policy/budget 저장
- baseline freezing
- approval policy 관리

### 3. Opportunity Engine
- repo-wide maintenance/cleanup/test/migration opportunity 탐지

### 4. Planning Engine
- task generation
- operator assignment
- expected delta estimation
- batching / sequencing
- risk classification

### 5. Execution Engine
- structured work item contract 기반 patch generation
- local/global validation
- branch / PR / stacked PR emission

### 6. Proof Engine
- validation evidence 수집
- before/after metric recomputation
- API/rule diff
- uncertainty surfacing

### 7. Governance Engine
- approval policies
- protected zone rules
- operator allowlist
- audit / rollback trail

---

## Safety Model

### Safe lane
자동 실행 가능:
- test addition
- dead code deletion
- import cleanup
- safe rename
- bounded extract
- mechanical rule repair

### Guarded lane
가이드/승인 필요:
- class split
- dependency inversion
- module relocation
- multi-step refactor

### Restricted lane
plan only or manual:
- public API breaking change
- schema changes
- auth/security semantics
- distributed protocol changes
- high-ambiguity business logic redesign

원칙:

> **모호하면 멈춘다.**

### Abandon 경로 (D6 구체화)

- **Plan-time abandon**
  - Operator가 snapshot을 보고 "내 도구로는 이 goal을 줄일 수 없다" 고 판단
  - Planner는 해당 goal에 대해 no-op + rationale 기록
  - frontend: "이 goal은 현재 operator 로는 수렴 불가" 배지
- **Runtime abandon**
  - patch 생성 중 validation이 중간에 깨지거나, 건드려서는 안 되는 영역에 touch해야만 goal에 도달 가능하다고 판단되는 경우
  - Operator는 부분 patch를 **버리고** `AbandonSignal { reason, blockingSignals, partialEvidence }` 발행
  - ExecutionRun은 `abandoned` 상태로 마감. `failed` 와 분리.
  - frontend: inbox에 "abandoned — reason" 카드. 사람은 이걸 보고 `guarded lane`으로 승격시키거나 스코프를 쪼갤 수 있음.
- **금지**: 애매한 상황에서 억지로 일부라도 patch를 내는 것. Abandon이 1st-class outcome이다.

---

## Proof-Carrying Change

모든 실행은 최소 다음을 답해야 한다.

- 무엇을 바꿨는가
- 왜 바꿨는가
- 어떤 goal/opportunity를 겨냥했는가
- 무엇이 실제로 개선됐는가
- 어떤 검증을 통과했는가
- 무엇이 아직 불확실한가
- 누가 리뷰해야 하는가

즉 결과물은 단순 diff가 아니라 **proof-backed PR** 이다.

### Verifier-backed proof (D5 구체화)

"AI가 자기 성적표를 쓴" 산출물은 proof가 아니다.

- 모든 metric delta는 **실행자와 분리된 metric engine**이 재계산한 값을 기본으로 한다.
- Proof artifact에는 항상 다음이 포함된다:
  - `inputSnapshotId` — before 상태의 snapshot id
  - `outputSnapshotId` — after 상태의 snapshot id
  - `metricVersionSet` — 사용한 metric 정의 버전
  - `computedBy` — `metric_engine` | `operator_selfreport`
  - `reproducibilityHash` — (snapshot, metric version, 입력) 기준 재현 가능 여부 확인용
- `operator_selfreport` 는 허용되지만 **reviewer recommendation이 자동으로 한 단계 강화**된다 (skip → skim, skim → review).
- frontend는 `computedBy` 를 항상 표시한다. 사용자가 "이 숫자를 누가 계산했는가"를 속지 않고 볼 수 있어야 한다.

### Reviewer recommendation은 deterministic 해야 한다

- 리뷰 권장도 (`skip / skim / review / focus`)는 모델 판단이 아니라 **규칙 기반 함수**로 계산한다.
- 입력: `(risk tier, proof completeness, computedBy, touches protected zone, touches public surface, operator historical accuracy)`
- 동일 입력은 동일 출력이어야 한다. 그래야 사람이 "이 카드가 왜 focus인지"를 설명받을 수 있다.

---

## Human Roles

### Individual Engineer
- editor pair mode 사용
- suggested task consume
- local guided execution

### Senior / Staff Engineer
- decomposition intent 제공
- forbidden zone / non-goals 지정
- review checkpoint 설계

### Team Lead / Manager
- goals 정의
- policy / budget 설정
- autonomy boundary 설정

ARE는 인간을 대체하는 것이 아니라,
**execution labor를 흡수하고 인간을 steering/judgment에 집중시키는 시스템**이다.

---

## Rollout

### Phase 0 — Repo Intelligence
- snapshot
- hotspots
- opportunity surfacing
- no execution

### Phase 1 — Goals + Suggest
- goal authoring
- drift analysis
- remediation planning

### Phase 2 — Guided Execution
- background agent execution
- proof-backed PRs

### Phase 3 — Safe Lane Autonomy
- tests / cleanup / rule repair / bounded refactor auto PR

### Phase 4 — Continuous Repo Autopilot
- recurring scans
- mixed goal/opportunity queue
- trust-aware scheduling

---

## Success Metrics

### Product
- repos with ARE enabled
- weekly active goals
- suggested task acceptance rate
- guided run completion rate
- autonomous PR acceptance rate

### Technical
- expected vs actual delta accuracy
- validation pass rate
- revert rate
- recurrence reduction

### Trust
- reviewer edit distance after AI PR
- operator-specific acceptance rate
- autonomy upgrades over time
- safe lane expansion rate

---

## Planner ↔ Operator 분업

planning 주체가 두 계층에 걸쳐 흐리게 적혀 있었다. 다음과 같이 고정한다.

- **Planner (시스템)**: 어떤 operator를 부를지, 어떤 순서로, 어떤 budget/autonomy envelope에서 부를지를 결정한다. goal 간 우선순위, opportunity와의 arbitration도 Planner의 책임.
- **Operator**: 호출받은 범위 안에서 "나는 이런 후보를 낼 수 있고, 이런 plan과 risk와 proof requirement를 가진다" 를 반환한다. 자기 밖의 goal이나 다른 operator를 고려하지 않는다.

OperatorContract는 `plan()` 이 아니라 다음으로 분리한다:

- `propose(input)` — 이 범위 안에서 내가 만들 수 있는 candidate workItem들 + 각 candidate의 plan / risk / proof plan
- `execute(workItem)` — 주어진 workItem을 실행. runtime abandon 발생 시 `AbandonSignal` 반환.

Planner는 propose 결과들을 **global objective** (goal delta / risk / reviewer burden / budget) 에 대고 최적화해서 실행 큐를 만든다.

---

## Surface Mapping — 기존 Quanta 제품과의 연결

ARE는 Quanta IDE의 기존 surface들과 다음과 같이 매핑된다. 새 제품이 아니라 기존 surface들의 **상위 프레임**이다.

| ARE 개념 | 현재 Quanta surface (approx) | 비고 |
|---|---|---|
| Home / Assistant Inbox | `app-home` | inbox를 goal/opportunity/workItem 기반으로 재구성 |
| Goal Page | 신규 | metric target vs actual, drift trend |
| Guided Refactor Workspace | `agent-orchestra` / `agent-trajectory` | agent view들을 ARE run의 surface로 정렬 |
| Proof Panel | 신규 + `audit-trail` 재사용 | ProofArtifact 전용 뷰 |
| IDE Pair Surface | Code Universe (`workspace-canvas` / `canvas-engine`) | hotspot-aware action을 ARE goal context와 결합 |
| Rule feed | `arch-drift` / `arch-layer-view` | rule_repair operator의 입력으로 재사용 |

즉 frontend exploration은 **신규 UI를 바닥부터 만들기 전에, 기존 agent-* / arch-* / audit-trail view들을 ARE contract에 맞게 재배선** 하는 방향이 우선이다.

`workspace` / `workspace-canvas` 등 Code Universe 레거시는 **삭제하지 않는다**. v1+v2 공존이 최종 상태인 원칙을 유지.

---

## Open Questions (backend RFC로 이관)

아래는 이 RFC에서 풀지 않는다. frontend exploration이 끝난 뒤 별도 backend RFC에서 결정한다.

1. goal queue와 opportunity queue 충돌 시 arbitration policy (Planner objective 가중치)
2. proof artifact의 canonical surface를 PR comment / check run / 전용 UI 중 어디로 할지
3. senior-guided plan 입력의 형식 (자연어 / structured schema / hybrid)
4. L4 continuous mode의 cadence / budget / concurrency 모델
5. autonomy upgrades를 수동 설정으로 둘지 trust-based recommendation으로 둘지
6. metric engine이 어디서 살지 (analyzer product 내부 vs 별도 service)
7. Verifier의 trust boundary 모델 — 같은 repo 내 signed artifact로 충분한지, 외부 witness가 필요한지

---

## 결론

Quanta의 다음 단계는 더 많은 분석 결과를 쌓는 것이 아니다.

다음 단계는:

> **읽는 엔진에서, 읽고 판단하고 일하는 엔진으로 가는 것**

이다.

그리고 그 framing은 이렇게 고정하는 것이 맞다.

> **Autonomous Repo Engineer**
>
> - Goals는 steering wheel
> - Operators는 hands
> - Proof Engine은 trust layer
> - Autonomy Profiles는 gearbox

