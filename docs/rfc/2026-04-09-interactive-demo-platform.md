# RFC: Agent-first Control Tower IDE

**날짜**: 2026-04-09
**상태**: 기획 중
**작성**: Jo

---

## 제품 정의 (Product Definition)

### 이게 무엇인가

**강력한 정적 분석 엔진 위에 올라간 코드 인텔리전스 + 컨트롤 패널.**

레포지토리를 구조적으로 이해한다. 함수 하나, 파일 하나가 아니라 시스템 전체를 — call graph, dataflow, blast radius, taint path — 엔진이 상시 분석하고, 그 결과를 개발자 앞에 즉시 꺼내놓는다.

두 가지 역할이 동시에 존재한다:

- **인텔리전스**: "이 코드가 시스템에서 무슨 의미인지"를 보여주는 분석 레이어
- **컨트롤 패널**: 분석을 보고 → 판단하고 → 한 번에 확정하는 의사결정 인터페이스

### 왜 지금인가

AI가 코드를 찍어낸다. 문제는 사람이 아니라 LLM이 레포 구조를 이해 못 하고 생성한다는 것이다. 레포가 커질수록 중복 코드, 아키텍처 붕괴, 일관성 없는 패턴이 쌓인다. 그 결과 LLM도, 사람도 신뢰할 수 없는 코드베이스가 된다.

신뢰가 없는 진짜 이유는 두 가지다:

1. **구조를 모른다** — LLM은 컨텍스트 창 안의 코드만 본다. 레포 전체의 의존 관계, 중복 패턴, 아키텍처 경계를 인식하지 못한다.
2. **강제하지 않는다** — 팀이 설계 원칙을 문서로 정해도, 코드 레벨에서 강제되지 않으면 LLM이 어기고 사람도 어긴다.

이 제품은 그 문제를 정면으로 조진다:

- **구조 파악**: 중복 코드, 아키텍처 위반, 일관성 없는 패턴을 실시간 감지 — clone detection, import graph, module dependency
- **철학 주입**: 팀의 소프트웨어 엔지니어링 원칙을 코드에 강제 — Architecture Guardrails, 의존성 규칙, spec mining으로 암묵적 패턴까지 추출
- **도구 제공**: 리팩토링, dead code cascade removal, safe fix — 파악에서 끝나지 않고 실제로 고친다

### 기존 IDE와 무엇이 다른가

손코딩용 IDE(VS Code, JetBrains 등)를 대체할 생각 없다. **별도 앱으로 뜨는 제품**이다 — 기존 IDE 위에 올라가는 플러그인이나 레이어가 아니다.

코드 편집 창 형태는 유지한다. 개발자가 인지할 수 있는 가장 직관적인 형태라서 그대로 쓰이는 것이지, 에디터가 핵심이 아니다. 달라지는 건 그 위에 올라가는 **정보와 기능**이다.

| | 기존 IDE | 이 제품 |
|--|---------|--------|
| **형태** | 손코딩 전용 도구 | 별도 앱 — 분석/인텔리전스/코딩 통합 |
| **에디터** | 코드 편집이 목적 | 코드 라인이 가장 직관적 형태라 유지. 편집은 수단 |
| **우측 패널** | 파일/심볼 탐색 | 분석 결과 + 인텔리전스가 1급 시민 |
| **AI** | 코파일럿 보조 (코드 생성) | 엔진이 레포 구조를 알고 있는 상태에서 동작 |
| **범위** | 개인 생산성 | 팀 아키텍처 철학까지 주입 |
| **목적** | "코드를 써라" | "구조를 이해하고, 안전하게 바꿔라" |

**에디터 오버레이 원칙**: hover / inline / gutter — 클릭 없이 보이는 것만으로 1차 판단 가능. 더 깊은 정보는 클릭/hover로 단계적 노출. 개발자의 시선 이동을 최소화하면서 최대한의 컨텍스트를 제공하는 것이 목표.

**우측 패널 원칙**: 파일 탐색기가 아니다. 현재 커서 위치 기준으로 — call graph, taint path, blast radius, dataflow — 를 즉시 보여주는 분석 뷰어. 에디터와 양방향 연동.

**AI Agent 원칙**: 손코딩에서 벗어난 AI native 개발자는 여기서 코딩한다. 엔진이 레포 전체 구조를 이미 알고 있기 때문에, agent가 "이 함수 추출해줘"를 받으면 blast radius와 behavior equivalence를 검증한 뒤 적용한다 — 구조를 모르는 외부 LLM과 다른 점.

### 타겟이 누구인가

**코드를 보는 방식이 달라진 개발자 — 다 같은 사람이다.**

손으로 치든 AI가 치든, 결국 코드 앞에 앉아서 "이거 맞냐"를 판단해야 한다. AI native 개발자도 코드는 본다. 생성 속도가 빨라졌을 뿐, 코드를 읽고 구조를 판단하는 행위는 없어지지 않는다. 오히려 AI가 찍어낼수록 "이게 레포랑 맞나"를 확인하는 빈도는 늘어난다.

타겟을 분리할 필요 없다. UX가 그 차이를 수용하면 된다:

- 손코딩 개발자 → 에디터에서 치면서 실시간 오버레이로 판단
- AI native 개발자 → agent가 생성한 결과를 Change Card로 확정
- 테크 리드/아키텍트 → Architecture Guardrails + Blast Radius로 팀 전체 구조 감시
- CTO/엔지니어링 매니저 → Debt Monetization으로 숫자로 설명

같은 제품, 같은 엔진, 진입점만 다르다.

### 한 줄 정의

> **외부용**: "코드 한 줄 바꾸면 시스템 전체 영향이 눈앞에서 바뀌는 IDE"
> **내부용**: "코드를 이해하는 IDE가 아니라, 구조를 강제하는 인텔리전스"

정적 분석을 '읽는 것'이 아니라 **'만지는 것'**으로 바꾼다.
이건 단순 기능 조합이 아니라, interaction model 자체의 변화다.

---

## 제품 컨셉

### Agent-first + Human-in-the-loop Control Tower IDE

```
┌─────────────────────────────────────────────────┐
│  Control Tower IDE                              │
│  "코드를 치는 도구가 아니라 시스템을 내려다보는 │
│   관제탑. Agent가 분석하고, 사람이 확정한다"    │
├─────────────────────────────────────────────────┤
│  Static Analysis Engine                         │
│  Blast Radius · Simulate Change · Taint Flow    │
│  → 이게 없으면 위에 아무것도 못 올림            │
└─────────────────────────────────────────────────┘
```

**Agent-first**
- 분석, 탐지, 제안, 수정안 생성 → 전부 에이전트가 먼저
- 개발자는 "처음부터 직접 파는" 게 아니라 "에이전트가 갖다 놓은 결과 위에서 판단"

