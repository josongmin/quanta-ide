# RFC: Counterfactual Branch (Tech-Debt Projection)

**날짜**: 2026-04-15
**상태**: 기획 중
**작성**: Jo + Claude

---

## 한 줄 정의

> **"이 patch 를 dismiss 했다면 7일 후 이 repo 는 어떻게 됐을까."**
> 엔진이 기술 부채의 시간축 결과를 투영한다. 부채를 **그래프로** 보여주고, 지금 고치는 것과 미루는 것의 비용을 숫자로 비교한다.

---

## 문제

에이전트가 patch 를 제안하면 사용자는 둘 중 하나를 한다:
1. Apply — 지금의 비용(리뷰·테스트)을 지불하고 문제를 없앰
2. Dismiss — 미래의 비용(부채 누적, incident) 에 베팅

현재 IDE 는 **지금의 비용만** 보여준다 ("risk 78 → 12"). 미래 비용은 사용자의 **감** 이나 기억에 의존한다. 결과:
- "나중에 고치자" 가 기본값이 됨 → 부채 축적
- 시니어 엔지니어 한테만 "이거 나중에 터질 거다" 감각이 있음
- 팀 전체가 **현재 가시화된 리스크**에 반응하고 **예측된 리스크**에는 반응 안 함

엔진은 이미 taint · blast · complexity · incident DNA · ownership 같은 구조 신호를 갖고 있다. 이 신호들의 **시간 경사** 를 측정하면 "이 코드가 방치될 때 어떻게 썩어가는지" 를 예측할 수 있다. 우리만 할 수 있는 시각화다.

---

## 비(非)목표

- 미래 예측이 정답이라고 주장 안 함. **시나리오** 로 제시.
- 데드라인 / 릴리즈 일정 예측 안 함. 부채 축적 궤적만.
- 자동으로 action 을 강제 안 함. 보여주고 판단은 사람 / 에이전트에게.

---

## 설계 원칙

1. **Counterfactual = shadow branch** — 실제 branch 가 아닌, 엔진이 돌리는 **시나리오 상태**. git worktree 쓰지 않음.
2. **Historical signal gradient** — 과거 유사한 코드가 어떻게 됐는지(incident DNA · churn · cpx 증가율) 를 기반으로 미래를 투영.
3. **Comparable to apply** — Counterfactual 은 항상 "if applied" 와 **나란히** 제시. 단독으로는 가치 낮음.
4. **Horizon is explicit** — 7d / 30d / 90d 중 고를 수 있게. 기본 7d.
5. **Confidence bands, not point estimates** — "risk 가 78 → 102 된다" 대신 "78 → 92-108 범위, 중앙값 102". 예측임을 UI 가 강조.

---

## 데이터 모델

### 투영 입력

```ts
type ProjectionInput = {
  changeSetId: string
  targetSymbol: string             // 관심 대상 (patch 가 건드릴 곳)
  horizonDays: 7 | 14 | 30 | 90
  scenario: "dismiss" | "apply"    // 둘 다 돌려서 비교
  decayAssumptions: {
    churnContinues: boolean        // 이 파일의 churn rate 유지
    teamSizeStable: boolean
    featureVelocityStable: boolean
  }
}
```

### 투영 출력

```ts
type Projection = {
  scenario: "dismiss" | "apply"
  horizonDays: number

  metrics: {
    risk: Trajectory                 // 일별 또는 주별 risk score
    blastRadius: Trajectory
    complexity: Trajectory
    coverage: Trajectory
    incidentProbability: Trajectory  // 0-1, 이 기간 내 incident 확률
  }

  predictedIncidents: PredictedIncident[]
  predictedCascade: CascadeNode[]   // 이 부채가 번질 symbol
  predictedCost: {
    engineeringDaysLow: number
    engineeringDaysMedian: number
    engineeringDaysHigh: number
  }
}

type Trajectory = {
  points: { day: number; median: number; low: number; high: number }[]
  model: string                     // "historical-avg", "linear-extrapolation", "incident-weighted"
}

type PredictedIncident = {
  simulationId: string
  likelyWithinDays: number
  similarity: number                // 기존 incident 와의 DNA 유사도
  similarIncidentId: string         // INC-412
  reason: string                    // "unvalidated trace forwarded to sink; matches INC-412 shape"
}
```

### 예측 모델 (v0.1 간단)

- **Risk gradient**: historical average of repo 의 cpx-growth rate · coverage-decay rate 에 현재 cpx/coverage 를 더해 미래 예측
- **Incident probability**: incident DNA 유사도 + past time-to-fire 통계로 베이지안 추정
- **Cascade**: blast graph 에서 `targetSymbol` 로부터 outgoing edges 를 따라가며, 각 edge 에 churn-weighted 전파 확률 적용

