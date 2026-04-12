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

AI 코딩이 mainstream이 됐다. AI가 코드를 찍어낸다. 문제는 사람이 아니라 **LLM이 레포 구조를 이해 못 하고 생성한다**는 것이다. 레포가 커질수록 중복 코드, 아키텍처 붕괴, 일관성 없는 패턴이 쌓인다. 그 결과 LLM도, 사람도 신뢰할 수 없는 코드베이스가 된다.

신뢰가 없는 진짜 이유는 두 가지다:

1. **구조를 모른다** — LLM은 컨텍스트 창 안의 코드만 본다. 레포 전체의 의존 관계, 중복 패턴, 아키텍처 경계를 인식하지 못한다.
2. **강제하지 않는다** — 팀이 설계 원칙을 문서로 정해도, 코드 레벨에서 강제되지 않으면 LLM이 어기고 사람도 어긴다.

기존 도구가 이걸 못 풀었던 이유:
- **SonarQube/CodeClimate**: 배치 분석. "경고 183개" 리포트를 주지만 코드 작성 시점에는 개입 불가. 경고 → 액션 연결 없음.
- **ESLint/Semgrep**: 파일 단위 규칙. 크로스-파일 의존성, blast radius, behavior diff 계산 못함.
- **Copilot/Cursor**: 코드 생성만. 생성 결과가 레포 구조와 맞는지 검증하는 건 사람 몫.

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

> capability: `cost_analysis`, `change_impact_analysis`, `taint_flow`, `dead_code`, `find_references`

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

> capability: `call_graph`, `dataflow`, `taint_flow`, `function_summary`, `import_graph`

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

> capability: `behavior_diff`, `change_impact_analysis`, `effect_analysis`, `symbolic_execution`, `abstract_interpret`

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

> capability: `change_impact_analysis`, `behavior_diff`, `taint_flow`, `proof_platform`

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

> capability: `behavior_diff`, `git_history`, `incremental_analysis`, `proof_platform`, `explain`

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
| **다크 모드** | 기본. 라이트는 옵션. 배경 `#0d1117` 계열 (GitHub Dark 참조) |
| **접근성** | 위험도는 색+농도+텍스트 삼중 표현. 색각 이상자도 텍스트/농도로 판단 가능 |

### 인터랙션 원칙

- **조용히, 정확히** — 분석은 자명하게 보이고, 변화는 자명하게 드러난다
- **확인 ❌, 결과 ✅** — "정말 적용하시겠습니까?" 같은 확인 ❌
- **숫자가 권위** — 숫자는 항상 출처/근거 클릭 가능
- **호버에 디테일** — 기본 뷰는 미니멀, hover로 단계적 노출
- **단축키 우선** — 모든 액션은 키보드 가능. 마우스는 옵션

### 응답성 기준 (SOTA 최소 요건)

매일 8시간 쓰는 도구에서 200ms 이상 걸리면 "느리다"고 느낀다. 아래가 체감 기준.

| 인터랙션 | 목표 | 초과 시 처리 |
|----------|------|------------|
| 파일 열기 → Ambient 오버레이 표시 | < 100ms (캐시 히트) / < 500ms (콜드) | 스켈레톤 없음. 기존 텍스트 먼저, 분석 도착 시 즉시 오버레이 |
| 함수 클릭 → Inspector 갱신 | < 150ms | Inspector 기존 값 유지, 새 값으로 교체 (깜빡임 ❌) |
| 타이핑 → Live Impact 갱신 | debounce 300ms + 분석 < 1s | `◐` spinner를 해당 행에만. 부분 결과부터 채움 |
| Simulate Change 결과 | < 2s | 패널 프레임 즉시 표시 + 내용은 스트리밍 |
| ⌘K 결과 카드 | < 3s | "Thinking..." 텍스트 한 줄. 프로그레스 바 ❌ |
| Hover 툴팁 | < 50ms (렌더) | 사전 계산된 데이터. hover 시점에 API 호출 ❌ |