**Human-in-the-loop**
- 최종 확정은 항상 사람
- `[Fix safely]` `[Apply]` `[Dismiss]` — 딸깍 한 번
- 자동 머지 ❌ — 사람이 컨트롤 잡고 있다는 신뢰

**Control Tower**
- 코드 에디터가 아니라 시스템 관제탑
- 파일 단위가 아니라 시스템 단위로 본다
- blast radius, taint flow, dependency drift — 위에서 내려다보는 시점

**엔진이 핵심인 이유**
- IDE는 껍데기. 엔진 없으면 빈 관제탑
- Blast Radius, Simulate Change, Taint Flow — 이 3개가 엔진
- 엔진이 정확해야 에이전트도 믿을 수 있고, 사람도 딸깍 할 수 있음

```
Agent가 분석한다 → 엔진이 근거를 만든다 → 관제탑에 띄운다 → 사람이 확정한다
       ↑                                                       ↓
       └────────── feedback loop ──────────────────────────────┘
```

---

## 경쟁 포지셔닝

```
Copilot / Cursor  →  "코드 만들어줌"         (생성)
SonarQube / Snyk  →  "경고 183개 있습니다"   (리포트)
p0                →  "이거 바꾸면 31파일 터짐. 고칠까?"  (인텔리전스 + 액션)
```

→ 완전히 다른 카테고리.
→ 개발자는 "코드 생성"보다 **"이거 건드려도 되냐"**에서 돈 낸다.

**왜 기존 도구가 이걸 못 하는가:**

| 도구 | 한계 | 구조적 이유 |
|------|------|-----------|
| Copilot / Cursor | 레포 구조 모름 | 컨텍스트 창 안의 코드만 봄. 의존 관계, 아키텍처 경계 인식 못함 |
| SonarQube / CodeClimate | 경고 리포트만 줌 | 배치 분석. 타이핑 중 실시간 반응 불가. 경고 → 액션 연결 없음 |
| ESLint / Semgrep | 로컬 패턴만 잡음 | 파일 단위 규칙. 크로스-파일 dataflow, blast radius 계산 못함 |
| Snyk | 보안 취약점만 | taint flow는 있지만 아키텍처/behavior diff/blast radius 없음 |

이 제품의 해자: **정적 분석 엔진이 레포 전체를 구조적으로 이해하고 있다**는 전제. 이게 없으면 위의 모든 기능이 불가능하고, 이 엔진을 새로 만드는 건 수년 단위 투자.

---

## 전략 우선순위

### P0 — 이것만 완벽하면 시장 먹는다

| # | 기능 | 한 줄 | 왜 킬러인가 |
|---|------|-------|-------------|
| 1 | **Blast Radius** | "이거 바꾸면 31개 파일 터짐" | 개발자가 제일 두려운 것 = "이거 건드리면 어디까지 터지냐". 기존 IDE/Cursor/Copilot 전부 못함. 숫자 하나로 PR 리뷰/리팩토링/위험도 커뮤니케이션 기준이 됨 |
| 2 | **Simulate Change** | "바꾸기 전에 결과 보여줌" | 기존 = "수정 → 실행 → 테스트 → 깨짐". 이건 = "수정 전에 결과 봄". 개발 패러다임 자체가 바뀜 |
| 3 | **Taint / Data Flow** | "데이터가 어디서 와서 어디로 가냐" | 보는 순간 와 하는 기능. 코드 읽는 속도 10배. 실시간 + ambient UX가 차별화 |

### P1 — 강한 부스터

| 기능 | 이유 |
|------|------|
| **Incident DNA Mapping** | 과거 장애 패턴 기억 → 유사 코드 작성 시 실시간 경고. 엔진(blast radius + taint)이 있어야만 가능 = 해자 |
| **Semantic PR Auto-Pilot** | PR description을 분석 데이터로 자동 생성. 매일 쓰는 workflow = retention |
| **Architecture Guardrails** | 팀 스케일에서 설계 붕괴 방지. Enterprise 전환 근거 |
| **Technical Debt Monetization** | CTO/CFO가 돈의 언어로 이해. 세일즈 킬러 |
| **Dead Code Cascade Removal** | 단일 dead code 제거는 의미 없음. cascade 제거 = 팀 레벨 효과 |
| **Time Machine + 분석 상태 복원** | git blame/bisect 이미 있으나, "분석 상태까지 복원"이 차별점 |

### P2 — 후순위 (재미는 있지만 엔진 아님)

관중 모드 / 소셜 / 이모지 반응 / Control Tower 우주 뷰 / Ghost Execution / "AI보다 낫다" 비교 UI / 사운드 연출

→ 마케팅엔 도움 되지만 **불꽃**이지 **엔진**은 아님.

---

## IDE 경험 5가지 타입 (정식 분류)

> **한 줄 결론**: "코드를 이해하는 IDE"가 아니라 **"변경을 판단하는 IDE"**로 재구성한다.  
> 아래 5가지가 IDE 경험의 전부다.

### 1️⃣ ⚡ Ambient Awareness (아무것도 안 해도 보이는 것)

**목적**

- 0초 이해
- "이거 위험한 코드다 / 안전하다" 즉시 판단

**핵심 기능**

| 기능 | 예시 | 근거 |
|------|------|------|
| **CodeLens Risk Strip** (필수) | `// ⚡ complexity 8.2   💀 no tests   🔴 taint` + `function processRefund() {` | glanceable UI → 인지 부하 ↓. 숫자 + 아이콘 → fast system 1 판단 |
| **End-of-block Blast Radius** | `} // 📍 31 files affected` | 인간은 끝에서 요약을 가장 잘 인식. 영향 범위 = 핵심 판단 정보 |
| **Inline Risk Markers** | `const amount = req.body.amount   // 🔴 source` / `db.update(...)   // ⚠️ 14 callers` | context-bound 정보 → 기억 필요 없음. 시선 이동 최소화 |
| **File-level Risk Badge** | `payment.ts   🔴 12` / `auth.ts      ⚠️ 4` | 탐색 단계에서 필터링 가능, hotspot detection |

**버려야 할 것**

- 긴 설명, 패널 이동, **hover 의존** (기본 판단은 보이는 것만으로)

---

### 2️⃣ 🔍 Structural Understanding (구조 이해)

**목적**

- "이 코드가 시스템에서 뭐 하는지" 즉시 파악

**핵심 기능**