고도화는 후속 (ML 모델, 외부 팀의 실제 incident 데이터로 학습 등).

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│  Projection Request                      │
│    (patch apply / dismiss decision)      │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Historical Signal Loader                │
│    churn · cpx · coverage · incidents    │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Scenario Simulator                      │
│    dismiss: apply decay models           │
│    apply:   recompute post-patch state   │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Projection Renderer                     │
│    trajectories · incidents · cost       │
└──────────────────────────────────────────┘
```

---

## IDE 통합

### Inspector L3 — SuggestionOverlay 에 통합

기존 Counterfactual 섹션(이미 있음)을 **실제 그래프** 로 확장:

```
┌─── COUNTERFACTUAL · if dismissed ────────────────────────┐
│                                                           │
│  horizon [7d ▾]    models [historical-avg ▾]              │
│                                                           │
│  RISK trajectory                                          │
│  110┤                      .--     (dismiss)              │
│  100┤                   .-'                               │
│   90┤           .----'                                    │
│   80┤─── now 78                                           │
│   70┤                                                     │
│   60┤                                                     │
│   50┤                                                     │
│   40┤                                                     │
│   30┤                                                     │
│   20┤─── apply post       ────────────────  (apply)       │
│   10┤                                                     │
│     └─────────────────────────────────────── day          │
│      now    +1d   +2d   +3d   +4d   +5d   +6d   +7d       │
│                                                           │
│  PREDICTED INCIDENTS (dismiss path)                       │
│   ⚠ INC-412-like likely within 11d   (91% shape match)    │
│   ⚠ cascade to auth/session.py        (churn-weighted)    │
│                                                           │
│  COST DELTA                                               │
│   dismiss: ~3.5 eng-days (median) · 1.8-5.2 range         │
│   apply:   0.3 eng-days (now)                             │
│                                                           │
│  [Open scenario workspace →]                              │
└───────────────────────────────────────────────────────────┘
```

- 2개 trajectory 라인 (apply / dismiss) 이 겹쳐 그려짐. confidence band 로 반투명 영역.
- X 축: horizon. Y 축: risk score 또는 다른 메트릭 (셀렉터로 전환).
- 위쪽 컨트롤: horizon / model selector.
- 예측 incident 리스트 + 비용 델타.

### 신규 workspace: "Scenario"

심층 분석용 — Inspector 모달이 작다면 여기서 풀 뷰.

```
┌─── Scenario · orchestrator.py · execute() ──────────────┐
│  Compare: [dismiss] vs [apply] · horizon [30d ▾]         │
│                                                          │
│  ┌──── multi-metric grid ─────────────────────────────┐  │
│  │  risk    │  blast   │  cpx   │  coverage  │ incid  │  │
│  │  graph   │  graph   │  graph │  graph     │  prob  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                          │
│  CASCADE MAP                                             │
│  (graph visualization — symbols that inherit the debt)   │
│                                                          │
│  HISTORICAL ANALOG                                       │
│  "3 months ago, similar situation in payment_svc:        │
│   dismissed → INC-289 3 weeks later, 5 eng-days lost."   │
└──────────────────────────────────────────────────────────┘
```

### L4 단축키

| 바인딩 | 동작 |
|--------|------|
| `⌘⇧C` | Scenario workspace 열기 (current symbol) |
| `⌘⇧←` / `⌘⇧→` | horizon 이전/다음 (7d→14d→30d→90d 사이클) |

---

## 다른 RFC 와 연계

- **Proof-Carrying PR**: PR 에 counterfactual 그래프 첨부. 리뷰어가 "왜 이걸 지금 고쳐야 하냐" 를 그래프로 납득.
- **Rule Compliance Verifier**: Counterfactual 이 "위반했을 때의 미래 비용" 도 계산 — 규칙 엔포스먼트 정당화 도구.
- **Agent Orchestrator**: 백그라운드 에이전트가 dismiss 한 patch 에 대해 IDE 가 알람 — "백그라운드 에이전트가 3시간 전에 dismiss 한 거, 7일 후 위험 112 예측".

---

## Feature Registry

```ts
registerFeature({
  id: "counterfactual",
  title: "Counterfactual Projection",
  workspace: ScenarioWorkspace,
  commands: [
    { id: "scenario.open", title: "Open scenario", run: open },
    { id: "scenario.compare", title: "Compare apply vs dismiss", run: compare },
  ],
  shortcuts: [
    { key: "cmd+shift+c", command: "scenario.open" },
  ],
  statusContribution: { id: "cf-pending", render: CfPendingBadge },
})
```

---

## MVP 범위 (v0.1)

1. SuggestionOverlay 의 기존 counterfactual 섹션을 **trajectory 그래프** 로 대체
2. 2개 메트릭: risk · blast
3. 2개 horizon: 7d · 30d (UI 에선 토글)
4. 예측 모델: historical-avg 단일
5. Predicted incidents 리스트 (incident DNA 기반)
6. Cost delta 숫자 (eng-days median)

v0.2+: Scenario workspace (풀 뷰) / cpx · coverage · incident-prob 메트릭 추가 / cascade 그래프 시각화 / historical analog 섹션 / 외부 incident 데이터 학습 옵션 / 90d horizon

---

## 열린 질문

1. **historical data 충분한가** — 신생 repo 는 churn / incident 데이터가 얇음. v0.1 은 cross-repo 평균을 fallback 으로 사용할지.
2. **예측 책임** — "11d 내 incident" 라고 했는데 실제로 안 터지면? 신뢰도 저하 위험. confidence band 가 넉넉하도록 기본값 보수적.
3. **사용자 교육** — 그래프를 "점술" 로 오해할 가능성. `based on historical patterns, not a forecast` 면책 문구 필수.
4. **성능** — 트러젝토리 계산 비용. 변경 시점마다 재계산하면 느림. 캐시 + 증분 갱신 필요.

---

## 성공 지표

- 사용자가 patch 를 **dismiss 하기 전에** Counterfactual 을 **본다** (열람 비율).
- "dismiss 후 나중에 후회" 사건 감소 (사용자 보고 기준).
- 팀이 시니어 "감" 없이 **주니어도** 부채 비용을 판단할 수 있다 (팀 효용 지표).
- Counterfactual 그래프가 PR 리뷰 맥락에서 공유된다 (Proof-Carrying PR 와 연계).
