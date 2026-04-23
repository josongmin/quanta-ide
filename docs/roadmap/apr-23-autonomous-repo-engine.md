# 2026-04-23 — Autonomous Repo Engineer

## 한 줄 정의

**레포에 붙어서 목표와 정책에 맞게 유지보수·리팩토링·생산 작업을 지속 수행하는 자율주행 개발자 비서**를 만든다.

refactoring은 이 시스템의 핵심 workload 중 하나지만, 제품 전체를 refactoring point-solution으로 축소해서는 안 된다.

---

## 왜 이 방향인가

우리가 궁극적으로 만들고 싶은 것은:

- 더 많은 정적분석 결과를 보여주는 대시보드가 아니고
- 파일 단위로 시키는 일을 받아 적는 copilot도 아니고
- 일회성 AI refactor 버튼도 아니다

대신:

> **repo-native autonomous engineering assistant**
>
> - 레포 상태를 계속 이해하고
> - 해야 할 일을 스스로 발굴하고
> - 위험도와 확실도에 따라
> - 직접 하거나 / 사람과 협업하거나 / 계획만 제안하고
> - 최종적으로 proof-backed change와 PR을 내는 시스템

이 방향은 우리 제품의 강점과 맞는다.

- 정적 엔진이 강하다
- 코드 그래프/구조/위험/변경영향 같은 repo-native signal을 잘 다룬다
- IDE surface가 있다
- 장기적으로 cloud execution과 붙이기 좋다

---

## 제품 thesis

### Before
- 문제를 찾는다
- 보여준다
- 사람이 고친다

### After
- 원하는 엔지니어링 상태를 선언한다
- 시스템이 drift와 opportunity를 찾는다
- operator가 remediation plan을 만든다
- autonomy profile에 따라 실행한다
- proof를 붙여 PR로 낸다
- 머지 후 다시 측정하고 계속 수렴시킨다

즉 포지셔닝은 이거다:

> **Engineering Control Plane + Autonomous Repo Engineer**

---

## 핵심 mental model

이 시스템은 5개 개념으로 이해하면 된다.

### 1) Goals
사용자가 원하는 엔지니어링 상태.

예:
- god class burden 감소
- dependency cycles = 0
- layer violation = 0
- dead code 지속 축소
- flaky test rate 감소
- blast radius hotspot 축소

### 2) Policies
무엇을 자동으로 해도 되는지, 어떤 변경은 승인/금지인지 정하는 제약.

예:
- public API breaking change 금지
- auth/security 경계 자동수정 금지
- PR당 최대 수정 파일 수 제한
- medium risk 이상은 human approval 필수

### 3) Operators
전문 작업기.

예:
- Refactor Operator
- Test Generation Operator
- Rule Repair Operator
- Dependency Hygiene Operator
- Review Prep Operator

### 4) Reconciliation
원하는 상태와 현재 상태의 차이를 줄이는 루프.

- Observe
- Diff
- Plan
- Act
- Validate
- Prove
- Re-measure

### 5) Autonomy Profiles
같은 goal 아래에서도 작업 종류/리스크에 따라 자율성 레버를 다르게 건다.

---

## refactoring의 위치

refactoring은 feature 하나가 아니라 **대표 workload**다.

이유:

1. 정적 엔진과 궁합이 가장 좋다
2. 구조적 debt를 measurable하게 다룰 수 있다
3. 반복적이고 backlog가 많다
4. 안전한 작업군 / 고난도 작업군이 모두 있어 autonomy ladder 설계에 적합하다
5. 테스트 보강, layer repair, dead code cleanup과 자연스럽게 연결된다

즉 메시지는 이렇게 가야 한다.

> 우리는 “AI refactor tool”을 만드는 게 아니라,
> **레포에 붙어 사는 자율주행 개발자 비서**를 만든다.
>
> 그리고 refactoring은 그 비서의 가장 중요한 업무 중 하나다.

---

## workload taxonomy

ARE(Autonomous Repo Engineer)가 다루는 주요 업무군.

### A. Health Maintenance
- refactoring
- dead code cleanup
- dependency hygiene
- layer violation repair
- ownership ambiguity reduction
- architecture conformance repair

### B. Deterministic Production
- test backfill
- repetitive scaffold generation
- codemod rollout
- migration assist
- fixture generation

### C. Change Assistance
- feature implementation scaffold
- safe transform during feature work
- localized modernization

### D. Review & Governance
- PR risk summary
- blast radius explanation
- reviewer routing
- merge readiness checks
- regression watch