| 기능 | 예시 | 근거 |
|------|------|------|
| **Call Graph** (클릭 즉시) | `processRefund` → `validateUser`, `db.update ⚠️`, `webhook 💀` | 트리/그래프 구조를 빠르게 파싱. 코드 라인보다 연결이 중요 |
| **Dataflow / Taint Visualization** | `req.body → processRefund → db.update` | causality 이해 = debugging 핵심. LLM이 약한 영역 → 차별화 |
| **Structural Card** (코드 옆 요약) | Input: user input 🔴 / Output: DB write ⚠️ / Risk: HIGH | code reading → abstraction. cognitive compression |

**버려야 할 것**

- 클래스/파일 구조 tree만 보여주기 (이미 IDE에 있음)
- "go to definition" 같은 저수준 기능을 제품 차별점으로 강조

---

### 3️⃣ 🔮 Predictive Interaction (미래 예측)

**목적**

- "수정하면 뭐 일어나는지" 실행 없이 판단

**핵심 기능**

| 기능 | 예시 | 근거 |
|------|------|------|
| **Simulate Change** (최우선) | `if (amount >= 0)` → 변화: `amount=0` case 실행됨 / 영향 31→37 files / taint path +1 | 인간은 결과 기반으로 결정. 시뮬레이션 → uncertainty 제거 |
| **Pre-change Warning** | `⚠️ 영향: 31 files, 12 tests, taint 2개` + `[계속] [보기]` | 행동 전 friction → 사고 예방. **high-risk일 때만** (중요) |
| **Delta Highlight** | before → after 변화 강조 | 인간은 변화(diff)를 더 잘 인식 |

**버려야 할 것**

- vague prediction, "maybe" 같은 표현

---

### 4️⃣ 🧾 Decision Interface (딸깍 UI)

**목적**

- 인간이 **승인만** 하게 만들기

**핵심: Change Card** (가장 중요)

```
[Agent Proposal]

변경:
  processRefund 조건 수정

영향:
  files: 31 → 37
  tests: 2 영향
  taint: +1

행동 변화:
  amount == 0 → 실행됨

리스크: 🔴 HIGH

[Approve] [Reject] [Modify]
```

| 기능 | 근거 |
|------|------|
| **Change Card** | Hick’s Law → 선택지는 적을수록 좋음. Decision fatigue 감소. PR 리뷰 패턴과 동일 |
| **Risk Delta Indicator** | `Risk: 78 → 65 ↓` — 절대값보다 변화량에 반응 |
| **Evidence Toggle** | "왜?" 짧게 + `[경로 보기]` — 필요 시만 확장 |

**버려야 할 것**

- 채팅 인터페이스를 기본 의사결정 경로로 쓰기, 긴 설명, 자유형 질문 UX를 P0로 두기

---

### 5️⃣ 🔁 Feedback & Learning Loop

**목적**

- 인간이 시스템을 **신뢰**하게 만들기

| 기능 | 예시 | 근거 |
|------|------|------|
| **Verification Result** | ✓ behavior 동일 / ✓ side-effect 동일 | 신뢰 = 반복된 정확한 결과 |
| **Time Machine** (원인 추적) | "이 커밋에서 깨짐" | debugging 시간 ↓ |
| **Confidence + Evidence** | `Confidence: 92%` / `경로: line 12 → 34` | 설명 가능한 시스템 = 신뢰 ↑ |
| **False Positive Control** | `[이 경고 무시]` | alert fatigue 방지 |

---

### IDE 경험 우선순위 (제품 로드맵과 별도 축 — **경험 완성도**)

| 단계 | 없으면 / 차별화 | 항목 |
|------|-----------------|------|
| **P0** (없으면 실패) | 필수 체감 | Blast radius · Simulate change · **Change card** (딸깍 UI) |
| **P1** (차별화) | 경쟁사 대비 쐐기 | Dataflow / taint · Risk delta · Structural card |
| **P2** (완성도) | 신뢰·운영 | Time machine · Verification UI · False positive control |

위 P0는 본 RFC「전략 우선순위」의 엔진 축(Blast Radius, Simulate Change, Taint 등)과 **같은 방향**이며, 여기서는 **의사결정 UI(Change card)**를 P0에 명시적으로 포함한다.

---

## 왜 이 아이디어가 강한가

### 1. 정적 분석을 "리포트"가 아니라 "상호작용"으로 재해석

SonarQube는 "경고 183개 있습니다"를 리포트로 준다. CodeClimate은 GPA를 준다. 둘 다 배치 분석이고, 개발자가 코드를 치는 순간에는 아무것도 안 일어난다.

이 제품은 다르다. 분석이 코드 위에 살아있는 오버레이로 띄워지고, **수정하면 숫자가 즉시 바뀐다**. "왜 위험한지 / 뭐가 깨지는지 / 어떻게 고치는지"가 같은 화면에서 연결된다. 정적 분석의 **소비 방식**을 바꾸는 것.

### 2. 개발자가 근거로 말할 수 있게 해준다

"감으로 괜찮을 것 같습니다"와 "blast radius 31 files, taint path 2개, behavior equivalent 확인됨"은 PR 리뷰에서 권위가 다르다.

이 도구의 모든 분석 결과는 숫자 + 경로 + 증거다. 개발자가 팀 안에서 더 날카롭게 커뮤니케이션할 수 있는 도구 — 이건 생산성이 아니라 **영향력**의 문제라서 retention이 강하다.

### 3. 엔진이 해자다

경쟁자가 blast radius 숫자 하나를 보여주는 건 어렵지 않다. 그게 정확하려면 레포 전체의 call graph, dataflow, taint flow, behavior diff를 실시간으로 계산하는 엔진이 필요하다.

이 엔진을 새로 만드는 건 수년 단위 투자다. 327개 capability가 이미 구현/wired 상태 — 이게 기술적 해자이고, 위의 모든 기능이 여기 위에 올라간다.

### 4. 시각적 전달력이 강하다

함수 클릭 → blast radius 숫자 표시, 조건문 수정 → risk score 즉시 갱신, taint path gutter 세로선 — 이런 장면은 5초 화면 캡처 하나로 전달된다. 텍스트 설명이 필요 없는 타입이라 마케팅/세일즈에서 자연스럽게 확산된다.

---

## P0 킬러 기능 상세

### 1. Blast Radius — "이거 바꾸면 어디까지 터지냐"

함수 하나 클릭 → 영향 파일/테스트/콜 경로가 즉시 시각화.

```
processRefund() 클릭

  📍 Blast Radius
  ├─ 31 files affected
  ├─ 12 tests at risk (4 uncovered)
  ├─ 2 taint paths passing through
  └─ 14 callers (3 in hot path)

  [영향 파일 보기]  [시각화]  [PR 리뷰 노트로 복사]
```