**원칙**: 분석이 오래 걸릴 때 UI를 멈추지 않는다. 부분 결과부터 채우고, 느린 항목만 `◐`로 표시. 전체 로딩 화면 ❌.

### 정보 노출 3단계 (Progressive Disclosure)

개발자의 주의력은 유한하다. 정보를 한 번에 다 보여주면 아무것도 안 읽는다.

```
Level 0 — Glance (시선만으로)
  gutter 색띠 + 라인 끝 숫자
  → "이 함수 위험한가?" 0.5초 판단

Level 1 — Hover (마우스 올리기)
  taint source/sink, callers, 경로 요약
  → "왜 위험한가?" 2초 판단

Level 2 — Click (명시적 의도)
  Inspector 전체 갱신, L4 패널, Simulate
  → "어떻게 고치나?" 깊은 탐색
```

| Level | 정보량 | 개입도 | 사라지는 조건 |
|-------|--------|--------|-------------|
| 0 | 숫자 1~2개, 색띠 | 없음 (항상 보임) | 파일 닫을 때 |
| 1 | 3~5줄 요약 | hover 유지 | 마우스 벗어남 |
| 2 | 전체 분석 | 클릭 | 닫기 버튼 / Esc |

**핵심**: Level 0에서 이미 "위험/안전"이 판단 가능해야 한다. Level 1~2는 "왜/어떻게"를 위한 것이지, 판단을 위한 게 아니다.

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
- **Files** — 파일 트리. 위험 파일은 옆에 숫자만 (`pay/3` = 3 issues). 디렉토리 접혀도 하위 합계 표시
- **Editor** — 라인 번호 표시. 분석 오버레이는 본문과 동일 폰트, opacity 60%
- **Inspector** — 1급시민. 항상 표시. 커서 위치에 따라 컨텍스트 전환 (함수/import/클래스/파일)
- **Status Bar** — 이슈 개수, 분석 상태, 빌드 상태

**Files 패널 상세**
```
  src/
  ▸ payments/  ●● 7        ← 디렉토리 내 총 이슈 수
    refund.ts  ● 3          ← taint 2 + arch violation 1
    webhook.ts ● 2
  ▸ auth/      ● 2
  ▸ core/                   ← 이슈 없으면 숫자 없음
```
- 숫자는 severity 순 집계. dead code만이면 dim
- 파일명 hover → 미니 요약: `taint 2 · arch 1 · blast 31`

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

**Gutter 레이어 통합 (좌측 → 우측 순서)**

```
라인번호 │ 농도띠 │ 상태아이콘 │ taint선 │  코드 본문  │  인라인 힌트
  12         ▎        ⚡          │       const a =       taint source
  13         ▎                    │       const b =
  14         ▎▎       ⛔          ╿       db.update()     14 callers
  15                                    }                  blast 31
```

| Gutter 요소 | 의미 | 우선순위 (겹칠 때) |
|-------------|------|------------------|
| 농도띠 `▎` | 위험도 수준 (4단계) | 항상 표시 |
| 상태아이콘 | ⚡ taint / ⛔ violation / ⚠ warning / 💀 typestate | 한 줄에 최대 1개 (가장 높은 severity) |
| taint 세로선 `│` | dataflow 경로 | Show flow 활성 시만 |
| 인라인 힌트 | blast, callers, taint source 등 | 항상 표시. 한 줄에 최대 2개 항목 |

**겹침 규칙**: 한 라인에 taint source + arch violation + high complexity가 동시에 걸릴 수 있다. gutter 아이콘은 severity 순 (⛔ > ⚡ > ⚠), 인라인 힌트는 2개까지. hover 시 전체 목록.

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

**Inspector 컨텍스트 모드**

Inspector는 커서 위치에 따라 컨텍스트가 바뀐다. 함수 안이면 함수 분석, import 위면 모듈 분석.