### E. Continuous Repo Ops
- drift detection
- recurring remediation
- backlog reprioritization
- policy conformance monitoring

---

## desired-state + autopilot

Kubernetes 비유로 보면 명확하다.

### Kubernetes
- desired state: replicas = 3
- actual state: replicas = 1
- controller: 3으로 맞춤

### Quanta / ARE
- desired state: dependency_cycles == 0
- actual state: 4
- controller/operator: cycle-breaking plan 생성 → patch → validation → PR

즉 제품은 다음 명제로 설명된다.

> **코드 품질은 보고되는 숫자가 아니라 선언되고 유지되는 운영 상태여야 한다.**

다만 이것을 KPI dashboard 수준으로 축소하면 안 되고,
**goal-driven reconciliation + opportunity-driven work orchestration**까지 올라가야 한다.

---

## goal-driven + opportunity-driven duality

ARE는 두 축으로 움직인다.

### 1) Goal-driven
사용자가 원하는 상태를 선언한다.

예:
- `dependency_cycles == 0`
- `layer_violations == 0`
- `god_class_burden <= X`
- `coverage >= Y`

이때 시스템은 그 상태로 수렴시키는 쪽으로 일을 고른다.

### 2) Opportunity-driven
시스템이 레포에서 가치 있는 일을 스스로 발굴한다.

예:
- flaky tests가 반복되는 구간
- 안전하게 삭제 가능한 dead code
- 반복 적용 가능한 migration/codemod
- deprecated API usage cleanup
- low-risk test backfill opportunity

즉 우리가 만드는 것은 단순 KPI executor가 아니라:

> **repository state 위에서 돌아가는 autonomous engineering work orchestrator**

---

## autonomy ladder

핵심은 manual/auto 이분법이 아니라 **자율성 레버**다.

### L0 — Observe
- 측정만
- drift/opportunity만 보여줌
- 코드 변경 없음

### L1 — Assist
- IDE에서 제안
- 사람이 즉시 적용
- pair mode

### L2 — Guided Execution
- 시니어/개발자가 계획과 제약을 준다
- agent가 백그라운드에서 실행
- 중간 checkpoint 또는 마지막 approval 필요

### L3 — Autonomous PR
- safe lane 작업은 agent가 스스로 patch/validation/PR 생성

### L4 — Continuous Autopilot
- 반복 스캔
- safe lane task 자동 큐잉
- 지속적인 repo health ops

중요한 점:
- 테스트 코드 생성 같은 high-certainty work는 auto에 적합
- bounded refactor는 guided/auto 혼합이 적합
- 설계 민감 리팩토링은 senior steering이 적합
- editor 협업 모드도 계속 중요함

---

## work profiles

UX 상으로는 autonomy를 profile로 보여주는 게 좋다.

### Safe Production Profile
대상:
- tests
- dead code
- import cleanup
- safe rename
- bounded extract

특징:
- strong proof requirement
- auto PR 가능

### Senior-Guided Refactor Profile
대상:
- class split
- dependency inversion
- module relocation
- multi-step decomposition

특징:
- 시니어가 intent/sequence/non-goals 제공
- agent는 execution labor 담당
- PR stack + checkpoint review

### Interactive Editor Profile
대상:
- ambiguous design work
- local structural exploration
- hotspot-based co-editing

### Continuous Health Ops Profile
대상:
- recurring scans
- backlog regeneration
- safe lane auto queueing
- long-term drift management

---

## operator federation

이 시스템은 monolithic AI 하나가 아니라 operator federation으로 가야 한다.

각 operator는 최소한 아래 contract를 가진다.

- detector
- candidate generator
- planner
- risk estimator
- validation plan
- proof template
- abandon criteria

### 초기 operator 후보

#### Refactor Operator
- god class decomposition
- cycle elimination
- responsibility rebalance
- dependency inversion
- module split

#### Test Generation Operator
- missing test discovery
- characterization tests
- regression test backfill
- edge-case generation

#### Rule Repair Operator
- architecture violation fix
- layer violation correction
- import boundary repair

#### Dependency Hygiene Operator
- stale dependency cleanup
- deprecated API migration assist
- unsafe dependency boundary surfacing

#### Review Prep Operator
- PR risk summary
- blast radius explanation
- reviewer suggestion
- proof digest generation

---

## proof-carrying change

AI가 “고쳤다”라고 말하는 건 의미 없다.
중요한 것은 **proof를 동반한 변경**이다.

모든 변경은 최소한 다음 질문에 답해야 한다.