**시각적 임팩트**
- 함수 클릭 → 중앙 노드 붉어짐
- 1차 호출자 3개 노드 등장 (빨간 선)
- 2차 호출자 9개 등장 (주황 선)
- 파일 트리에서 영향받는 파일들이 위에서 아래로 빨갛게 물듦
- 숫자 카운터: 0 → 31 애니메이션

**더 강화할 것**
- 테스트 영향도 같이 표시
- 런타임 경로 weight (hot path vs cold path)
- "safe boundary" 표시 — 여기까지는 안전, 여기부터 위험

> capability: `call_graph`, `change_impact_analysis`, `find_references`, `program_dependence`

---

### 2. Simulate Change — "바꾸기 전에 결과 보여줌"

코드를 실제로 실행하지 않고도, 수정의 결과를 미리 본다.

```
입력: if (amount > 0) → if (amount >= 0)

⚠️ Simulation Result

Behavior changes:
  amount === 0 case now executes refund

Impact:
  31 → 37 files affected (+6)
  taint path: +1 (user input → DB)

Security:
  ❌ 새 taint path 생성됨
  → req.body.amount → processRefund → db.update
```

**진짜 킬러 되는 조건**
- behavior diff + dataflow diff 같이 보여줌
- false positive 거의 없음 (deterministic + 근거 기반 + 재현 가능)
- edge case까지 커버

→ "대충 예측"이면 바로 버림. 이게 제대로 되면 Copilot/Cursor와 **완전히 다른 카테고리**가 된다.

> capability: `behavior_diff`, `dataflow`, `effect_analysis`, `change_impact_analysis`

---

### 3. Taint / Data Flow Visualization — "데이터가 어디서 와서 어디로 가냐"

데이터 흐름을 gutter의 얇은 세로선 + source/sink 마커로 표시. (파티클/애니메이션 ❌ — 디자인 원칙 참조)

```typescript
12  ┃ ▎ │ async function processRefund() {
13  ┃ ▎ ╿   const amount = req.body.amount      taint source
14  ┃ ▎ │   const tx = build(amount)
15  ┃ ▎ ╿   await db.update(tx)                 taint sink
16  ┃ ┛ │ }
```

- source/sink 노드는 `╿` 기호, 경로는 gutter 세로선
- hover 시: `flows from line 13 to line 15` + sanitizer 유무
- taint 해결 시 세로선 사라짐 (fade ❌, 즉시 제거)

**차별화 포인트**
- 실시간 업데이트 (타이핑 중에도)
- ambient 표시 (클릭 없이도 보임)
- 클릭 → 전체 경로 하이라이트 + Inspector 연동

> capability: `taint_flow`, `dataflow`, `def_use_facts`

---

## P1 강한 부스터 상세

### Incident DNA Mapping (장애 유전지도)

과거 장애의 코드 패턴을 기억했다가, 현재 개발자가 유사한 패턴을 작성하는 순간 즉시 경고.

```
⚠️  Incident DNA Match — 과거 장애 패턴 감지

  📌 매칭된 장애: INC-2024-0312 "결제 이중 처리"
     심각도: P0 · 영향: $47,000
     Root Cause: retry 루프에서 idempotency key 누락

  현재 코드 (line 34-41):
     → retry 루프 감지됨
     → idempotency 체크 없음
     → DB write가 루프 안에 있음

  유사도: 87%

  [장애 보고서]  [안전한 패턴으로 수정]  [무시]
```

**왜 강한가**: 우리 엔진(blast radius + taint flow)이 있어야만 단순 코드 유사도가 아니라 **의미론적 패턴 매칭**이 가능. 즉 엔진 자체가 해자(moat).

> capability: `git_history`, `incident_db`, `taint_flow`, `pattern_matching`

---

### Semantic PR Auto-Pilot

PR description을 분석 데이터로 자동 생성. "코드를 이렇게 바꿨습니다"가 아니라 **"이 변경은 이러한 의미를 가집니다"**로 번역.

```markdown
## 변경 요약
환불 로직 분리 + 입력 검증 강화

## 분석 기반 영향 평가
- 복잡도: 9.2 → 4.1 (−55%)
- Blast Radius: 31 → 12 files (−61%)
- Taint Path: 2개 제거됨 ✅
- 테스트 커버리지: 0% → 72% (4개 추가)

## 리뷰어 가이드 ⚠️
auth 모듈과의 결합도가 미세하게 상승했습니다.
→ src/auth/session.ts:45 라인 중점 리뷰 권장
→ 이유: 새 validateAmount()가 session context를 참조

## Behavior Diff
✅ 정상 입력: 동작 동일
⚠️  비정상 입력 (음수, NaN): 기존 DB 에러 → 이제 400 reject (의도된 변경)

## 관련 히스토리
- 이 영역 마지막 장애: INC-2024-0312 (이중 환불)
- 이 PR이 해당 장애 패턴을 해소함
```

**왜 강한가**: 매일 쓰는 workflow에 직결 = retention. 엔진 데이터가 그대로 PR에 녹아드니까 엔진의 가치를 매일 체감.

> capability: `change_impact_analysis`, `behavior_diff`, `taint_flow`, `complexity_analysis`

---

### Architecture Guardrails (설계 규약 강제)

회사의 아키텍처 헌법을 정적 분석으로 실시간 감시.

```
⛔ Architecture Violation

  규칙: domain/ → infra/ 직접 참조 금지
  위반: src/domain/order.ts:42
       → import { db } from '@/infra/database'

  수정 경로:
    domain/order.ts → ports/OrderRepository (interface)
                    → infra/OrderRepositoryImpl

  [자동 수정 미리보기]  [규칙 보기]  [예외 등록]
```

**Dependency Drift Alert**
```
⚠️  Architecture is Drifting (최근 30일)

  payments ↔ auth    : 3 → 14 references (+367%)
  orders ↔ shipping  : 8 → 23 references (+188%)

  예측: 6개월 후 순환 의존 발생
```

> capability: `import_graph`, `module_dependency`, `arch_rules`

---

### Technical Debt Monetization (기술 부채의 화폐화)

CTO/CFO가 이해하는 **돈의 언어**로 분석 결과를 번역.

```
💰 Technical Debt Cost Report

  processRefund()
  ─────────────────────────────────────
  복잡도: 9.2  ·  Blast Radius: 31 files
  최근 12개월 장애 기여: 4건
  수정에 소요된 인력: 47 eng-hours

  ⚠️  방치 시 향후 1년 예상 손실: $14,500
  리팩토링 비용 추정: $3,200
  ROI: 353%
```

> capability: `complexity_analysis`, `change_impact_analysis`, `git_history`, `cost_model`

---

### Dead Code Cascade Removal

dead code 하나 제거할 때 연쇄적으로 죽는 코드까지 한 번에 제안.