| 커서 위치 | Inspector 표시 |
|----------|---------------|
| 함수 본문 | 함수 분석 (complexity, blast, callers, taint, dataflow) |
| import 문 | 모듈 분석 (bundle size, CVE, import count, 순환 의존) |
| 클래스 선언 | 클래스 분석 (메서드 수, inheritance depth, 총 blast) |
| 파일 루트 | 파일 분석 (총 함수 수, 평균 complexity, 오너십, arch 위반) |

전환은 즉시 (< 150ms). 애니메이션 ❌, 기존 값 → 새 값 교체.

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

⌘K에 질문을 치면 현재 커서 위치의 **분석 컨텍스트가 자동 주입**된다. 개발자가 "이 함수"를 설명할 필요 없음 — 엔진이 이미 알고 있다.

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

**7가지 프롬프트 타입**

| 타입 | 입력 예시 | 출력 | 엔진 |
|------|---------|------|------|
| **Explain** | "왜 이 함수 위험해?" | 근거 카드 + jump links | `explain`, `function_summary` |
| **Simulate** | "이 조건 >=로 바꾸면?" | 실행 경로 변화 + impact delta | `behavior_diff`, `abstract_interpret` |
| **Refactor** | "안전하게 분리해줘" | 검증된 리팩토링 + behavior equivalence | `effect_analysis`, `behavior_diff` |
| **Investigate** | "이 값 어디서 왔지?" | 데이터플로우 경로 | `dataflow`, `taint_flow` |
| **Audit** | "이 모듈 아키텍처 맞아?" | arch 위반 목록 + drift 추세 | `import_graph`, `spec_mining` |
| **Clean** | "dead code 있어?" | cascade 제거 후보 트리 | `dead_code`, `call_graph` |
| **History** | "이 함수 언제부터 위험해졌어?" | risk timeline + 원인 커밋 | `git_history`, `incremental_analysis` |

모든 타입은 결과가 **카드 한 장**으로 나온다. 채팅 쓰레드 ❌, 후속 질문 ❌ — 충분하면 한 카드로 끝.

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

### 조용히 vs 크게 — 에스컬레이션 규칙

| 상태 | Level 0 (항상) | Level 1 (hover) | Level 2 (배너/패널) |
|------|---------------|-----------------|-------------------|
| 복잡도 | 인라인 숫자 dim | hover에 Big-O + 경로 수 | CPX > team_budget 시 L3 배너 |
| 테스트 유무 | 인라인 `0/14` dim | hover에 uncovered 목록 | coverage 0% + callers > 10 시 배너 |
| hotspot | gutter 농도 | hover에 최근 변경 빈도 | — (조용히만) |
| blast radius | 인라인 숫자 | hover에 영향 파일 요약 | blast > threshold 시 L3 배너 |
| taint path | gutter ⚡ | hover에 경로 + sanitizer 유무 | **신규** taint 생성 시 L3 배너 |
| behavior change | 인라인 `behavior change` | hover에 변화 상세 | 동작 변경 감지 시 L3 배너 |
| arch violation | gutter ⛔ | hover에 규칙 + 수정 경로 | 위반 발생 즉시 L1 (팀 정책으로 L3 격상 가능) |
| typestate | gutter 💀 | hover에 상태 전이 | 위반 발생 즉시 L1 |
| resource leak | gutter ⚠ | hover에 미닫힘 경로 | — (조용히만) |

**핵심 원칙**: 상태(이미 있는 것)는 Level 0에서 조용히. **변화(방금 생긴 것)**만 Level 2로 올린다. 기존에 있던 taint path는 조용히, 지금 내 수정으로 생긴 taint path는 배너.

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