- 무엇을 바꿨는가?
- 왜 바꿨는가?
- 어떤 goal/opportunity를 겨냥했는가?
- 무엇이 실제로 개선됐는가?
- 어떤 검증을 통과했는가?
- 무엇이 아직 불확실한가?
- 누가 리뷰해야 하는가?

### proof artifact 예시 필드
- task id
- goal/opportunity linkage
- operator
- changed files
- before/after metrics
- expected delta vs actual delta
- validation summary
- API diff summary
- rule diff summary
- risk tier
- uncertainty notes
- recommended reviewer

신뢰는 모델 confidence가 아니라 다음으로 형성된다.

- validation completeness
- prediction accuracy
- PR acceptance rate
- reviewer edit distance
- revert rate
- operator-specific historical success

---

## planning model

planner는 “무엇을 고칠 수 있는가”가 아니라,
**무엇을 지금 고치는 것이 가장 가치 있고 안전한가**를 선택해야 한다.

### planner inputs
- repository state snapshot
- active goals
- policies / budgets
- operator capabilities
- trust envelope
- branch/PR status
- historical outcomes

### planner objective
최적화 대상:
- engineering value 최대화
- goal delta 최대화
- semantic risk 최소화
- review burden 최소화
- cross-boundary churn 최소화
- proof strength 최대화
- execution budget 준수

### planner outputs
- prioritized task graph
- operator assignment
- recommended autonomy profile
- expected outcome
- proof obligations
- required approvals

---

## safety model

### Safe lane
자동 실행 가능:
- test addition
- dead code deletion
- import cleanup
- safe rename
- bounded extract
- mechanical rule repair

### Guarded lane
guided or approval required:
- class split
- dependency inversion
- module relocation
- multi-step refactor

### Restricted lane
plan only or manual:
- public API breaking changes
- schema changes
- auth/security semantics
- distributed protocol changes
- high-ambiguity business logic redesign

### principle
**모호하면 멈춘다.**

ARE는 억지 패치를 내는 시스템이 아니라, 불확실성을 표면화하고 안전하게 abandon할 수 있어야 한다.

---

## human roles

### Individual Engineer
- editor pair mode 사용
- local hotspot 해결
- suggested task consume

### Senior / Staff Engineer
- decomposition intent 제공
- non-goals 설정
- forbidden zone 지정
- review checkpoint 설계
- high-leverage refactor steering

### Team Lead / Manager
- repo/team goals 설정
- policy/autonomy budget 설정
- 장기 health ops 운영

즉 인간을 대체하는 게 아니라,
**실행노동을 agent가 흡수하고 인간은 steering과 judgment에 집중**하게 만든다.

---

## UX surfaces

### 1) Home / Assistant Inbox
- active goals
- suggested work
- safe auto-run candidates
- guidance-needed tasks
- review-needed PRs
- recent proofs

### 2) Goal Page
- target vs actual
- drift trend
- top contributors
- suggested remediations
- execution profile
- proof history

### 3) Guided Refactor Workspace
시니어가 넣는 것:
- intent
- sequencing
- do-not-touch zones
- desired abstraction shape
- review checkpoints

시스템이 보여주는 것:
- execution plan
- batches / PR stack
- progress
- proof snapshots
- blocked reasons

### 4) Proof Panel
- before/after metrics
- changed files
- validation results
- risk/uncertainty
- reviewer recommendation

### 5) IDE Pair Surface
- hotspot-aware actions
- extract/move/split recommendations
- immediate local validation
- goal context injection

---

## system architecture

### 1. Repo Intelligence Layer
입력:
- code graph
- dependency graph
- call graph
- ownership
- churn/history
- tests
- incidents/signals
- architecture rules

출력:
- typed repository state
- metric snapshots
- hotspot graph
- task opportunities

### 2. Goal & Policy Layer
- goals 저장
- guardrails 저장
- budgets 저장
- baseline freezing
- approval policy 관리

### 3. Opportunity Engine
- drift뿐 아니라 repo-wide opportunity 발굴
- flaky tests, stale code, migration opportunities 등 계산

### 4. Planning Engine
- task generation
- operator assignment
- expected delta estimation
- batching / sequencing
- risk classification

### 5. Execution Engine
- structured task contract를 기반으로 patch 생성
- validation retries
- branch/PR/stack 생성

### 6. Proof Engine
- validation evidence 집계
- metric delta recomputation
- rule/API diff
- uncertainty surfacing

### 7. Governance Engine
- approval policies
- protected area rules
- operator allowlist
- rollback / audit trail

---

## Quanta에서의 제품 포지션

이 방향은 현재 제품 비전과 잘 맞는다.