```
sendWebhook() 사용처 없음 (dead)
  → 제거하면 WebhookBuilder도 dead
    → 제거하면 retryConfig도 dead
      → 총 3개 파일, 847줄 제거 가능

[전체 미리보기]  [한 번에 적용]
```

> capability: `dead_code`, `call_graph`, `import_graph`

---

### Time Machine + 분석 상태 복원

스냅샷 + 분석 아티팩트를 함께 저장. "언제부터 위험해졌나" 추적.

```
📜 Risk Timeline — processRefund()

  ─●─────●─────●─●──────●─────●──→
   │     │     │ │      │     │
   │     │     │ │      │     └ 오늘 (blast: 31)
   │     │     │ │      └ 2주 전 (blast: 28)
   │     │     │ └ 1개월 전 ⚠️ taint path 추가됨
   │     │     └ 2개월 전 (blast: 18)
   │     └ 3개월 전 (blast: 12)
   └ 6개월 전 ⚠️ 첫 위험 패턴 등장 (blast: 8)
```

- git blame/bisect 이미 있으나, **분석 상태까지 복원**이 차별점
- 특정 함수의 complexity / taint / blast radius 변화를 그래프로

> capability: `git_history`, `incremental_analysis`, `snapshot_index`

---

## 디자인 원칙

매일 8시간 보는 도구다. 캐주얼 데모 연출은 처음 30초만 기능하고, 그 이후엔 피로가 된다.
참조 톤: **Linear / Vercel / Datadog APM / Figma / Raycast**.

### 비주얼 톤

| 항목 | 원칙 |
|------|------|
| **컬러** | 무채색 베이스 + 액센트 1색 (`--accent`). 위험은 농도로 표현, 채도로 ❌ |
| **타이포** | 정보 위계는 색이 아니라 **사이즈/굵기/spacing**으로 |
| **아이콘** | 장식 이모지 ❌. 의미 구분이 필요한 최소한의 상태 아이콘만 허용 (⚡ taint / ⛔ violation / ⚠ warning). 그 외는 단색 글리프(•, ▲, ◆)와 lucide 아이콘 |
| **애니메이션** | 200ms 이하, ease-out. flash/pulse/bounce ❌ |
| **숫자** | 즉시 갱신. 카운팅 ❌ (시각 노이즈) |
| **상태 변화** | opacity/border 변경. 색상 진동 ❌ |
| **알림** | 메시지 ❌, 상태만. "✨ 해소됨" 같은 보상 텍스트 금지 |
| **밀도** | 정보 밀도 높게. 여백 과잉 ❌ (Datadog 수준) |

### 인터랙션 원칙

- **조용히, 정확히** — 분석은 자명하게 보이고, 변화는 자명하게 드러난다
- **확인 ❌, 결과 ✅** — "정말 적용하시겠습니까?" 같은 확인 ❌
- **숫자가 권위** — 숫자는 항상 출처/근거 클릭 가능
- **호버에 디테일** — 기본 뷰는 미니멀, hover로 단계적 노출
- **단축키 우선** — 모든 액션은 키보드 가능. 마우스는 옵션

---

## IDE 화면 레이아웃

```
┌────────────────────────────────────────────────────────────────────┐
│ payments-api / src/payments/refund.ts          Risk 78  ●●●○○     │ ← Top Bar
├──────────┬─────────────────────────────────┬───────────────────────┤
│ Files    │ Editor                          │ Inspector             │
│          │                                 │                       │
│  src/    │  12  function processRefund() { │  Function             │
│  ▸ pay/3 │  13    const amount =           │  processRefund        │
│  ▸ auth/1│  14      req.body.amount        │  ───────────────      │
│   ord/   │  15    await db.update(amount)  │  Complexity     8.2   │
│   web/   │  16  }                          │  Tests          0/14  │
│  ▸ lib/  │                                 │  Callers        14    │
│          │                                 │  Blast radius   31    │
│          │                                 │  Taint paths    2     │
│          │                                 │                       │
│          │                                 │  Call graph           │
│          │                                 │  ┌────┐               │
│          │                                 │  │root│─┬──◯          │
│          │                                 │  └────┘ ├──◯          │
│          │                                 │         └──◯          │
│          │                                 │                       │
│          │                                 │  Data flow            │
│          │                                 │  req → parse → db     │
├──────────┴─────────────────────────────────┴───────────────────────┤
│ ⏱ 1m 23s   ●● 2 issues   Build: passed                            │ ← Status Bar
└────────────────────────────────────────────────────────────────────┘
```

**구성**
- **Top Bar** — 경로 / 시스템 risk score (12pt 텍스트, 농도 단계 dot)
- **Files** — 파일 트리. 위험 파일은 옆에 숫자만 (`pay/3` = 3 issues)
- **Editor** — 라인 번호 표시. 분석 오버레이는 본문과 동일 폰트, opacity 60%
- **Inspector** — 1급시민. 항상 표시. 라벨/값 정렬, 표 형태
- **Status Bar** — 세션 시간, 이슈 개수, 빌드 상태

---

## 각 경험별 화면

### 1. 파일 진입

파일을 열면 분석 결과가 **이미 있는 상태**로 보인다. 페이드인 연출 없음.

```
12  ┃ ▎ async function processRefund(userId: string) {
13  ┃ ▎   const amount = req.body.amount      taint source
14  ┃ ▎   await db.update({ amount })         14 callers
15  ┃ ┛ }                                     blast 31  ·  complexity 8.2
```

- 좌측 gutter 색띠 (`▎`) — 무채색 농도로 위험도 (없음/연/중/진)
- 라인 끝 인라인 텍스트 — 이모지 없이 단어. 폰트 크기 동일, opacity 0.55
- 함수 닫는 라인 — `blast 31 · complexity 8.2` 형식, 메타 정보 회색

호버 시 디테일:

```
┌─────────────────────────────────┐
│ amount                          │
│ Tainted (req.body.amount)       │
│ Sink: db.update at line 14      │
│ Sanitizer: none                 │
│ ──────                          │
│ Show flow ⌘.                    │
└─────────────────────────────────┘
```

→ 작은 텍스트, 단색 테두리, 그림자 최소.

---

### 2. 함수 클릭 — Inspector 갱신

함수 클릭 시 우측 Inspector가 **즉시** 갱신. 애니메이션 없음.

```
Inspector
─────────────────────────────
Function     processRefund
Defined      refund.ts:12
Lines        4
Complexity   8.2
Tests        0 / 14 callers
Blast        31 files

Callers (14)
  fee.ts:23     hot
  webhook.ts:45 hot
  retry.ts:8
  ledger.ts:67
  …  +10

Data flow
  req.body.amount
    → parse
    → build
    → db.update                  unsafe

Impact
  Files          31
  Tests          12  (4 uncovered)
  Taint paths    2
```