**왜 경쟁자가 따라하기 어려운가:**
- 위 기능이 정확하려면 call graph + dataflow + taint flow + behavior diff가 레포 전체에서 실시간 동작해야 함
- 이 엔진은 수년 단위 투자. 327개 capability가 이미 wired 상태 — 이게 기술 해자
- Copilot/Cursor는 LLM 기반이라 구조적으로 이 방향 진입 불가 (결정론적 분석이 아님)
- SonarQube는 배치 분석이라 "타이핑 중 실시간 반응"으로 전환하려면 아키텍처 재설계 필요

**한 줄 정리:**

> **"이거 바꾸면 뭐 터지냐 + 바꾸기 전에 결과 보여줌"**

---

## 미결 사항

### 제품 결정 (P0 — 기능 방향에 직결)

- [ ] Simulate Change 정확도 측정 방식 (false positive 임계값)
- [ ] Architecture Guardrails 규칙 DSL 설계
- [ ] Confidence score 계산 방식
- [ ] Severity 기준 (Critical / Warning / Info 경계)
- [ ] Incident DNA 패턴 매칭 모델 설계

### 엔지니어링 결정 (P1 — 구현 시 결정)

- [ ] Keyboard shortcut 충돌 방지 (에디터 단축키)
- [ ] Blast radius 수치 갱신 성능 최적화
- [ ] Semantic PR 출력 포맷 (markdown 템플릿 표준화)

### 인프라 결정 (P2 — 스케일 시 결정)

- [ ] 동시 세션 cap 수치 (서버 스펙 확인 후)
- [ ] 세션 타이머 시간
- [ ] 스냅샷 델타 인덱스 직렬화 포맷
- [ ] 빌드 큐 최대 대기 수 / 타임아웃 정책

---

## 왜 SOTA인가 — UX 기준

기존 정적 분석 도구는 두 가지 중 하나에 갇혀 있다:
1. **리포트형**: 분석 결과를 별도 대시보드에 보여줌. 코드와 분리돼서 개발자가 안 봄 (SonarQube, CodeClimate)
2. **경고형**: 에디터에 밑줄 + 사이드바 경고. 숫자만 쌓이고 액션으로 안 이어짐 (ESLint, Semgrep)

이 제품이 SOTA인 이유:

| 축 | 기존 SOTA | 이 제품 |
|----|---------|--------|
| **정보 위치** | 별도 대시보드 / 사이드바 | 코드 라인 위 오버레이. 시선 이동 ❌ |
| **정보 시점** | 배치 (CI 후) / 저장 후 | **타이핑 중** 실시간 (debounce 300ms) |
| **정보 깊이** | 경고 1단계 | 3단계 progressive disclosure (glance → hover → click) |
| **정보 → 액션** | 경고 읽고 직접 수정 | 경고 → [Fix safely] 원클릭 → 에이전트가 수정 → Gate 검증 → 적용 |
| **분석 범위** | 파일 단위 | 레포 전체 (cross-file call graph, dataflow, taint) |
| **분석 컨텍스트** | 사람이 설명해야 함 | 커서 위치 기준 자동 수집 → 에이전트에 주입 |
| **팀 규칙** | lint 규칙 (문법) | 아키텍처 레이어 규칙 + 암묵적 패턴 자동 추출 (spec mining) |
| **변경 예측** | 없음 | Simulate Change — 실행 없이 결과 미리보기 |
| **신뢰 근거** | "경고입니다" | 숫자 + 경로 + behavior equivalence proof |

**한 문장**: 정적 분석의 결과를 코드 위에 살아있는 오버레이로 띄우고, 변경하면 숫자가 즉시 바뀌고, 원클릭으로 안전하게 고치고, 팀 아키텍처를 자동으로 강제한다 — 이 조합을 실시간으로 하는 도구는 없다.

---

## IntelliJ 킬러 기능 흡수 — 엔진 기반 재해석

IntelliJ가 가진 모든 킬러 기능을 흡수하되, "파일 단위 구문 분석"이 아니라 **"레포 전체 의미론적 분석"** 위에서 재구상한다. 우리 엔진이 있기 때문에 IntelliJ보다 더 깊이 갈 수 있다.

