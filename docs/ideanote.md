# P0 IDE — 기능 카탈로그 & UX 설계

> P0/P1 기능만. 증거 기반, 실제로 만들 것들.
> **이건 데모/프로토타입이 아니다. 실사용 제품이다.** 개발자가 매일 켜놓고 쓰는 IDE 앱. mock은 엔진 연결 전 UI 검증용일 뿐, 최종 형태는 실시간 엔진 데이터 기반.

---

## 목차

1. [배경 & 핵심 전제](#1-배경--핵심-전제)
2. [UX 레이어 구조](#2-ux-레이어-구조)
3. [P0 기능](#3-p0-기능)
   - 3-1. Blast Radius Overlay
   - 3-2. Agent Control Panel
4. [P1 기능](#4-p1-기능)
   - 4-1. Taint Flow Inline
   - 4-2. Behavior Diff
   - 4-3. Ownership Map
5. [기능 간 연결 구조](#5-기능-간-연결-구조)
6. [공통 UX 원칙](#6-공통-ux-원칙)
7. [엔진 구현 상태](#7-엔진-구현-상태)
8. [구현 순서 & 스프린트](#8-구현-순서--스프린트)
9. [데모 스토리](#9-데모-스토리)

**P2 기능 (다음 라운드)**
- [P2-A. Complexity Badge](#p2-a-complexity-badge)
- [P2-B. Concurrency Race Overlay](#p2-b-concurrency-race-overlay)
- [P2-C. Clone Detection](#p2-c-clone-detection)
- [P2-D. Function Effect Overlay](#p2-d-function-effect-overlay)

---

## 1. 배경 & 핵심 전제

### 무엇을 해결하는가

현재 AI 코딩 도구들(Copilot, Cursor)이 해결 못 하는 세 가지:

| 문제 | 현황 | P0 접근 |
|---|---|---|
| **영향 범위 불투명** | 개발자가 변경 범위를 평균 3.2배 과소 추정 | Blast Radius → 저장 전에 수치로 보여줌 |
| **AI 결과 검증 불가** | AI 생성 PR 거절률 수동의 2.1배. 리뷰어가 직접 검증해야 함 | Agent Gate → SE 지표로 자동 검증 후 적용 |
| **PR에서 동작 변경 미감지** | 리팩토링 PR 18%가 의도치 않은 동작 변경 포함 | Behavior Diff → 문법/의미/동작 변경 3단계 분리 |

### 핵심 전제

- 기존 IDE(VSCode/JetBrains)를 대체하지 않는다. **별도 앱으로 뜨는 실사용 제품**이다.
- 모든 경고는 **엔진 분석 결과가 근거**다. "AI의 느낌"이 아님.
- 모든 L4 패널은 **에이전트 연결점**이다. 분석 → 수정 → 검증 → 적용이 한 흐름.

---

## 2. UX 레이어 구조

4개 레이어, 개입 강도가 다름. 위험도에 따라 에스컬레이션.

```
┌──────────────────────────────────────────────────────┐
│  L4  플로팅 패널                                      │  명시적 클릭 or 에이전트 실행 시
│      Agent Panel / Blast Detail / Behavior Diff      │
├──────────────────────────────────────────────────────┤
│  L3  인라인 배너 (에디터 상단)                        │  위험 임계값 초과 시 자동
│      "이 변경 47개 파일에 영향" / "PR 충돌 감지"     │
├──────────────────────────────────────────────────────┤
│  L2  인라인 오버레이 (코드 위/옆)                     │  파일 열기 / 백그라운드 분석 후
│      FnHeader 지표 / Dead dim / Ownership 바         │
├──────────────────────────────────────────────────────┤
│  L1  Gutter 아이콘 + Hover 툴팁                      │  항상. 가장 비침습적
│      taint ⚡ / dead 💤 / race 🔀 / owner 👤        │
└──────────────────────────────────────────────────────┘
                  기존 IDE 에디터
```

| 레이어 | 트리거 | 닫기 | 에이전트 연결 |
|---|---|---|---|
| L1 | 항상 | 없음 | hover 내 버튼 |
| L2 | 파일 열기 후 분석 완료 | 토글 | 클릭 시 L4 |
| L3 | 저장/커밋 시 임계값 초과 | 수동 닫기 | 배너 내 버튼 |
| L4 | 명시적 클릭 | 닫기 버튼 | 항상 포함 |

---

## 3. P0 기능

---

### 3-1. Blast Radius Overlay

**한 줄**: 지금 건드리는 코드가 얼마나 퍼져나가는지, 저장 전에 숫자로 보여준다.

#### 왜 P0인가

- 변경 실패의 1위 원인 = 예상치 못한 downstream 영향 (Google SRE Book)
- 개발자의 변경 범위 추정 오차 = 평균 **3.2배 과소 추정** (MSR 2020)
- 엔진(`change_impact`)이 이미 구현돼 있어 연결 비용 낮음
- 현재 데모에 mock으로 존재 → 실데이터 연결만 하면 됨

#### 엔진

`change_impact` · `call_graph` · `dataflow_paths`

#### UX 흐름

```
코드 수정
  → [백그라운드] change_impact 계산
  → L2 인라인 바 업데이트
  → 저장 시 임계값 초과면 L3 배너
  → 클릭 시 L4 상세 패널
```

**L2 — 에디터 상단 인라인 바 (항상)**
```
  ◈ blast  14 files · 3 critical    [상세 ↗]
```
- 파일 수 낮음(~5): dim 회색
- 중간(6~20): amber
- 높음(21+) or critical 포함: red
- `critical` = taint/security 경로가 포함된 파일만 카운트

**L3 — 저장 시 배너 (임계값 초과)**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠  이 변경은 47개 파일에 영향을 줍니다 — 임계값(20) 초과   │
│    [상세 보기]                              [계속 저장]      │
└─────────────────────────────────────────────────────────────┘
```
- 임계값: `p0.config.json`의 `blast_radius_threshold` (기본 20)
- "계속 저장"은 항상 활성. 차단하지 않음, 인지시킬 뿐

**L4 — Blast Radius 패널**
```
┌──────────────────────────────────────────┐
│ Blast Radius                   [×]       │
│ processRefund() · refund/ledger.ts       │
│ ──────────────────────────────────────── │
│  CHANGED    IMPACT    CRITICAL           │
│     3         47          2             │
│ ──────────────────────────────────────── │
│  영향 파일 — 위험도순                    │
│                                          │
│  ● refund/ledger.ts      taint · L9     │  ← 클릭 시 해당 파일 이동
│  ● webhook/retry.ts      callers ×9     │
│  ○ utils/db.ts           indirect       │
│  ○ ...  44개 더                         │  ← 접기/펼치기
│ ──────────────────────────────────────── │
│  [에이전트에게 영향 분석 요청]            │
└──────────────────────────────────────────┘
```
- "에이전트에게 영향 분석 요청" → AgentPanel에 blast 데이터 + 파일 목록 자동 주입
- 파일 hover 시 해당 파일의 영향 경로(call path) 미니 툴팁

---

### 3-2. Agent Control Panel

**한 줄**: 에이전트에게 엔진 분석 결과를 지도로 주고, 결과를 SE 지표로 검증한 뒤 적용/차단한다.

#### 왜 P0인가

- AI 생성 PR 거절률 2.1배 → **에이전트 결과를 믿을 수 없음**이 핵심 문제
- "코드 리뷰 피로": 리뷰어가 AI 결과물 검증에 더 많은 시간 소비 (SO 2024)
- 에이전트 단독 실행 vs. 분석 컨텍스트 주입 시 정확도 차이 ~40%
- 현재 AgentPanel이 이미 존재 → Gate 레이어 추가만 필요

#### 엔진

`agent_execution_loop` · `gate_enforced_apply` · `post_apply_validation_v1` · `proof_replay` · `change_impact`

#### UX 흐름

```
개발자 질문 입력
  → 엔진 컨텍스트 자동 수집 (blast / taint / owners / complexity)
  → 에이전트 실행 + 패치 생성
  → Gate 검증 (blast 증가? / taint 신규? / complexity 예산 초과?)
  → 통과: [적용] 버튼 활성
  → 실패: 에이전트 재시도 or 개발자 판단
```

**L4 — Agent Panel (현재 패널 확장)**

크게 3개 영역으로 구분:

```
┌──────────────────────────────────────────────┐
│ p0 / acme/payments-api          [pin]  [×]   │
│ ──────────────────────────────────────────── │
│ [session-1 ×]  [session-2 ×]  [+]           │
│ ════════════════════════════════════════════ │
│                                              │
│  ① 컨텍스트 (지도)                           │  ← 에이전트에게 전달된 엔진 결과
│  ┌────────────────────────────────────────┐  │
│  │ blast 14 · taint L9 · owners @alice   │  │
│  │ complexity 6.3 · callers 14           │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ② 대화                                      │  ← 기존 chat UI
│  p0                                          │
│   Duplicate refund path across...            │
│   [TRACE 14] [RISK 0.92] [WRITERS 6]        │
│   ...                                        │
│                                              │
│  ③ 패치 & 검증 (에이전트가 코드 수정 시)     │  ← 새로 추가
│  ┌────────────────────────────────────────┐  │
│  │ ✓ blast 14 → 6  (개선)               │  │
│  │ ✓ taint path 해결                    │  │
│  │ ⚠ complexity +1.2 (예산 내)          │  │
│  │ ✓ proof_replay 통과                  │  │
│  └────────────────────────────────────────┘  │
│  [적용]   [거부]   [증거 상세]               │
│ ──────────────────────────────────────────── │
│  [입력창]                     [p0 ▾][Deep ▾]│
└──────────────────────────────────────────────┘
```

**컨텍스트 영역 (①)**
- 질문 입력 전 자동으로 현재 열린 파일 기준 엔진 분석 결과 수집
- 접기/펼치기 가능. 개발자가 어떤 정보가 에이전트에게 가는지 투명하게 확인

**패치 & 검증 영역 (③)**
- 에이전트가 패치를 생성했을 때만 노출 (코드 변경 없는 답변엔 미표시)
- Gate 항목별 통과(✓) / 경고(⚠) / 실패(✗) 표시
- [적용]: `gate_enforced_apply` 실행 후 실제 코드에 반영
- [거부]: 패치 버림, 대화는 유지
- [증거 상세]: `proof_replay` 결과 + 각 지표 원본 데이터 패널 열림

**Gate 기준 (백그라운드)**
```
패치 생성 완료
  → blast_radius: 패치 후 blast ≤ 패치 전 blast  (증가 시 ⚠)
  → taint_flow:  신규 taint path 0개  (발생 시 ✗ 차단)
  → cost_analysis: complexity delta ≤ team_budget  (초과 시 ⚠)
  → proof_replay: 결정론적 재검사 통과  (실패 시 ✗ 차단)
```
- `✗ 차단` = [적용] 비활성, 에이전트에게 재시도 지시
- `⚠ 경고` = [적용] 활성, 개발자 판단에 맡김

---

## 4. P1 기능

---

### 4-1. Taint Flow Inline

**한 줄**: 사용자 입력이 검증 없이 어디로 흘러가는지 코드 라인에서 직접 보여준다.

#### 왜 P1인가

- OWASP A03(Injection): 전체 웹 취약점의 ~30% (2023)
- 취약점을 개발 단계에서 잡는 비용 = 운영 단계의 1/100 (IBM)
- 보안 이슈의 68%가 코드 리뷰에서 발견 못 하고 운영에서 터짐 (Veracode 2023)
- Agent Control Panel의 Gate에 taint 검사가 포함 → **에이전트 루프와 직접 연결**

#### 엔진

`taint_flow` · `source_sink_detection` · `ifds_solver` · `backward_ifds`

#### UX 흐름

```
파일 열기 or 코드 입력
  → [백그라운드] taint_flow 분석
  → source/sink 라인 특정
  → L1 gutter 아이콘 표시
  → hover 시 경로 요약 툴팁
  → "전체 경로" 클릭 시 L4 패널
```

**L1 — Gutter 아이콘 + hover**
```
  10  │ ⚡ │  const query = req.body.input;        ← source
  11  │    │  const safe = sanitize(query);         ← sanitizer ✓
  12  │ ⛔ │  const res = db.rawQuery(userInput);   ← sink (다른 경로)
```
- `⚡` source: 외부 입력 진입점
- `⛔` sink: sanitizer 없이 도달 가능한 위험 지점
- `✓` sanitizer: 보호된 경로 (dim 처리, 경고 없음)

**hover — source 라인**
```
┌────────────────────────────────────────────┐
│ ⚡ Taint Source                            │
│ req.body.input                             │
│                                            │
│ → db.rawQuery() 까지 비보호 경로 존재 (L12)│
│ Sanitizer: 없음                            │
│ 위험: SQL Injection · OWASP A03            │
│                                            │
│ [전체 경로]  [에이전트에게 수정 요청]       │
└────────────────────────────────────────────┘
```

**L4 — Taint 경로 패널**
```
┌──────────────────────────────────────────────┐
│ Taint Flow                          [×]      │
│ req.body.input → db.rawQuery()               │
│ ──────────────────────────────────────────── │
│                                              │
│  ⚡ req.body.input      L10  source          │
│      ↓                                       │
│  userInput              L10  alias           │
│      ↓                                       │
│  db.rawQuery(userInput) L12  SINK ⛔         │
│                                              │
│  Sanitizer 누락 위치: L10~L12 사이          │
│  수정 제안: validate(input) 또는 paramQuery  │
│ ──────────────────────────────────────────── │
│  [에이전트에게 sanitizer 추가 요청]          │
└──────────────────────────────────────────────┘
```
- 각 노드 클릭 → 에디터 해당 라인으로 이동
- "에이전트에게 sanitizer 추가 요청" → Agent Panel에 taint 경로 컨텍스트 주입

---

### 4-2. Behavior Diff

**한 줄**: PR diff를 문법 변경 / 의미 변경 / 동작 변경 3단계로 분리해 리뷰어가 진짜 바뀐 것만 본다.

#### 왜 P1인가

- 리팩토링 PR의 18%가 **의도치 않은 동작 변경** 포함 (Empirical SE Journal 2022)
- AI 생성 코드의 "조용한 동작 변경" 증가 추세 (GitHub 2024) → AI 도구 확산과 직결
- PR 리뷰 시간 단축 = 배포 빈도 직결 (DORA 핵심 지표)
- Agent Control Panel Gate의 `behavior_diff` 항목과 동일 엔진 → 재사용

#### 엔진

`behavior_diff` · `dataflow` · `effect_analysis` · `slice`

#### UX 흐름

```
PR 오픈 (or 커밋 후 diff 확인)
  → [백그라운드] behavior_diff 분석
  → 변경 분류: 문법 / 의미 / 동작
  → L2 diff 뷰에 컬러 레이어 오버레이
  → 동작 변경 라인만 별도 L4 패널에 집계
```

**L2 — diff 뷰 오버레이**

기존 git diff 위에 레이어 추가:
```
  L9  - const tx = build(validated);
      + const tx = build(validated, { idempotency: key });
        ↑ 동작 변경  ████ (red 하이라이트)

  L14 - const result = await processPayment(tx)
      + const result = await processPayment(tx)  // renamed arg
        ↑ 문법 변경  ░░░░ (dim, 거의 안 보임)
```
- 동작 변경: red 배경 (진함)
- 의미 변경: amber 배경 (중간)
- 문법 변경: dim / 거의 안 보임 → 리뷰어 시선 낭비 없앰

**L4 — Behavior Diff 패널**
```
┌──────────────────────────────────────────────┐
│ Behavior Diff — PR #501             [×]      │
│ ──────────────────────────────────────────── │
│                                              │
│  문법 변경    12줄    리네임, 포맷           │  ← 접혀 있음 (기본)
│  의미 변경     3줄    로직 동일, 표현 다름   │  ← 접혀 있음
│  동작 변경     2줄    실행 결과 달라짐 ⚠    │  ← 펼쳐짐 (기본)
│                                              │
│  ▼ 동작 변경 상세                            │
│                                              │
│  L9  idempotency key 전달 경로 변경          │
│      before: key 누락 → build() → update()  │
│      after:  key 포함 → build() → update()  │
│      영향: 중복 refund 방지 경로 닫힘        │
│                                              │
│  L34 retry 조건 역전                         │
│      before: retry if err.code === 429       │
│      after:  retry if err.code !== 200       │
│      영향: 성공 응답에도 retry 발생 가능      │
│                                              │
│  [에이전트에게 L34 검토 요청]                │
│  [리뷰어 멘션: @alice (ledger owner)]        │
└──────────────────────────────────────────────┘
```
- 동작 변경 라인 클릭 → diff 뷰에서 해당 라인 포커스
- "리뷰어 멘션" = Ownership Map 연동 (해당 파일 오너 자동 추천)

---

### 4-3. Ownership Map

**한 줄**: CODEOWNERS 없어도 git blame + call graph로 실질 오너십을 추론하고, PR 리뷰어를 자동 추천한다.

#### 왜 P1인가

- 오너 없는 파일 = 버그 밀도 **3.7배** (Google 내부 연구)
- 실제 팀의 70%가 CODEOWNERS를 최신 상태로 유지 못 함 (GitHub Survey 2023)
- DORA: 코드 리뷰 품질이 배포 빈도와 가장 강한 상관관계
- Behavior Diff의 "리뷰어 멘션"과 직접 연결 → P1 기능끼리 시너지

#### 엔진

`import_graph` · `find_references` · `call_graph` + git blame

#### UX 흐름

```
파일 열기 or PR 생성
  → [백그라운드] git blame + call graph로 오너십 계산
  → L1 파일 탭 hover에 오너 요약
  → L2 파일 상단 오너 바
  → PR 생성 시 L4 패널에 리뷰어 추천
```

**L1 — 파일 탭 hover**
```
┌──────────────────────────────────┐
│ refund/ledger.ts                 │
│ @alice  62%  @bob  28%          │
│ orphan  10%  ← 오너 없는 영역   │
│ 마지막 수정: 3일 전              │
│ [오너십 상세 →]                  │
└──────────────────────────────────┘
```

**L2 — 파일 상단 인라인 바**
```
  👤 @alice 62%   @bob 28%   ⚠ orphan 10%    [상세 ↗]
```
- orphan 비율이 높으면 amber 강조
- 클릭 시 L4 패널

**L4 — Ownership 패널**
```
┌──────────────────────────────────────────┐
│ Ownership                       [×]      │
│ refund/ 디렉토리                         │
│ ──────────────────────────────────────── │
│                                          │
│ 파일           오너          기여도      │
│ ledger.ts      @alice        ████████░░  │
│ webhook.ts     @bob          ████░░░░░░  │
│ retry.ts       ⚠ orphan     ██████████  │  ← 오너 없음
│ idempotency.ts @carol        ██████░░░░  │
│                                          │
│ ──────────────────────────────────────── │
│ PR #501 리뷰어 추천                      │
│                                          │
│ → @alice   ledger.ts 수정 포함           │
│ → @carol   idempotency 관련 변경         │
│                                          │
│ ⚠ retry.ts: 오너 없음 — 리뷰어 지정 필요│
│ ──────────────────────────────────────── │
│ [GitHub PR에 리뷰어 추가]                │
└──────────────────────────────────────────┘
```
- "GitHub PR에 리뷰어 추가" → GitHub API 연동, PR reviewer 자동 설정
- orphan 파일은 별도 색상으로 강조 + 팀장/시니어에게 리뷰 요청 유도

---

---

## 4-4. (P1 추가) Complexity Live Badge

**한 줄**: 함수 헤더 위에 실시간 Big-O + 사이클로매틱 복잡도 뱃지. 숫자가 팀 예산 초과 시 amber.

#### 왜 P1인가

- 기존 mock에 CPX 9.1 / 6.3 수치가 이미 `LineHint`로 존재 → **UI 연결만 하면 됨**
- 복잡도가 높은 함수가 버그 밀도 **4.3배** (Nagappan 2006, replicated 여러 차례)
- Agent Gate의 `cost_analysis` 항목과 동일 엔진 → 재사용 비용 0
- Cursor/Copilot/CodeLens 어디에도 **함수 단위 Big-O 추론**은 없음

#### 엔진

`cost_analysis` (wired, grade 95/100) — Big-O 추론, 사이클로매틱, parametric bounds

#### UX

**L1 — 함수 헤더 위 인라인 뱃지**
```
  8  │ CPX 6.3  O(n·m)  │  class AnalyzeControlFlowTool(StepTool):
```
- `CPX ≤ 5`: dim 회색 (정상)
- `CPX 6~9`: amber
- `CPX 10+`: red + 에이전트 리팩토링 제안 버튼
- Big-O는 추론 가능할 때만 표시 (불가 시 숨김)

**hover — 상세**
```
┌──────────────────────────────────────┐
│ Complexity                           │
│ Cyclomatic  6.3  (team budget: 8)   │
│ Big-O       O(n·m)  — nested loop   │
│ Path count  14                       │
│                                      │
│ [에이전트에게 리팩토링 요청]          │
└──────────────────────────────────────┘
```

**Agent Gate 연결**: Gate의 `complexity delta ≤ team_budget` 항목이 이 뱃지와 동일 수치 사용.
패치 전후 CPX 변화를 Gate UI에서 `▲+1.2` 형태로 표시.

---

## 5. 기능 간 연결 구조

모든 P0/P1 기능은 독립적이지 않다. 에이전트를 중심으로 연결된다.

```
                    ┌─────────────────┐
                    │  Agent Panel    │  ← 모든 기능의 종착점
                    │  (컨텍스트 허브) │
                    └────────┬────────┘
                             │ 컨텍스트 주입
          ┌──────────────────┼──────────────────┐
          ↓                  ↓                  ↓
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Blast Radius │  │ Taint Flow   │  │ Ownership    │
  │ 영향 파일 목록│  │ 경로 + 위험도│  │ 오너 + 리뷰어│
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                  │
         └────────┬─────────┘                 │
                  ↓                           │
         ┌─────────────────┐                  │
         │  Behavior Diff  │ ←────────────────┘
         │  동작 변경 감지  │  오너 → 리뷰어 추천
         └─────────────────┘
```

**핵심 흐름 예시**
```
1. 개발자가 processRefund() 수정
2. Blast Radius → "14 files, 2 critical" L2 표시
3. 저장 → L3 배너 (임계값 초과)
4. "에이전트에게 분석 요청" 클릭
5. Agent Panel: blast 데이터 + taint 경로 자동 주입
6. 에이전트 패치 생성
7. Gate 검증: blast 감소 ✓ / taint 해결 ✓ / complexity ⚠
8. [적용] → 실제 코드 반영
9. PR 생성 → Behavior Diff + Ownership Map → 리뷰어 자동 추천
```

---

---

## 5-B. 업데이트된 기능 간 연결 구조

```
                    ┌─────────────────────┐
                    │    Agent Panel      │  ← 모든 기능의 종착점
                    │  (컨텍스트 허브)     │
                    └──────────┬──────────┘
                               │ 컨텍스트 자동 주입
       ┌───────────────────────┼──────────────────────┐
       ↓                       ↓                      ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Blast Radius │      │ Taint Flow   │      │Complexity    │  ← 신규
│ 영향 파일 목록│      │ 경로 + 위험도│      │Badge         │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                      │ Gate 예산
       └──────────┬──────────┘                      │
                  ↓                                 ↓
       ┌─────────────────┐             ┌────────────────────┐
       │  Behavior Diff  │             │   Agent Gate       │
       │  동작 변경 감지  │ ←───────── │  blast/taint/CPX/  │
       └────────┬────────┘             │  proof 통합 검증   │
                │                      └────────────────────┘
                ↓
       ┌─────────────────┐      ┌──────────────────┐
       │  Ownership Map  │      │  Clone Detection │  ← P2
       │  오너 + 리뷰어   │      │  AI 중복 코드     │
       └─────────────────┘      └──────────────────┘
```

---

## 6. 공통 UX 원칙

### 비침습 우선
정보는 항상 보이되, **개입은 위험도에 비례**한다.
L1(항상) → L2(분석 후) → L3(임계값 초과) → L4(명시적 요청)

### 증거 필수
모든 경고에 "왜"가 있어야 한다. "이상해" 가 아니라 "callers 14개 중 2개에 taint path 존재, IFDS 분석 기반".
개발자가 근거를 직접 확인할 수 있어야 신뢰한다.

### 에이전트는 종착점
모든 L4 패널 하단에 "에이전트에게 요청" 버튼. 분석 결과가 자동으로 컨텍스트로 주입된다.
개발자는 **분석 읽기 → 버튼 하나 → 수정 완료**가 되어야 한다.

### 차단하지 않음
P0는 게이트키퍼가 아니다. 경고하고 인지시키되, 최종 결정은 항상 개발자가 한다.
단, Gate 실패(taint 신규 생성 등)는 [적용] 비활성 — **적용 경로만 막음**, 저장/커밋은 막지 않음.

### 팀 정책으로 통제
개인 설정이 아닌 레포 단위 `p0.config.json`:
```json
{
  "blast_radius_threshold": 20,
  "complexity_budget": 10,
  "taint_policy": "block_on_new_sink",
  "ownership_orphan_alert": true
}
```

---

---

## 6-B. P2 기능 (다음 라운드)

P0/P1이 실 데이터 연결된 후. 엔진은 이미 준비됨.

---

### P2-A. Complexity Badge

위 4-4 섹션 참조. 이미 P1으로 격상 제안 — mock 연결 비용 거의 없음.

> **재평가**: mock에 CPX 수치 이미 존재 + Gate에 연결되면 P1 수준 가치.
> Sprint 2와 병행 가능.

---

### P2-B. Concurrency Race Overlay

**한 줄**: 멀티스레드 코드에서 잠금 없이 공유 변수에 접근하는 레이스 컨디션을 라인 단위로 표시.

#### 왜 P2인가 (P1 아닌 이유)

- 엔진 wired 95/100으로 강력하지만
- Python GIL / JS single-thread 환경에선 임팩트 낮음
- **대상 코드베이스가 Java/Go/Rust/C++ 위주일 때 P0급으로 격상**
- 현재 mock 코드가 Python 기반 → 데모 임팩트 낮음

#### 엔진

`eraser_lockset` · `fasttrack_hb` · `tarjan_deadlock` · `hybrid_race_analyzer`
(모두 wired, 95/100)

#### UX

**L1 — Gutter**
```
  34  │ 🔀 │  balance = balance - amount   ← shared write, no lock
  35  │    │  return balance
```
- `🔀` = race-prone write (다른 스레드와 공유 + 잠금 없음)
- `🔒` = 잠금 보호됨 (dim, 경고 없음)

**hover**
```
┌───────────────────────────────────────────┐
│ 🔀 Race Condition Risk                    │
│ balance: shared across threads            │
│                                           │
│ Writers: process_refund (T1), retry (T2) │
│ Lock:    없음                             │
│ Pattern: check-then-act (non-atomic)      │
│                                           │
│ [에이전트에게 잠금 추가 요청]             │
└───────────────────────────────────────────┘
```

**L4 — Race Panel**
```
┌──────────────────────────────────────────┐
│ Race Conditions                  [×]     │
│ DeepReasoningOrchestrator.py             │
│ ──────────────────────────────────────── │
│  balance  — 3 writers, 0 locks           │
│    T1: process_refund()    L34           │
│    T2: retry_handler()     L89           │
│    T3: audit_hook()        L201          │
│                                          │
│  deadlock potential: medium              │
│  happens-before violations: 2           │
│ ──────────────────────────────────────── │
│ [에이전트에게 동시성 리팩토링 요청]       │
└──────────────────────────────────────────┘
```

#### 격상 조건
대상 팀이 Java/Go/Rust 사용 → **즉시 P1으로 격상**. 엔진 준비 완료.

---

### P2-C. Clone Detection

**한 줄**: AI가 생성하거나 복붙된 중복 코드를 실시간으로 감지. "이 코드 다른 데도 있음" 뱃지.

#### 왜 P2인가

- AI 코딩 도구 확산으로 **Type 2/3 clone 밀도 급증** (GitHub Copilot 도입 팀 +38%, 2024)
- 엔진 wired 95/100, clone detection은 즉시 사용 가능
- 단독으로는 액션으로 이어지기 어려움 → Blast Radius + Agent Panel과 연결돼야 가치
- P0/P1 완성 후 "있으면 좋은" 단계

#### 엔진

`clone_detection` (MinHash + LSH + semantic fingerprint, wired 95/100)

#### UX

**L2 — 인라인 힌트**
```
  8  │ 2 clones  │  class AnalyzeControlFlowTool(StepTool):
```
- "2 clones" 클릭 → 복제 위치 목록 팝업

**L4 — Clone Panel**
```
┌──────────────────────────────────────────┐
│ Clone Detection                  [×]     │
│ AnalyzeControlFlowTool (current)         │
│ ──────────────────────────────────────── │
│  Type 2 clone (이름만 다름):             │
│  → AnalyzeDataFlowTool     tools/df.py  │
│                                          │
│  Type 3 clone (로직 유사 ~82%):         │
│  → SecurityCheckTool       tools/sc.py  │
│                                          │
│  blast 공유: 14 files 중 9개 겹침       │
│ ──────────────────────────────────────── │
│ [에이전트에게 추출 리팩토링 요청]         │
└──────────────────────────────────────────┘
```

**핵심 차별점**: AI가 만든 클론을 즉시 발견 + "추출 리팩토링" 에이전트로 직결.

---

### P2-D. Function Effect Overlay

**한 줄**: 이 함수가 어떤 전역 상태 / heap / DB를 수정하는지 hover에 표시. 부작용 없는 함수는 `pure` 뱃지.

#### 왜 P2인가

- Blast Radius가 "얼마나 퍼지냐"라면, Effect Overlay는 "무엇을 바꾸냐" — 보완 관계
- `effect_analysis` wired 95/100
- 단독 가치 있지만 Blast Radius 이해 후 자연스럽게 필요해지는 기능 → P2 적절
- "pure function" 뱃지는 함수형 코드 리팩토링 세일즈 포인트

#### 엔진

`effect_analysis` (heap read/write, shared side-effects, container effects, wired 95/100)

#### UX

**L1 — 함수 hover에 effects 섹션 추가**
```
┌──────────────────────────────────────────────┐
│ _analyze_taint_path_control_flow             │
│ ─────────────────────────────────────────── │
│ Effects:                                     │
│  WRITES  self.cfg_cache          (heap)      │
│  WRITES  semgrep_subprocess      (I/O)       │
│  READS   self.rules              (heap)      │
│  CALLS   _run_semgrep_analysis   (side-fx)   │
│                                              │
│ ⚠ not pure — 외부 I/O 포함                  │
└──────────────────────────────────────────────┘
```

**L2 — pure 함수는 뱃지**
```
  42  │ pure │  def calculate_fee(amount: Decimal) -> Decimal:
```
- `pure` = 입력만 읽고 외부 상태 변경 없음 → 테스트 쉽고, 리팩토링 안전
- `reads-only` = heap read는 있지만 write 없음
- `I/O` = 외부 시스템 호출 포함 (amber)
- `writes-shared` = 공유 상태 수정 (red, Blast와 연계)

---

## 7. 엔진 구현 상태

327개 카탈로그 항목 중 P0/P1 기능에 필요한 엔진만. (quanta-v2 기준)

| 엔진 | 상태 | 안정성 | 비고 |
|---|---|---|---|
| `taint_flow` | **wired** | stable | P1 Taint Flow 핵심. 즉시 연결 가능 |
| `change_impact_analysis` | **wired** | stable | Blast Radius 핵심. `blast_radius` 수치 포함 |
| `call_graph` | **wired** | experimental | Blast Radius 경로 추적. 안정화 중 |
| `dataflow_paths` | **wired** | experimental | Blast + Taint 공통. 구현 grade 100/100 |
| `behavior_diff` | **wired** | experimental | P1 Behavior Diff 핵심. hidden surface — UI 연결 필요 |
| `agent_execution_loop` | **wired** | — | P0 Agent Gate 핵심. adapter grade 92/100 |
| `gate_enforced_apply` | **wired** | — | Gate 적용 레이어. adapter grade 92/100 |
| `proof_replay` | **wired** | — | Gate 검증 최종단. engine_component grade 92/100 |
| `import_graph` + `find_references` | **wired** | stable | P1 Ownership 기반. call_graph와 조합 |
| `cost_analysis` | **wired** | 95/100 | P1 Complexity Badge. Big-O 추론 포함 |
| `effect_analysis` | **wired** | 95/100 | P2 Function Effect Overlay. heap/IO/shared 분류 |
| `clone_detection` | **wired** | 95/100 | P2 Clone Detection. MinHash+LSH+semantic |
| `eraser_lockset` + `fasttrack_hb` | **wired** | 95/100 | P2 Concurrency Race. Java/Go 환경에서 P1급 |
| `tarjan_deadlock` + `hybrid_race_analyzer` | **wired** | 95/100 | P2 Race 보조. deadlock 감지 포함 |

**결론**: P0~P2 전 기능에 필요한 모든 엔진이 wired 상태.
- P0/P1: 즉시 연결 가능. UI 컴포넌트 개발만 필요.
- P2: 엔진 준비 완료. `behavior_diff`는 hidden surface라 API 노출 작업 선행 필요.
- Concurrency Race: Go/Java 팀 온보딩 시 즉시 P1급으로 격상 가능.

---

## 8. 구현 순서 & 스프린트

### 우선순위 판단 기준
1. 엔진이 이미 wired 상태인가
2. 현재 mock이 존재하는가 (연결 비용 최소)
3. 실사용 임팩트가 큰가 (매일 쓸 때 체감)
4. P0 기능 간 의존성 없는가

### Sprint 1 — P0 실사용 연결 (지금 바로)

**S1-1. Blast Radius: Mock → 엔진 연결**

현재 상태: `DISASTER_DATA`, blast 수치가 mock으로 존재 (AgentPanel metrics에 표시 중)

연결 포인트:
```
현재: buildReply("double-refund") → 하드코딩된 blast 수치
목표: change_impact_analysis API 호출 → 실시간 수치
```

작업:
- [ ] `devosClient.ts`에 `getBlastRadius(filePath, fnName)` 추가
- [ ] `IdePage.tsx`의 에디터 파일/함수 변경 시 호출
- [ ] L2 인라인 바 컴포넌트 신규 (`BlastBar.tsx`)
- [ ] L3 배너 컴포넌트 신규 (`BlastBanner.tsx`, 저장 시 임계값 체크)
- [ ] L4 패널 신규 (`BlastPanel.tsx`, 파일 목록 + 에이전트 연결)

**S1-2. Agent Panel: Context 영역 추가**

현재 상태: AgentPanel에 채팅 UI만 있음. 컨텍스트 영역(①) 없음

작업:
- [ ] `AgentPanel.tsx`에 `ContextBar` 섹션 추가 (접기/펼치기)
- [ ] blast 데이터 → 에이전트 메시지에 자동 prefix 주입
- [ ] Gate 검증 UI 영역(③) 추가 (패치 생성 시 노출)
- [ ] [적용] / [거부] 버튼 (gate_enforced_apply 연동)

예상 소요: 3~4일

---

### Sprint 2 — P1-A: Taint Flow (엔진 완성도 최고)

`taint_flow`가 stable + wired → 연결 비용 가장 낮음

연결 포인트:
```
현재: mock-charge.tsx에 taint 경로가 이미 HoverSymbol에 하드코딩
목표: taint_flow API → 실시간 source/sink 감지
```

작업:
- [ ] Gutter 아이콘 컴포넌트 (`TaintGutter.tsx`)
- [ ] Hover 툴팁에 실 taint 데이터 바인딩
- [ ] L4 Taint 경로 패널 (`TaintPanel.tsx`)
- [ ] 에이전트 "sanitizer 추가 요청" 버튼 → Agent Panel 컨텍스트 주입

예상 소요: 2~3일

---

### Sprint 3 — P1-B: Behavior Diff

`behavior_diff`는 hidden surface → API 노출 작업 선행 필요

작업:
- [ ] `behavior_diff` API endpoint 노출 확인/작업
- [ ] diff 뷰 위에 3단계 오버레이 레이어
- [ ] L4 Behavior Diff 패널
- [ ] Ownership Map과 리뷰어 추천 연결

예상 소요: 3~4일 (API 노출 포함)

---

### Sprint 4 — P1-C: Ownership Map

git blame + call_graph 조합. GitHub API 연동 포함.

작업:
- [ ] git blame 파서 + call_graph로 오너십 계산 로직
- [ ] L1 파일 탭 hover 오버레이
- [ ] L2 파일 상단 오너 바
- [ ] L4 패널 + GitHub PR 리뷰어 자동 추가 API

예상 소요: 4~5일

---

### 전체 로드맵

```
Week 1-2   Sprint 1   Blast Radius (L2/L3/L4) + Agent Gate UI
Week 3     Sprint 2   Taint Flow Inline + Complexity Badge (병행, 낮은 비용)
Week 4     Sprint 3   Behavior Diff
Week 5     Sprint 4   Ownership Map + GitHub 연동
──────────────── P2 라운드 ────────────────
Week 6     Sprint 5   Function Effect Overlay + Clone Detection
Week 7     Sprint 6   Concurrency Race (Go/Java 팀 온보딩 시)
```

### 우선순위 전체 요약

| 기능 | 우선순위 | 엔진 상태 | Mock 있음 | 실사용 임팩트 | 경쟁사 없음 |
|---|---|---|---|---|---|
| Blast Radius Overlay | **P0** | wired stable | ✓ | 최고 | ✓ |
| Agent Control Panel | **P0** | wired 92/100 | ✓ | 최고 | ✓ |
| Taint Flow Inline | **P1** | wired stable | ✓ | 높음 | △ (Snyk 유사) |
| Behavior Diff | **P1** | wired 95/100 | — | 높음 | ✓ |
| Ownership Map | **P1** | wired stable | — | 중간 | △ (CodeOwners) |
| Complexity Badge | **P1** | wired 95/100 | ✓ (CPX 수치 있음) | 중간 | ✓ |
| Function Effect Overlay | **P2** | wired 95/100 | — | 중간 | ✓ |
| Clone Detection | **P2** | wired 95/100 | — | 중간 | △ (SonarQube 유사) |
| Concurrency Race | **P2** | wired 95/100 | — | 낮음(Python) / 높음(Go) | ✓ |

---

## 9. 사용 시나리오

> 아래는 데모용 스크립트가 아니라 **실제 사용자가 매일 반복하는 워크플로우**다.
> 이 흐름이 자연스러워야 제품이 성립한다.

**대상**: 실사용 개발자 (시니어, 테크 리드, AI native 포함)
**목표**: "AI 결과를 검증하고 통제하는 도구" — 매일 켜놓고 쓰는 IDE
**핵심**: 데모 때만 인상적인 게 아니라, 100번째 사용에도 가치 있어야 함

---

### Scene 1 — 문제 인지 (30초)

```
에디터에 refund/ledger.ts 열려 있음

개발자: processRefund() 한 줄 수정
→ 즉시 에디터 상단에 나타남:

  ◈ blast  14 files · 2 critical    [상세 ↗]
         ↑
   "AI가 이 숫자 알려준 적 있나요?"
```

**메시지**: 지금 건드린 코드가 얼마나 퍼져나가는지 — 이걸 모르고 AI한테 고쳐달라고 하고 있었다.

---

### Scene 2 — 에이전트에게 지도 주기 (1분)

```
[상세 ↗] 클릭 → L4 Blast 패널
"에이전트에게 영향 분석 요청" 클릭

→ Agent Panel 열림:

  ① 컨텍스트
  ┌──────────────────────────────┐
  │ blast 14 · taint L9         │
  │ critical: refund/ledger.ts  │
  │ callers: 14                 │
  └──────────────────────────────┘
  
  개발자: "refund 중복 경로 막아줘"
  → 에이전트가 엔진 데이터를 보고 있다
```

**메시지**: AI한테 고쳐달라고 할 때, 이 지도를 주고 있는가? Cursor/Copilot은 이걸 모른 채 코드만 본다.

---

### Scene 3 — Gate 검증 (1분 30초)

```
에이전트 패치 생성
→ Gate 영역 나타남:

  ③ 패치 & 검증
  ✓ blast  14 → 6  (개선)
  ✓ taint path 해결
  ⚠ complexity +1.2 (예산 내)
  ✓ proof_replay 통과

  [적용]   [거부]   [증거 상세]
```

**메시지**: AI가 고친 코드를 어떻게 믿나? 지금까지는 리뷰어가 직접 봐야 했다. 이제 SE 지표가 먼저 검증한다.

---

### Scene 4 — PR 생성 + 리뷰어 자동 추천 (1분)

```
[적용] → 코드 반영
PR 생성

→ Behavior Diff:
  동작 변경 2줄 ⚠ (문법 변경 12줄은 dim 처리)

→ Ownership Map:
  PR #502 리뷰어 추천:
  → @alice  ledger.ts 수정 포함
  → @carol  idempotency 관련

  [GitHub PR에 리뷰어 추가]
```

**메시지**: PR에서 "진짜 바뀐 것"만 보고, 그 코드를 가장 잘 아는 사람한테 리뷰가 간다.

---

---

## 추가 기능 제안 (2026-04-12)

> RFC 제품 정의 기준 — "구조를 강제하는 인텔리전스 레이어" + AI 시대 신뢰 문제 해결.
> 기존 P0/P1/P2에 없는 것만. 엔진 연결 가능한 것만.

---

### 신규-A. Architecture Guardrails (P1 격상 후보)

**한 줄**: 팀이 정한 레이어 규칙/의존성 방향을 실시간 감시. 위반 즉시 인라인 표시.

#### 왜 지금 넣어야 하는가

ideanote 기존 기능들(Blast Radius, Taint, Behavior Diff)은 "코드 단위"의 문제다. Architecture Guardrails는 **"레포 전체 구조"** 단위 — 이게 없으면 AI native 개발자가 아키텍처를 조금씩 어기는 걸 아무도 못 잡는다. RFC의 "아키텍처 철학 주입"을 실제로 구현하는 유일한 기능이다.

#### 엔진

`import_graph` · `module_dependency` · `arch_rules` (wired)

#### UX

**L1 — 위반 라인 gutter**
```
  42  │ ⛔ │  import { db } from '@/infra/database'
                ↑ domain → infra 직접 참조 금지
```

**hover**
```
┌─────────────────────────────────────────────┐
│ ⛔ Architecture Violation                   │
│ 규칙: domain/ → infra/ 직접 참조 금지       │
│                                             │
│ 올바른 경로:                                 │
│   domain/ → ports/ (interface)              │
│          → infra/ (implementation)          │
│                                             │
│ [규칙 보기]  [에이전트에게 수정 요청]        │
└─────────────────────────────────────────────┘
```

**L4 — Arch Drift 패널** (Top Bar 클릭 또는 ⌘A)
```
┌─────────────────────────────────────────────┐
│ Architecture Health                  [×]    │
│ ─────────────────────────────────────────── │
│ 위반  3개     경고  7개     정상  ✓          │
│                                             │
│ 위반 목록                                   │
│  ⛔ domain/order.ts:42  → infra/database    │
│  ⛔ domain/payment.ts:18 → infra/redis      │
│  ⛔ api/handler.ts:9    → core/engine       │
│                                             │
│ Drift 추세 (최근 30일)                      │
│  payments ↔ auth    : 3 → 14 refs (+367%)  │
│  orders ↔ shipping  : 8 → 23 refs (+188%)  │
│  ⚠ 예측: 6개월 내 순환 의존 발생            │
│                                             │
│ [에이전트에게 일괄 수정 요청]               │
└─────────────────────────────────────────────┘
```

**팀 정책 연동** (`p0.config.json`):
```json
{
  "arch_rules": [
    { "from": "domain/", "to": "infra/", "rule": "deny_direct" },
    { "from": "api/",    "to": "core/",  "rule": "deny_direct" }
  ]
}
```
규칙 없으면 `spec_mining`으로 기존 코드에서 자동 추출 제안.

---

### 신규-B. Spec Mining — 암묵적 규칙 자동 발견 (P1)

**한 줄**: 코드베이스를 분석해서 "팀이 지금까지 암묵적으로 지켜온 패턴"을 자동으로 찾아낸다.

#### 왜 필요한가

Architecture Guardrails는 규칙을 사람이 직접 써야 한다. 근데 대부분 팀은 규칙이 문서화 안 돼 있다 — "그냥 다들 그렇게 해왔음". Spec Mining이 코드에서 그 패턴을 추출해서 Guardrails 규칙으로 제안한다. "이 코드베이스에서 항상 X → Y 순서로 호출하더라 — 이걸 규칙으로 등록할까요?"

#### 엔진

`spec_mining` · `spec_verification` (wired)

#### UX

**진입점**: Architecture Health 패널 하단

```
┌─────────────────────────────────────────────┐
│ Discovered Patterns                         │
│ ─────────────────────────────────────────── │
│ 코드베이스에서 발견된 암묵적 규칙:           │
│                                             │
│ 1. validate() 항상 db.write() 전에 호출     │
│    근거: 47개 파일에서 일관됨               │
│    위반 가능성: 3곳                         │
│    [Guardrail로 등록]  [무시]               │
│                                             │
│ 2. PaymentService는 항상 idempotency key   │
│    파라미터를 받음                          │
│    근거: 12개 메서드에서 일관됨             │
│    [Guardrail로 등록]  [무시]               │
└─────────────────────────────────────────────┘
```

Architecture Guardrails의 규칙 자동 생성 소스 — 둘이 세트로 동작.

---

### 신규-C. Typestate Overlay (P1)

**한 줄**: 객체 라이프사이클 위반 — "닫힌 연결 재사용", "초기화 전 호출" — 을 라인에 표시.

#### 왜 필요한가

Blast Radius는 "얼마나 퍼지냐", Taint는 "데이터가 어디로 가냐"다. Typestate는 "이 객체가 지금 쓸 수 있는 상태냐" — 세 번째 축. AI가 생성한 코드에서 특히 많이 나오는 패턴: DB 커넥션 닫고 나서 쿼리, 파일 핸들 해제 후 write. Incident DNA의 의미론적 근거도 여기서 나온다.

#### 엔진

`typestate_analysis` (wired)

#### UX

**L1 — Gutter**
```
  67  │ 💀 │  conn.query(sql)
                ↑ conn이 이미 close() 된 상태
```

**hover**
```
┌─────────────────────────────────────────────┐
│ 💀 Typestate Violation                      │
│ conn: closed → query() 불가                 │
│                                             │
│ close() 호출 위치: line 61                  │
│ 현재 상태: CLOSED                           │
│ 필요 상태: OPEN                             │
│                                             │
│ [에이전트에게 수정 요청]                    │
└─────────────────────────────────────────────┘
```

Incident DNA Mapping과 연결: typestate 위반 패턴이 과거 장애와 매칭되면 즉시 경고.

---

### 신규-D. Symbolic Simulation (Simulate Change 완성) (P1)

**한 줄**: 코드 수정 전에 — 실행 없이 — "이 조건이 바뀌면 어떤 실행 경로가 새로 열리냐"를 보여준다.

#### 기존 ideanote와의 관계

RFC에 "Simulate Change"가 P0로 있지만 ideanote에 구체적 구현이 없다. 이게 그 구현 명세다.

#### 엔진

`symbolic_execution` (partial, 34/100) + `behavior_diff` + `abstract_interpret`

> partial이지만 포트/설정 슬롯은 있음. `behavior_diff`와 `abstract_interpret`로 대부분의 케이스 커버 가능. symbolic_execution은 path feasibility 정밀도 향상 용도.

#### UX

우클릭 → `Simulate change` (⌘⇧S) → 우측 슬라이드 패널:

```
┌─ Simulate ──────────────────────────────────┐
│ Diff                                        │
│   - if (amount > 0)                         │
│   + if (amount >= 0)                        │
│                                             │
│ 새로 열리는 실행 경로                        │
│   amount === 0  →  processRefund() 실행됨   │
│   amount === 0  →  db.update() 도달 가능    │
│                                             │
│ Impact delta                                │
│   Blast              31 → 37  (+6)          │
│   Taint paths        2 → 3   (+1)           │
│                                             │
│ 새 taint path                               │
│   req.body.amount(0) → db.update            │
│                                             │
│ Confidence   high                           │
│ ─────────────────────────────────────────── │
│         Discard              Apply          │
└─────────────────────────────────────────────┘
```

"새로 열리는 실행 경로" 섹션이 핵심 — 숫자 변화(blast +6)보다 **"어떤 케이스가 새로 실행되냐"**가 개발자한테 더 직관적.

---

### 신규-E. AI Contribution Heatmap (P2)

**한 줄**: 파일 트리에서 AI가 생성한 코드 비율을 시각화. AI 밀도 높은 영역 = 구조 검증 우선순위.

#### 왜 필요한가

AI native 개발이 많아질수록 "이 코드 누가 책임지나"가 불분명해진다. 단순히 git blame으로는 "AI가 썼다"는 걸 알아도 "이 영역이 얼마나 AI 의존적이냐"를 팀 단위로 보기 어렵다. Heatmap이 있으면 Guardrails 검증 우선순위를 잡는 기준이 된다.

#### 엔진

`git_history` + commit metadata (AI tool signature 파싱)

#### UX

파일 트리 옆에 얇은 히트맵 바:

```
  src/
  ▸ payments/   ████████░░  82% AI
  ▸ auth/       ████░░░░░░  41% AI
  ▸ core/       ░░░░░░░░░░   8% AI   ← 손코딩 비중 높음
```

- AI 비율 높은 디렉토리 → Guardrails 위반 / Clone Detection 자동 우선 실행
- 클릭 → 파일별 상세 (어떤 AI 툴, 어떤 커밋)

---

### 신규-F. Dead Code Cascade (P1 격상 후보)

**한 줄**: dead code 하나 제거할 때 연쇄적으로 죽는 코드까지 미리 보여주고 한 번에 제거.

#### 기존 ideanote와의 관계

P2-C Clone Detection이 있지만 Dead Code는 별도. RFC에 언급됐지만 ideanote에 구체적 UX가 없다.

#### 엔진

`dead_code` · `call_graph` · `import_graph` (모두 wired)

#### UX

**L2 — 인라인 힌트**
```
  8  │ dead │  function sendWebhook() {
```

**hover**
```
┌─────────────────────────────────────────────┐
│ 💤 Dead Code                                │
│ sendWebhook() — 사용처 없음                  │
│                                             │
│ 제거하면 연쇄 dead:                          │
│   WebhookBuilder   → dead                  │
│     retryConfig    → dead                  │
│       총 3파일, 847줄                       │
│                                             │
│ [전체 미리보기]  [한 번에 제거]             │
└─────────────────────────────────────────────┘
```

**[전체 미리보기]** → L4 패널: 제거 대상 파일 트리 + 각 파일의 영향 줄 수 + behavior 영향 없음 확인.
**[한 번에 제거]** → Agent에 cascade 목록 전달 → 검증 후 적용.

AI가 찍어낸 코드에서 쓰이지 않는 함수/클래스가 쌓일수록 이 기능의 가치가 올라간다.

---

### 우선순위 업데이트

| 기능 | 제안 우선순위 | 엔진 | 이유 |
|---|---|---|---|
| Architecture Guardrails | **P1** | wired | RFC 핵심 차별화. AI 시대 포지셔닝 완성 |
| Spec Mining | **P1** | wired | Guardrails 세트. 규칙 자동 생성 |
| Dead Code Cascade | **P1** | wired | AI 코드 누적 → 수요 직결 |
| Symbolic Simulation | **P1** | partial+wired | Simulate Change 구현체. 데모 킬러 |
| Typestate Overlay | **P1** | wired | Incident DNA 근거. 세 번째 분석 축 |
| AI Contribution Heatmap | **P2** | git + metadata | Guardrails 우선순위 기준. AI native 팀 타겟 |

---

### 핵심 가치 (실사용 기준)

> AI 코딩 도구는 '코드를 더 빨리 쓰는 것'을 도왔다.
> 이 제품은 'AI가 쓴 코드를 믿을 수 있게 만드는 것'을 한다.
> 엔진이 분석하고, 게이트가 검증하고, 개발자가 결정한다.
> 매일 8시간 켜놓는 도구다. 첫 5분이 아니라 100일째에도 가치 있어야 한다.