- 표 형태. 라벨/값 좌우 정렬
- "hot" / "unsafe" 같은 상태는 작은 회색 라벨, 색 ❌
- 클릭하면 그 위치로 점프 (밑줄 hover)

---

### 3. 코드 수정 — Live Impact

타이핑 → 300ms debounce → 분석 → Inspector의 숫자가 **즉시 교체**.
숫자 옆에 작은 델타 표시 (`31 → 37`).

```
Inspector
─────────────────────────────
Blast        31 → 37
Tests        14 → 12
Taint paths  2 → 3
Behavior     2 changed paths
```

- 델타는 회색. 빨강/초록 ❌
- 변경된 행만 좌측에 얇은 세로선 (`▏`) 1초 후 사라짐
- Top Bar의 risk score는 즉시 교체 (`78` → `84`), 색 변화 없음

코드 영역의 새 마커는 동일하게 인라인 텍스트로:

```
13  ┃ ▎   if (amount >= 0) {                  behavior change
```

---

### 4. Simulate Change

우클릭 → `Simulate change` (또는 `⌘⇧S`).
화면 우측에 패널이 슬라이드 인 (200ms). 분할 ❌ — 결과만 따로.

```
┌─ Simulate ──────────────────────────────┐
│ Diff                                    │
│   - if (amount > 0)                     │
│   + if (amount >= 0)                    │
│                                         │
│ Impact                                  │
│   Blast              31 → 37            │
│   Taint paths        2 → 3              │
│   Behavior changes   1                  │
│                                         │
│ Behavior delta                          │
│   amount === 0 now reaches db.update    │
│                                         │
│ New taint path                          │
│   req.body.amount → db.update           │
│                                         │
│ Test impact                             │
│   test_zero_amount     fail             │
│   test_negative        fail             │
│                                         │
│ Confidence    high                      │
│ ─────────────────────────────────────── │
│        Discard          Apply           │
└─────────────────────────────────────────┘
```

- 모든 정보가 한 카드. 스크롤 가능
- 강조는 텍스트 굵기로만 (`**Behavior delta**`)
- Confidence는 항상 표시 (high/medium/low)

---

### 5. Data Flow 보기

`Show flow ⌘.` 클릭 — 코드 영역 좌측에 **얇은 세로선**이 그어짐.
파티클 ❌, 흐르는 애니메이션 ❌.

```
12  ┃ ▎ │ async function processRefund() {
13  ┃ ▎ ╿   const amount = req.body.amount
14  ┃ ▎ │   const tx = build(amount)
15  ┃ ▎ ╿   await db.update(tx)
16  ┃ ┛ │ }
```

- 라인 13~15에 얇은 세로 trace line
- source/sink 노드는 `╿` 기호로
- 호버 시 connector 라벨: `flows from line 13 to line 15`

Inspector 패널의 Data flow 항목과 양방향 연동 — 패널에서 노드 호버 시 코드의 해당 라인이 강조.

---

### 6. 우클릭 메뉴

```
┌─────────────────────────────┐
│ Show call graph         ⌘G  │
│ Show data flow          ⌘.  │
│ Show blast radius       ⌘B  │
│ ─────────────────────────── │
│ Simulate change         ⌘⇧S │
│ Extract method          ⌘E  │
│ Suggest fix             ⌘F  │
│ ─────────────────────────── │
│ Find references         ⇧F12│
│ Open history            ⌘H  │
└─────────────────────────────┘
```

- 모노톤 메뉴. 아이콘 ❌
- 단축키는 우측 정렬, 회색
- 호버 시에만 행 배경 약간 진해짐

`Suggest fix` hover 시 — 별도 패널이 옆에 펼쳐짐 (Raycast 스타일):

```
┌──────────────────────────────┐
│ Suggested fix                │
│ ──────────────────────       │
│ Insert sanitizer at line 14  │
│                              │
│   const safe =               │
│     sanitizeAmount(amount)   │
│   await db.update({          │
│     amount: safe             │
│   })                         │
│                              │
│ Behavior        equivalent   │
│ Risk            -1 path      │
│                              │
│ Apply  ⏎     Dismiss  ⎋     │
└──────────────────────────────┘
```

---

### 7. Command Palette (⌘K)

```
┌─────────────────────────────────────────────┐
│ ⌘K                                          │
│ ─────────────────────────────────────────── │
│ Ask anything…                               │
│ ─────────────────────────────────────────── │
│ Recent                                      │
│   Why is processRefund risky                │
│   Show all taint paths                      │
│   Suggest safe refactor                     │
│                                             │
│ Actions                                     │
│   Open file…                       ⌘P       │
│   Run test…                        ⌘R       │
│   Time travel…                     ⌘T       │
└─────────────────────────────────────────────┘
```

질문 후 결과 — **카드 한 장**:

```
┌─────────────────────────────────────────────┐
│ Suggested refactor                          │
│ ─────────────────────────────────────────── │
│ Extract                                     │
│   validateAmount(raw): number               │
│   processTransaction(amount): Tx            │
│                                             │
│ Behavior verification    equivalent         │
│ Side effects             equivalent         │
│                                             │
│ Impact                                      │
│   Complexity      8.2 → 4.1                 │
│   Blast radius    31 → 18                   │
│                                             │
│ Preview                                     │
│   function validateAmount(raw) { … }        │
│   function processTransaction(a) { … }      │
│                                             │
│ ─────────────────────────────────────────── │
│ Show diff       Dismiss        Apply  ⏎    │
└─────────────────────────────────────────────┘
```

후속 질문 ❌ — 결과가 충분하면 한 카드로 끝낸다.

---

### 8. Time Travel

`⌘T` — 코드 영역 위에 timeline strip이 슬라이드 다운 (한 줄, 24px 높이).

```
┌──────────────────────────────────────────────────────────┐
│ ◀  6mo     3mo     1mo     2w     today  ▶    history   │
│    ·       ·       ▲       ·       ●                    │
│            blast 12  taint+1  blast 31                   │
└──────────────────────────────────────────────────────────┘
```

- 작은 점이 커밋. 위험 급증 커밋만 `▲` 마커
- 드래그하면 코드/Inspector 모두 그 시점으로 변함
- 호버 시 작은 툴팁: `1mo · 4a7f hotfix retry · blast 28`

선택 시 Inspector 하단에 diff 카드:

```
Compare    1 month ago → today

Blast            28 → 31  (+3)
Taint paths      1  → 2   (+1)

Commits          4a7f hotfix retry logic
                 5b8e add idempotency check

Risk inflection  4a7f introduced new taint path

Open commit
```

---

### 9. Top Bar Risk Score