### 흡수 대상 — 리팩토링

| IntelliJ 기능 | 우리의 재해석 | 왜 더 강한가 | 엔진 |
|-------------|-------------|-----------|------|
| **Extract Method** | 코드 선택 없이 함수 내 추출 포인트 자동 제안. 복잡도 + 응집도 기반 | IntelliJ는 선택해야 함. 우리는 "어디를 자르면 좋을지"를 엔진이 안다 | `cost_analysis`, `effect_analysis`, `dataflow` |
| **Extract Variable/Constant/Parameter** | 매직 넘버/문자열 반복 사용을 상시 탐지. 인라인 힌트로 "이 리터럴 N곳에서 동일" 표시 | 배경 분석 상시 실행. 찾지 않아도 보인다 | `clone_detection`, `find_references` |
| **Change Signature** | 시그니처 변경 전 impact map — "N개 파일, M개 호출 사이���, 자동 수정 불가 K곳" 시각화 | blast radius + behavior diff로 변경의 안전성까지 검증 | `change_impact_analysis`, `behavior_diff`, `call_graph` |
| **Safe Delete** | 삭제 시 Dead Code Cascade로 연쇄 orphan 자동 탐지. "함께 삭제해도 안전한 N개" 제안 | "삭제해도 되냐" + "같이 삭제할 수 있는 것"까지 | `dead_code`, `call_graph`, `effect_analysis` |
| **Move** | 이동 전 순환 의존성 분석 + Architecture Guardrails 위반 검사. "이 모듈을 여기로 옮기면 순환 참조 해소" | 아키텍처 규칙을 알고 있는 상태에서 이동 | `import_graph`, `module_dependency`, `arch_rules` |
| **Rename** | 타이핑 중 실시간 충돌 검사. "이 이름은 외부 스코프 변수�� 가린다(shadow)" 즉시 경고 | rename이 끝난 뒤가 아니라 치는 중에 | `symbol_resolution`, `find_references` |
| **Inline** | 인라인이 안전한지 사전 검증. 부작용 여부 + 평가 횟수 변화 + behavior equivalence | effect_analysis로 "이거 인라인해도 동작 같냐" 증명 | `effect_analysis`, `behavior_diff` |

### 흡수 대상 — 정적 분석 / 코드 이해

| IntelliJ 기능 | 우리의 재해석 | 엔진 |
|-------------|-------------|------|
| **Dataflow to/from Here** | 항상 켜져 있음. 변수 hover → "이 시점에서 가능한 값 범위" 인라인 표시. 크로스-파일 | `dataflow`, `abstract_interpret`, `def_use_facts` |
| **Nullability Inference** | TS에서도 strict null 무관하게 런타임 가드 누락 탐지. "유령 타입 어노테이션" 인라인 | `abstract_interpret`, `dataflow` |
| **Constant Condition** | 항상 true/false 조건의 코드 블록을 시각적으로 fade-out. "왜 항상 true인지" 클릭 → 추론 경로 | `abstract_interpret`, `control_flow` |
| **Unreachable Code** | dead code + 도달 불가능 코드를 분리. 전자는 safe delete, 후자는 로직 오류 경고 | `dead_code`, `control_flow` |
| **Type Migration** | "이 타입을 바꾸면 N개 파일 영향" 프리뷰. API 경계 변경은 "breaking change" 레이블 | `change_impact_analysis`, `find_references` |
| **Dependency Matrix** | 실시간 업데이트 + Architecture Guardrails 연동. "이 모듈 이동하면 순환 참조 해소" | `import_graph`, `module_dependency` |
| **Find Usages (유형별 그룹핑)** | read/write/override 분류 + **타임라인 뷰** (이 심볼의 사용처가 시간에 따라 어떻게 변했는지) | `find_references`, `git_history` |
| **Structural Search & Replace** | AST 패턴 매칭을 ⌘K로. "async 함수에서 await 없이 Promise 반환하는 곳" → 자연어 → 쿼리 변환 | `structural_code_search`, `explain` |
| **Call Hierarchy** | 인터랙티브 그래프 + 비동기 체인 추적 (Promise, callback, event) | `call_graph`, `dataflow` |
| **Parameter Info** | 파라미터별 "이 위치에 호환 가능한 변수" 자동 제안 + "다른 곳에서 주로 전달한 값 패턴" | `find_references`, `dataflow` |
| **Expression Type Info** | 복잡한 제네릭/조건부 타입을 "전개(expand)"하여 최종 타입 표시. 타입 추론 단계별 설명 | `symbol_resolution`, `explain` |
| **Language Injections** | SQL 문자열의 컬럼명이 실제 스키마��� 일치하는지 크로스 검증. GraphQL 쿼리 스키마 검증 | `structural_code_search`, `spec_verification` |