우리는 원래부터:
- 코드를 이해하는 인프라
- blast radius, taint, ownership, incidents, architecture, dead code 같은 신호를 다루는 제품

즉 이미 “repo understanding”이 중심이다.

그 위에 올라갈 next layer는 자연스럽게:
- observation
- prioritization
- remediation planning
- constrained execution
- proof-backed PR generation

이다.

다르게 말하면:

> 지금까지는 **읽는 엔진**이었다면,
> 앞으로는 **읽고-판단하고-일하는 엔진**이 되어야 한다.

---

## rollout strategy

### Phase 0 — Repo Intelligence
- snapshot
- hotspot/opportunity surfacing
- no execution

### Phase 1 — Goals + Suggest
- goal authoring
- drift analysis
- remediation plans
- no autonomous patching by default

### Phase 2 — Guided Execution
- background agent execution
- senior-guided refactor workflow
- proof-backed PRs

### Phase 3 — Safe Lane Autonomy
- tests
- dead code
- rule repair
- bounded refactors auto PR

### Phase 4 — Continuous Repo Autopilot
- recurring scans
- mixed goal/opportunity queue
- trust-aware scheduling
- long-running health ops

---

## initial success criteria

### Product
- active repos with ARE enabled
- active goals per repo
- suggestion → execution conversion
- guided run completion rate
- autonomous PR acceptance rate

### Technical
- expected vs actual delta accuracy
- validation pass rate
- revert rate
- false-safe rate
- recurring drift reduction

### Trust
- reviewer edit distance after AI PR
- operator-specific acceptance rate
- autonomy upgrades over time
- safe lane expansion rate

---

## open questions

1. Goal spec을 UI-only로 둘지 repo-stored policy-as-code까지 갈지?
2. opportunity queue와 goal queue 충돌 시 arbitration policy는?
3. proof artifact의 canonical surface는 PR comment / check run / 전용 UI 중 무엇인지?
4. senior-guided plan을 자연어로 받을지 structured plan schema로 받을지?
5. continuous mode의 cadence, budget, concurrency를 어떻게 제어할지?
6. autonomy upgrades를 수동 설정으로 둘지 trust-based recommendation으로 둘지?

---

## naming recommendation

### Top-level concept
- Autonomous Repo Engineer
- Repo Autopilot
- Autonomous Engineering Assistant

### Internal architecture
- Goals
- Policies
- Operators
- Reconciler
- Proof Engine
- Autonomy Profiles

현재로선 아래 조합이 가장 좋다.

- **제품 철학:** Autonomous Repo Engineer
- **운영 메커니즘:** Goals + Operators + Reconciliation
- **신뢰 계층:** Proof Engine
- **자율성 제어:** Autonomy Profiles

---

## final recommendation

이 방향은 “god class 줄이기” 같은 단일 use case에서 시작할 수는 있지만,
문제 정의를 거기에 묶어버리면 안 된다.

정확한 framing은 이거다.

> **레포에 붙어 지속적으로 일하는 자율주행 개발자 비서**를 만든다.
> 
> 이 비서는 레포 상태를 이해하고,
> 목표와 정책을 기준으로,
> 유지보수·리팩토링·생산 작업을 스스로 찾고,
> 적절한 autonomy level에서 실행하며,
> proof-backed PR로 결과를 낸다.

그리고 그 안에서:
- refactoring은 대표 workload
- goals는 steering wheel
- operators는 hands
- proof engine은 trust layer
- autonomy profiles는 gearbox

이 framing으로 전체 roadmap, cloud execution, IDE UX, static engine evolution을 연결하는 것이 맞다.

---

## linked follow-ups

- RFC: `/Users/songmin/Documents/code-new/quanta-ide/docs/rfc/2026-04-23-autonomous-repo-engine.md`
- Spec package: `/Users/songmin/Documents/code-new/quanta-ide/docs/roadmap/specs/apr-23-autonomous-repo-engine-spec.md`
- **Prototype app** (exploratory, mock-driven): `p0-ide-v2/packages/app-autopilot/` — Autopilot 탭으로 노출 (`⌘⌥A`)
  - Surfaces: Overview inbox · Goals (index + detail) · Runs (index + timeline detail) · Proof detail (verifier-backed) · WorkItems · Opportunities · Operators · Snapshot
  - Fixtures: realistic "argon" fintech monorepo with billing/auth/ledger/pricing services + 6 live runs (incl. running, awaiting_review, abandoned, failed)
  - Keybindings: `gg/go/gr/gw/gu/gp/gs` vim-style navigation, `Esc` closes detail, `J/K` inbox triage