```
payments-api / src/payments/refund.ts          Risk 78  ●●●○○
```

- `Risk 78` — 숫자만, 색 없음
- `●●●○○` — 5단계 농도 dot. 5/5가 risk 100
- 클릭 → drawer가 우측에서 슬라이드 (300px wide):

```
┌─ System risk ──────────────────┐
│                                │
│ Score          78              │
│ Threshold      80 (warning)    │
│                                │
│ Breakdown                      │
│   Taint paths        3         │
│   Unsafe writes      12        │
│   Dead code          847 LOC   │
│   Coverage gap       4 funcs   │
│   Arch violations    2         │
│                                │
│ Recent changes                 │
│   +6 from blast in refund.ts   │
│   +2 from new taint            │
│                                │
│ History                        │
│   ▁▂▂▃▃▅▆▆▇█    last 7 days   │
│                                │
└────────────────────────────────┘
```

- sparkline 한 줄로 추세
- 숫자만 보여주고 판단은 유저가

---

### 10. 분석 진행 / 에러 상태

**진행 중**
- Inspector의 해당 행에만 작은 spinner (`◐`) 좌측에 표시
- 본문은 그대로. 페이지 전체 로딩 ❌
- 부분 결과부터 채워짐 (call graph 먼저, taint 나중)

```
Blast        31
Taint paths  ◐ analyzing
Behavior     ◐ analyzing
```

**실패**
- 해당 행만 회색 처리 + 작은 텍스트 `failed · retry`
- 클릭 시 재시도. 다른 항목은 영향 없음

```
Taint paths  failed · retry
```

**연결 끊김**
- Status Bar 좌측에 작은 dot: `● disconnected`
- 자동 재연결. 복구되면 dot 사라짐
- 알림/팝업 ❌

---

### 11. 키보드 워크플로우

마우스 없이 다 된다. Linear 수준으로 키보드 우선.

| 키 | 동작 |
|----|------|
| `⌘P` | 파일 열기 |
| `⌘K` | Ask anything |
| `⌘.` | Show data flow |
| `⌘G` | Show call graph |
| `⌘B` | Show blast radius |
| `⌘⇧S` | Simulate change |
| `⌘F` | Suggest fix (커서 위치 기준) |
| `⌘E` | Extract method |
| `⌘T` | Time travel |
| `⌘H` | Open history |
| `⌘[` / `⌘]` | Navigate back/forward |
| `⇧F12` | Find references |
| `⏎` | 모든 액션의 기본 confirm |
| `⎋` | Dismiss / close |

---

## IDE UX 3-Layer 설계

> **정식 분류**: UX 설계·커뮤니케이션의 기준은 위「**IDE 경험 5가지 타입**」이다. 아래 3-Layer는 구현·온보딩 관점에서의 요약 매핑이다 (Layer 1 ≈ Ambient Awareness, Layer 2 ≈ Structural + Predictive, Layer 3 ≈ Decision + 일부 Feedback).

### Layer 1 — Ambient (항상 보이는 정보)

**목표**: 아무것도 안 해도 "이 IDE 다르다"를 3초 안에 납득

```typescript
// ⚡ complexity 8.2   💀 no tests   🔥 hotspot
async function processRefund(userId: string) {
  const amount = req.body.amount   // 🔴 taint source
  await db.update(...)             // ⚠️ 14 callers
} // 📍 blast radius: 31 files
```

| 위치 | 표시 |
|------|------|
| 함수 첫 줄 위 | complexity, test coverage, hotspot |
| 라인 끝 | taint marker, caller 수 |
| 함수 닫는 `}` | blast radius |
| import | bundle size, CVE |
| Gutter | 🔴 taint / 🟠 hotspot / 🟡 untested |

원칙: **읽게 하면 실패. 보이는 UI여야 함.**

---

### Layer 2 — Direct Manipulation (행동 기반 반응)

**A. Selection (클릭)**
```
함수 클릭 → 100~200ms 안에:
  - 우측 패널: Call Graph 열림
  - 상단: "31 files affected · 128 calls · 2 taint paths"
  - 코드: 호출자 라인 highlight + taint 연결선
```

**B. Edit (타이핑)**
```
수정 시작 → debounce 300~800ms → "Analyzing changes..."
0.5~1.5s → ⚠️  Impact updated
            blast radius: 31 → 37
            taint path: +1
            behavior change: 2 paths
```
→ "내가 친 코드 때문에 시스템 구조가 바뀌고 있다" — **이게 핵심 경험**

**C. 우클릭 → 원클릭 해결**

| 상황 | 원클릭 |
|------|------|
| taint 소스 | sanitizer 삽입 |
| dead code | cascade 미리보기 → 전체 제거 |
| 복잡도 높은 함수 | extract 포인트 자동 제안 |
| CVE 경고 | 안전 버전 업그레이드 |
| 리소스 미닫힘 | close() 삽입 위치 제안 |

---

### Layer 3 — Prompt / Intent

**대화 ❌, 결과 카드 ✅**

진입점:
- Command Palette (⌘K)
- 우클릭 → AI 액션
- Inline `// 💬 Ask`

**4가지 프롬프트 타입**

| 타입 | 입력 예시 | 출력 |
|------|---------|------|
| **Explain** | "왜 이 함수 위험해?" | 근거 카드 + jump links |
| **Simulate** | "이 조건 >=로 바꾸면?" | 미래 결과 카드 |
| **Refactor** | "안전하게 분리해줘" | 검증된 리팩토링 + behavior diff |
| **Investigate** | "이 값 어디서 왔지?" | 데이터플로우 경로 |

---

## 인터랙션 철학

### 핵심 패러다임

```
기존 IDE:  "코드를 써라 → 가끔 힌트를 줄게"
p0 IDE:   "분석이 주인공 → 코드는 분석 결과를 확정하는 수단"
```

- **손코딩은 2급시민** — 타이핑은 "값 입력", "이름 확정" 수준
- **타이핑 중 제공되는 정보는 1급시민** — 치는 순간마다 분석이 반응
- **딸깍으로 다 해결** — 분석이 제안하면 클릭 한 번으로 확정

### 조용히 vs 크게

| 조용히 (항상성) | 크게 (변화) |
|----------------|------------|
| 복잡도 | blast radius 증가 |
| 테스트 유무 | 새 taint path 생성 |
| hotspot | behavior change |
| import risk | resource leak |

→ **상태는 잔잔하게, 변화는 dramatize**

### 행동 루프

```
위험 발견 → Inspector에 수치 표시 → [Fix safely] 클릭
  → 수정 적용 → Risk Score 즉시 갱신 (숫자만 교체)
    → "또 뭐 있나?" → 다른 위험 클릭 → 반복
```