### 흡수 대상 — 편집 / VCS

| IntelliJ 기능 | 우리의 재해석 | 엔진 |
|-------------|-------------|------|
| **Postfix Completion** | 표현식 타입에 따라 동적 후위 템플릿. `Promise` → `.await`, `.then`. `Observable` → `.pipe` | `symbol_resolution` |
| **Smart Completion** | 타입 + 의미론적 적합성. "같은 string이어도 이메일/URL/이름을 구분" | `dataflow`, `function_summary` |
| **Annotate/Blame** | blame + 검사 결합. "이 경고는 3개월 전 이 커밋에서 도입" 즉시 표시. 핫스팟 분석 | `git_history`, `incremental_analysis` |
| **Changelists** | 변경 파일의 의미론적 연관성 자동 분류. "이 3개는 같은 기능, 이 1개는 별개 버그" | `change_impact_analysis`, `import_graph` |
| **Partial Commit** | 청크 커밋 시 "이 청크만 커밋하면 빌드 깨지는지" 사전 분석. 의존적 ���크 자동 묶기 | `change_impact_analysis`, `behavior_diff` |
| **Local History** | 각 시점의 "테스트 통과 여부 + 타입 ��러 수 + blast radius" 함께 기록. "마지막 통과 시점" 원클릭 복원 | `incremental_analysis`, `git_history` |
| **Inline Debug Values** | 디버그 없이 정적 추론 값을 인라인 표시. "유령 값"으로 상수 전파/범위 분석 결과 표시 | `abstract_interpret`, `dataflow` |

---

## SOTA++ UX 패턴 — 데이터 기반

### 1. Risk-aware Minimap (VS Code + Datadog)

에디터 미니맵에 risk 히트맵 오버레이. 고위험 함수 = 빨강, 저위험 = 초록. taint flow 경로 = 노란 점선. 파일의 전체 리스크 프로파일을 한눈에 조감.

```
  미니맵 영역
  ┌────┐
  │▓▓▓▓│  ← 고위험 함수 (risk 78)
  │░░░░│
  │░░░░│
  │▓▓░░│  ← taint path 통과
  │░░░░│
  │▓▓▓▓│  ← blast radius 31
  │░░░░│
  └────┘
```

**근거**: Tufte의 sparkline 원칙 — 데이터-잉크 ���율 극대화. 160ms 이내 추세 파악 (pre-attentive processing).

> capability: `change_impact_analysis`, `taint_flow`, `cost_analysis`

### 2. Inspector Sparklines (Datadog)

Inspector의 각 메트릭 옆에 7-commit 스파크���인. 정적 숫자 대신 추세.

```
Inspector
─────────────────────────────
Blast        31  ▁▂▃▅▇       ← 증가 추세
Complexity   8.2 ▇▆▅▃▁       ← 개선 추세
Taint paths  2   ▁▁▁▁▂       ← 최근 증가
Tests        0/14 ───────     ← 변화 없음
```

**근거**: 숫자 하나만 보면 "이게 나쁜 건가?" 판단이 안 된다. 추세를 함께 보여주면 즉시 판단 가능. Change Blindness 방지 — 이상치가 시각적 주의를 끈다.

> capability: `incremental_analysis`, `git_history`

### 3. Anomaly Band (Datadog)

blast radius의 "정상 범위"를 밴드로 표시. 이 함수의 역대 평균 blast = 15인데 현재 31이면 밴드 이탈.

```
Inspector — Blast Radius
─────────────────────────────
    ┌────────────────────┐
 35 │            ●       │  현재
    │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │  ← 정상 상한 (20)
 20 │  ░░░░░░░░░░░░░░░░░ │  ← 정상 밴드
    │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │  ← 정상 하한 (10)
 10 │                    │
    └────────────────────┘
```

**근거**: 절대값(31)보다 "정상 대비 편차"(+11, 밴드 초과)가 판단에 유용. Kahneman의 reference point 이론.

> capability: `incremental_analysis`, `git_history`, `change_impact_analysis`

### 4. Contextual Command Palette + Rich Preview (Raycast + Linear)

⌘K 검색 결과 선택 시 우측에 리치 프리뷰 — 해당 심볼의 blast radius 그래프 + risk score + taint paths.

```
┌──────────────────────────────────────────────────────────────┐
│ ⌘K  processRef_                                              │
│ ─────────────────────────────────────────────────────────── │
│                                    │ Preview                 │
│  processRefund     refund.ts:12   │ ────────────            │
│  processReturn     return.ts:8    │ Risk        78          │
│  processReceipt    receipt.ts:3   │ Blast       31 ▁▃▅▇    │
│                                    │ Taint       2 paths     │
│                                    │ Complexity  8.2 O(n·m)  │
│                                    │                         │
│                                    │ 12 function process..   │
│                                    │ 13   const amount =..   │
│ ─────────────────────────────────────────────────────────── │
│  ⏎ Go to   ⌘S Simulate   ⌘I Impact   ⌘B Blast              │
└──────────────────────────────────────────────────────────────┘
```

하단 Action Bar: 선택된 심볼에 대한 상황별 액션. 키보드만으로 완결.

**근거**: Recognition > Recall (Nielsen). 열어보지 않고도 인식. 100ms 이내 결과 표시 → "즉각 반응" 인지 (Nielsen response time 연구).

> capability: `function_summary`, `change_impact_analysis`, `cost_analysis`

### 5. Inline Impact Ghost Layer (Copilot + Figma)

코드 수정 시 변경 라인 옆에 실시간 ghost annotation으로 blast delta, 깨지는 테스트 수 표시.

```
13  ┃ ▎   if (amount >= 0) {          blast +6 · tests -2 · taint +1
```

- ghost text와 동일한 opacity (0.4). 수락/거절 대상이 아니라 인지 보조
- 수정이 없는 라인에는 ��시 ❌ — 변화가 생긴 라인에만
- AI 제안(ghost text) 옆에 impact ghost가 나란히 표시 가능

**근거**: Ghost text의 수락률은 ~26% (GitHub 2023). 나머지 74%는 무시. 낮은 인지 비용이 핵심 — impact ghost도 같은 원칙. "보면 좋고, 안 봐도 흐름 안 끊김".

> capability: `change_impact_analysis`, `behavior_diff`, `taint_flow`

### 6. Investigation Spaces (Arc Browser)

작업 컨텍스트별 독립 탭 세트. `⌘1/2/3`으로 전환.

| Space | 열린 탭 | Inspector 모드 |
|-------|--------|-------------|
| **PR Review** | 변경 파일들 + semantic PR | behavior diff 중심 |
| **Incident Response** | 장애 관련 파일 + taint flow | taint + time travel 중심 |
| **Refactoring** | 대상 파일 + simulate change | blast + effect 중심 |
| **Architecture Audit** | 모듈 경계 파일들 + arch health | dependency + drift 중심 |