- 위험 증가: 숫자 변화 + 농도 진해짐 (flash/bounce ❌)
- 위험 해소: 숫자 감소 + 농도 연해짐 (칭찬 텍스트/카운팅 ❌)
- 보상은 숫자가 내려가는 것 자체. 연출이 아니라 결과로 보상

---

## 실사용 워크플로우

> **이 제품은 데모 플랫폼이 아니다. 개발자가 매일 켜놓고 쓰는 실사용 IDE 앱이다.**
> 아래는 첫인상이 아니라 100일째에도 반복되는 실제 워크플로우다.

### 기본 워크플로우

```
IDE 실행 → 자기 레포 열림 → 코드에 분석 오버레이 즉시 표시
                       ↓
              편집 / 분석 확인 / 에이전트 실행 / 리팩토링
                       ↓
              PR 생성 → behavior diff / 리뷰어 자동 추천
```

### 일상 시나리오 6단계

```
1. IDE 열림 → 코드에 뱃지/마커 가득        → 위험 영역 즉시 인지
2. 함수 클릭 → 콜 그래프 + blast 31        → 구조 파악
3. 조건문 한 줄 수정 → blast 31→37          → 영향 범위 실시간 확인
4. CVE import 클릭 → "Fix safely" 원클릭    → 안전한 수정
5. 타임머신으로 지난주 → 분석도 그 시점     → "언제부터 위험해졌나" 추적
6. PR 생성 → behavior diff + 리뷰어 추천   → 리뷰 프로세스 완결
```

### 기존 도구 대비 일상 체감 차이

| 기존 워크플로우 | 이 제품의 워크플로우 |
|---------------|-------------------|
| 코드 수정 → 테스트 돌려야 영향 확인 | 타이핑 중 blast radius 즉시 갱신 |
| PR 리뷰에서 감으로 판단 | 숫자 + 증거 기반 판단 |
| AI 생성 코드를 직접 검증 | Agent Gate가 SE 지표로 자동 검증 |
| 아키텍처 위반을 나중에 발견 | 코드 작성 시점에 즉시 경고 |

---

## 아키텍처

### 파일 브리지

```
Monaco (브라우저) ←WebSocket→ 파일브리지 서버 ←→ git worktree
                                    ↕
                          incremental analyzer
                                    ↕
                       베이스 인덱스 + 세션 델타
```

- 파일 read / write / watch 3개만 구현하면 Monaco 입장에서 로컬과 동일
- 타이핑 debounce(300ms)마다 델타 분석 트리거

### 세션 격리

```
main (read-only)
  └── /workspaces/
        ├── session-abc123/   ← git worktree
        ├── session-def456/   ← git worktree
        └── session-ghi789/   ← git worktree
```

### 정적 분석 인덱스

```
베이스 인덱스 (main 기준, 공유) - 1개
  └── 세션 델타 인덱스 (변경 파일만) - 세션당 1개
```

- incremental 분석으로 세션별 메모리 부담 최소화
- 스냅샷 커밋 시 델타 인덱스 직렬화 → 타임머신 복원 시 함께 복원

### 세션 생명주기

```
진입 → worktree 생성 + 델타 인덱스 초기화
  → 작업 (편집/빌드/분석)
    → 주기적 스냅샷 커밋
      → 세션 만료
        → 스냅샷 저장 → worktree 제거 → 다음 대기자 입장
```

---

## B2B 가격 전략

```
Free Tier:    Ambient 분석 (Layer 1) + 제한된 세션
Pro:          Full IDE + Prompt + 타임머신
Enterprise:   위 + Architecture Guardrails + Incident DNA
                + SSO + Audit log + SLA
```

### 페르소나별 Selling Point

| 기능 | 타겟 | Selling Point |
|------|------|--------------|
| Blast Radius | Developer | "이거 바꾸면 뭐 터지는지 알려준다" |
| Simulate Change | Developer / Lead | "수정 전에 미래를 본다" |
| Architecture Guardrails | Architect / Lead | "팀이 커져도 설계가 무너지지 않는다" |
| Debt Monetization | CTO / CFO | "기술 부채의 실제 손실액을 본다" |
| Incident DNA | SRE / Lead | "과거 장애를 두 번 만들지 않는다" |
| Semantic PR | Manager | "리뷰 프로세스가 3배 빨라진다" |

---

## 약점과 해결 방향

### 약점 1: 기능이 너무 많아서 핵심이 묻힘

좋은 아이디어가 너무 많아 "제일 센 한 방"이 희석될 위험.

**해결**: 메시징을 한 줄로 압축
> **"코드 한 줄 바꾸면 시스템 전체 영향이 눈앞에서 바뀌는 IDE"**

P0 3개에 모든 제품/엔지니어링 자원을 집중. 나머지는 Pro/Enterprise tier에서 발견하게.

### 약점 2: "좋아 보이지만 본질 아닌 것들"

관중 반응, 소셜 에너지, leaderboard, LLM 비교 UI — 재밌지만 **불꽃**이지 **엔진**은 아님.

진짜 강한 4축:
1. **Impact visibility** — 영향 범위 가시화
2. **Semantic understanding** — 의미 단위 코드 이해
3. **Safe change** — 안전한 수정 보장
4. **System-level visibility** — 시스템 전체 조감

이 4축 외 기능은 전부 P2 이하.

---

## 최종 실행 판단

```
이 3개만 완벽하면 시장에서 독보적:
  1. Blast Radius
  2. Simulate Change
  3. Taint Flow

이 2개만 완벽히 만들면 그냥 시장 먹는다:
  1. Blast Radius   — "이거 바꾸면 어디까지 터지냐"
  2. Simulate Change — "바꾸기 전에 결과 보여줌"
```

**한 줄 정리:**

> **"이거 바꾸면 뭐 터지냐 + 바꾸기 전에 결과 보여줌"**

---

## 미결 사항

- [ ] 동시 세션 cap 수치 (서버 스펙 확인 후)
- [ ] 세션 타이머 시간
- [ ] 스냅샷 델타 인덱스 직렬화 포맷
- [ ] 빌드 큐 최대 대기 수 / 타임아웃 정책
- [ ] Blast radius 애니메이션 프레임레이트 / 성능 최적화
- [ ] Simulate Change 정확도 측정 방식 (false positive 임계값)
- [ ] Incident DNA 패턴 매칭 모델 설계
- [ ] Semantic PR 출력 포맷 (markdown 템플릿 표준화)
- [ ] Architecture Guardrails 규칙 DSL 설계
- [ ] Confidence score 계산 방식
- [ ] Severity 기준 (Critical / Warning / Info 경계)
- [ ] Keyboard shortcut 충돌 방지 (Monaco 단축키)