**근거**: Context switching cost = 200-500ms 인지 비용 (Monsell, 2003). Space로 물리적 분리하면 전환 비용 최소.

### 7. Evidence Inspector — 증명 재생 (Proof Platform 활용)

모든 경고를 클릭하면 "왜 이 경고가 나왔는지" 증거를 단계별 재생.

```
┌─ Evidence ────────────────────────────────────────┐
│ Taint Path: req.body.amount → db.update           │
│ ──────────────────────────────────────────────── │
│                                                    │
│ Step 1/4  req.body.amount        L13  ● source    │
│           ↓ assigned to `amount`                   │
│ Step 2/4  amount                 L13  ● propagate  │
│           ↓ passed to build()                      │
│ Step 3/4  build(amount)          L14  ● propagate  │
│           ↓ result to db.update                    │
│ Step 4/4  db.update(tx)          L15  ● SINK       │
│                                                    │
│ Sanitizer check: ✗ none found in path             │
│ Confidence: high (deterministic IFDS)             │
│ ──────────────────────────────────────────────── │
│  [이 경고 무시]  [에이전트에게 수정 요청]         │
└───────────────────────────────────────────────────┘
```

**근거**: 신뢰 = 반복된 정확한 결과 + 설명 가능성. "경고입니다" vs "이 경로로 taint가 전파됩니다, 4단계 증명" — 후자�� 개발자가 신뢰한다.

> capability: `proof_platform`, `taint_flow`, `explain`

### 8. Pure Function Badge + Effect Overlay

함수의 순수성을 항상 표시. 리팩토링/테스트/메모이제이션 판단의 기초.

```
  12  │ pure │  function calculateFee(amount: Decimal): Decimal {
  ...
  42  │ I/O  │  async function processPayment(tx: Tx): Promise<Result> {
  ...
  67  │ writes-shared │  function updateBalance(amount: number): void {
```

| 태그 | 의미 | 리팩토링 안전성 | 메모이제이션 |
|------|------|--------------|-----------|
| `pure` | 입력�� 읽고 외부 상태 ❌ | 최고 | 가능 |
| `reads-only` | heap read만, write ❌ | 높음 | 조건부 가능 |
| `I/O` | 외부 시스템 호출 | 중간 | 불가 |
| `writes-shared` | 공유 상태 수정 | 낮음 — blast 확인 필요 | 불가 |

**근거**: "이 함수 건드려도 되냐"의 50%는 "이 함수가 뭘 하냐(effect)"로 결정된다. IntelliJ는 이걸 안 보여준다.

> capability: `effect_analysis`

### 9. Escape Analysis Badge — 성능 최적화 기회

함수의 객체 할��이 stack에 머무는지 heap으로 escape하는지 표시. 성능 최적화의 첫 번째 단서.

hover:
```
┌─────────────────────────────────────────────────┐
│ Escape Analysis                                 │
│                                                 │
│ stack eligible:    result (local, no escape)     │
│ heap escape:       txBuilder (returned)          │
│ thread escape:     none                          │
│                                                 │
│ GC pressure:       low (1 heap alloc per call)   │
│ Optimization:      txBuilder �� stack possible    │
│                    if callers don't store ref     │
└─────────────────────────────────────────────────┘
```

> capability: `escape_analysis`, `points_to`

### 10. Structural Search via ⌘K (IntelliJ SSR + 자연어)

자연어 질문을 AST 패턴 매칭 쿼리로 변환.

```
⌘K: "async 함수에서 await 없이 Promise 반환하는 곳"

결과:
  3 matches found

  api/handler.ts:42   async getUser()     → returns fetch() without await
  lib/cache.ts:18     async warmup()      → returns redis.get() without await
  core/auth.ts:91     async validate()    → returns db.query() without await

  [모두 수정]  [규칙으로 저장]
```

"규칙으로 저장" → Architecture Guardrails에 등록. 이후 같은 패턴 발생 시 자동 경고.

> capability: `structural_code_search`, `explain`
