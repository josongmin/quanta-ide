# RFC: Flow-Aware Analysis Surfacing

**날짜**: 2026-04-12
**상태**: 기획 중
**작성**: Jo

---

## 한 줄 정의

> **정적분석 결과를 *언제* 보여줄지 아는 IDE.** 코드가 흔들리는 동안엔 침묵하고, 작업이 한 호흡 끝난 순간에만 입을 연다.

---

## 문제 (Problem)

현재 blast-radius 인라인 배너는 **타이핑 직후마다** 등장한다. 화면을 가로로 가르는 카드가 코드 흐름을 끊고, 사용자의 시야를 점유한다.

근본 문제는 시각 디자인이 아니라 **타이밍**이다.

사용자가 10단계 리팩터링 중 5단계에 있을 때, 정적분석은 그 중간 상태를 *최종 의도*로 오해하고 "21 files 영향!"이라고 외친다. 사용자는:

1. 그게 자기가 의도한 끝 모양이 아님을 알고 있다
2. 그래서 배너를 무시한다
3. 무시가 습관이 되면 진짜 신호도 무시한다 (**banner blindness**)
4. 그 사이에도 매번 시야는 한 번씩 끊긴다

정적분석의 가치는 "안정된 상태에서의 구조적 통찰"인데, 현재 UX는 "타이핑 중 잔소리"로 소비되고 있다. 이건 엔진이 아무리 정확해도 풀리지 않는 *delivery 문제*다.

### 비용

- **복귀 비용**: Parnin & Rugaber — 한 번 끊긴 프로그래머는 코드 편집 재개까지 평균 10–15분, 최소 7분. 잘못된 시점의 배너 한 번이 15분을 태운다.
- **신뢰 침식**: 거짓 경보가 반복되면 confidence 0.88도 0.0처럼 취급된다. 엔진의 신뢰도가 UX 타이밍 때문에 깎인다.
- **차별화 손실**: Quanta가 "구조를 아는 IDE"를 표방하면서 "사용자의 작업 리듬은 모르는 IDE"로 보이면 정체성에 균열이 간다.

---

## 학술적 근거 (Why this is solvable)

이 문제는 HCI에서 20년 가까이 연구된 영역이다. 우리가 새로 발명할 게 아니라, **검증된 패턴을 정적분석 도메인에 처음 제대로 이식**하는 것이다.

### Breakpoint theory (Iqbal & Bailey, CHI 2008)

사람의 작업은 인지적으로 fine → medium → **coarse breakpoint** 의 계층을 갖는다. Coarse breakpoint(작업 묶음의 끝)에서 알림을 주면 frustration이 가장 낮다.

- Attelia 시스템: breakpoint 타이밍 알림이 random 타이밍 대비 **frustration 28% 감소**
- Programming task에서 통계적 breakpoint detection recall **59%**

### Memory load 기반 억제 (Fogarty et al.)

pupillometry로 측정한 working memory peak 시점에 알림을 주면 disruption이 최대. 즉 **타이핑이 활발한 = 메모리 부하가 높은 = 침묵해야 할 시간**.

### OASIS framework (Microsoft Research, TOCHI)

알림 전달을 **사용자 attention state에 매칭**하는 3-tier 모델: ambient → peripheral → focal. 침습성과 정보량을 점진적으로 escalate.

### Ripple effect computation

정적분석 자체는 변경 시점마다 즉시 계산할 수 있다 — 문제는 계산이 아니라 **언제 표시할지**이다. 우리는 계산은 그대로 두고, **표시 정책만 분리**한다.

---

## 설계 원칙 (Principles)

1. **계산과 표시의 분리.** 분석은 항상 즉시 실행한다. 결과는 *내부 버퍼*에 누적되고, 표시는 별도 정책이 결정한다.
2. **코드가 흔들리는 동안 침묵.** "in flux"인 영역에 대해선 아무것도 surfacing하지 않는다 — confidence가 아니라 *stability*가 게이트다.
3. **Coarse breakpoint에서만 발화.** fine breakpoint(한 줄 수정 후 0.5초 멈춤)는 무시. 파일 저장, idle 30s+, 함수 단위 편집 종료, 테스트 통과 같은 *작업 리듬의 호흡 지점*에서만.
4. **3-tier escalation.** ambient(거터) → peripheral(status bar) → focal(카드). 인라인 takeover 카드는 *절대 자동으로 띄우지 않는다*. 사용자의 명시적 attention(hover/click) 없이는 시야를 점유하지 않는다.
5. **사용자가 스스로 게이트를 열 수 있어야 한다.** "지금 보여줘"는 항상 한 키스트로크 거리에 있다 (e.g. `⌘.`).

---

## 메커니즘 (Mechanism)

### M1. Stability Tracker

각 코드 영역(파일/함수 단위)에 대해 **stability score**를 실시간 계산:

- 최근 N초 동안 키스트로크 빈도
- 같은 라인 범위 재편집 횟수
- 미저장 변경의 양
- 마지막 안정점(저장/idle)으로부터 경과 시간

점수가 낮으면 (in flux) → 해당 영역의 분석 결과는 **표시 큐에서 제외**. 거터 글리프조차 흐릿하게 처리하거나 숨김.

### M2. Breakpoint Detector

작업의 호흡 지점을 통계적으로 감지:

- **Hard signals** (확실한 coarse breakpoint): 파일 저장, 빌드 트리거, 테스트 실행, 커밋, 브랜치 전환, 포커스 다른 파일로 이동
- **Soft signals** (medium breakpoint): 30s+ idle, 함수 본문 편집 종료(괄호 균형 + 일정 시간), 스크롤 정지
- **Suppression**: 디버거 활성, 자동완성 메뉴 열림, 빠른 연속 편집 burst

Hard signal에서는 즉시 flush, soft signal에서는 confidence가 임계치 이상일 때만 flush.

### M3. Surface Policy (5-tier)

| Tier | 위치 | 트리거 | 정보량 | 시야 점유 |
|--|--|--|--|--|
| **0. Persistent (Watcher)** | 하단 패널 Watcher 탭 + 좌측 아이콘 rail | 항상 살아있음 | vitals + sparkline + activity feed | 코드 0, 하단 영역 |
| **1. Ambient** | 거터 글리프, minimap 스트립 | stability ≥ τ_low | 색/아이콘만 | 0 |
| **2. Peripheral** | status bar pill | hard breakpoint | "21 files · 0.88" | 하단 한 칸 |
| **3. Focal** | 우측 사이드 패널 | 사용자 hover/click/단축키 | 전체 impacted files, diff, fix 액션 | 명시적 |
| **4. Retrospective** | floating sheet (envelope 종료 시) | envelope close | net impact / churn / avoided | 작업 종료 후 |

**인라인 takeover 카드는 폐지. Tier 3 focal로만 정보 노출.**

핵심: Tier 0(Watcher)이 *항상 살아있는 동반자*로서 사용자의 침묵 정책에 대한 불안을 흡수한다. Tier 1·2는 Watcher가 보조 신호로 쓰일 때 더 보수적으로 침묵할 수 있다.

### M4. Task Envelope (차별화 포인트)

가장 야심찬 레이어. 사용자가 명시적 또는 암묵적으로 **작업 envelope을 선언**:

- **암묵적**: 새 브랜치 생성, 첫 변경 발생 시 자동으로 envelope 열림
- **명시적**: `⌘⇧E` 또는 우측 패널의 "Start task" 버튼

Envelope이 열려 있는 동안:
- 모든 분석은 *내부적으로만 누적*
- Surface는 ambient tier만 유지
- Peripheral/Focal은 사용자가 명시적으로 요청할 때만

Envelope이 닫힐 때 (commit, 명시적 종료, 장시간 idle):
- **누적된 변경 전체에 대해** blast radius를 한 번에 계산
- "이 작업이 시스템에 미친 영향" 카드를 *작업 후 회고* 형태로 제공
- 중간 노이즈 0, 최종 신호 1

이게 Quanta의 **"정적분석을 *언제* 신뢰할지 아는 IDE"** 정체성의 구체적 구현이다.

---

## UX 명세 (What the user will see)

### Before vs After 한눈에

**Before**: 타이핑 직후마다 인라인 배너가 코드를 가르고 등장. 21 files 경고가 5초마다 깜빡임. 사용자가 무시 → banner blindness.

**After**: 코드 영역은 항상 코드만 보인다. 분석 신호는 거터/하단 Watcher/우측 패널로 분산되고, 사용자가 부르지 않는 한 코드 라인 사이에 무엇도 끼어들지 않는다. *항상 옆에서 숨 쉬는 Watcher*가 침묵 정책에 대한 불안을 흡수한다.

---

### 전체 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│                            GNB                                  │
├──┬──────────────┬─────────────────────────┬────────────────────┤
│  │              │                         │                    │
│  │   Explorer   │                         │   우측 사이드 패널    │
│  │    src/      │     코드 에디터 + 오버레이   │   (Tier 3 Focal)    │
│  │    docs/     │                         │   call graph,      │
│  │    ...       │                         │   blast radius,    │
│  │              │                         │   기존 유지          │
│  │              │                         │                    │
│  ├──┬───────────┴─────────────────────────┤                    │
│  │⚡│ Watcher │ Lint │ Console │ Quick... │                    │
│  │● ├───────────────────────────────────────┤                    │
│  │  │  하단 패널 (Watcher / Lint / Console / │                    │
│  │  │  Quick analyze 등이 탭으로 사는 곳)      │                    │
│  │  │                                       │                    │
├──┴──┴───────────────────────────────────────┴────────────────────┤
│                       하단 푸터뷰 (status bar)                     │
└─────────────────────────────────────────────────────────────────┘
```

**좌측 신설 아이콘 rail**: 하단 패널의 *부모 탭* 역할. ⚡(Watcher), Lint, Console, Quick analyze 등 분석 도구들의 진입 아이콘이 세로로 배치됨. 클릭 시 하단 패널이 해당 탭으로 전환/expand. Activity bar(VSCode)와 다른 점: 사이드바가 아니라 *하단 패널*을 컨트롤한다.

---

### Tier 0 — Live Watcher (항상 옆에서 숨 쉬는 동반자)

Quanta의 시그니처 표면. 침묵 정책의 짝이 되는 *항상성 신호*.

#### 진입점: 좌측 아이콘 rail의 ⚡

- 위치: 하단 패널 좌측에 신설된 아이콘 rail의 최상단
- 아이콘: ⚡ + 우측 하단에 작은 **상태 dot**
  - 초록 (solid): stable, 신호 신뢰 가능
  - amber (점선): in flux, 분석 진행 중
  - red (solid): critical blast radius 또는 architecture violation
- envelope이 열려 있으면 아이콘에 작은 ● badge — "지금 작업 중"
- 클릭: 하단 패널이 닫혀 있으면 열고 Watcher 탭으로 점프, 이미 Watcher 탭이면 토글
- **이 아이콘은 하단 패널이 접혀 있을 때도 항상 보임** → Watcher의 존재가 시야 끝에 상시 유지

#### Watcher 탭 내부 (가로 3-column + 하단 feed)

하단 패널은 가로로 길고 세로로 짧음. 그 형태에 맞춘 구조:

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚡ Watcher │ Lint │ Console │ Quick Analyze │ Problems │     ⌃─⌄    │
├────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌─────────────────────┐ ┌─────────────────────────┐ │
│ │  21 files  │ │ ▁▃▅▇▅▃▂▁▂▁         │ │ Now watching            │ │
│ │ ↓converging │ │ 54→38→21 (last 14m) │ │ → strategy_selector.py  │ │
│ │ ● stable   │ │                     │ │ → 2 API paths           │ │
│ └────────────┘ └─────────────────────┘ └─────────────────────────┘ │
│ ───────────────────────────────────────────────────────────────────│
│ Activity                                                            │
│ 14:32  saved auth.ts                                                │
│ 14:31  ⚡ blast radius converged 38 → 21                            │
│ 14:28  ⚠ architecture rule transient violation (auto-resolved)     │
│ 14:25  envelope started · feat/routing-refactor                    │
└────────────────────────────────────────────────────────────────────┘
```

**Column 1 — Vitals (폭 200px)**

- 큰 숫자: 현재 blast radius (`21 files`)
- 한 줄 트렌드: `↓ converging` / `↑ diverging` / `→ stable`
- stability dot: 초록/amber/red

**Column 2 — Sparkline (가변)**

- 가로 sparkline: 현재 envelope 동안 blast radius 변화 시계열
- 좌측에 시작점, 우측에 현재. 텍스트로 `54 → 38 → 21 (last 14m)`
- in flux 동안엔 sparkline 끝부분이 점선
- **수렴/발산을 시각화** — 사용자가 "내가 잘 가고 있는지" 자기 진단

**Column 3 — Now watching (폭 240px)**

- 엔진이 현재 주의 깊게 보고 있는 대상 1–3개
- "→ strategy_selector.py (high churn)"
- "→ 2 API paths potentially affected"
- 클릭 시 해당 파일/리소스로 점프

**하단 — Activity feed (가변, 스크롤)**

- envelope 동안 일어난 일을 시간 역순으로
- saved/blast radius 변화/transient warning auto-resolved/envelope start 등
- 각 항목 클릭 시 해당 시점의 스냅샷/diff로 점프
- **핵심 가치**: 사용자가 침묵 동안에도 "엔진이 나를 보고 있었구나"를 사후 확인 가능

#### 높이별 적응형 표시

| 하단 패널 높이 | 노출 |
|--|--|
| **접힘 (28px)** | 탭 바만, Watcher 아이콘 + 상태 dot은 좌측 rail에 상시 노출 |
| **Compact (120px)** | 3-column vitals만, feed 숨김 |
| **Default (240px)** | 3-column + feed 4–5줄 |
| **Expanded (400px+)** | 3-column + feed 전체 스크롤 |

같은 컴포넌트가 높이에 따라 *순차적으로 펼쳐지는* 구조. 별도 모드 전환 없음.

#### Watcher 탭이 닫혀 있을 때의 폴백

- 하단 패널이 다른 탭(Lint, Console 등)을 보여주고 있어도 좌측 rail의 ⚡ 아이콘 + dot은 *항상* 보임
- 하단 패널 자체가 접혀 있으면 status bar pill (Tier 2)이 그 역할을 대신함
- 즉 **Watcher 아이콘 / Watcher 탭 / status bar pill 중 항상 하나는 살아있음**. 어떤 레이아웃에서도 동반자가 사라지지 않음

#### 모션 / 행동 양식

- 숫자 변화: 300ms tween. 깜빡임 금지
- sparkline: 새 데이터 포인트 추가 시 부드럽게 좌측으로 흐름 (200ms)
- 상태 dot 색 변화: 200ms crossfade
- in flux → stable 전환 시 *한 번만* 외곽 ring soft pulse 200ms
- Activity feed에 새 항목 추가 시 상단에서 8px slide-down + fade-in 200ms

---

### Tier 1 — Ambient (항상 존재, 시야 점유 0)

**거터 글리프**

- 위치: 라인 번호 우측, breakpoint column과 별도의 dedicated column (폭 12px)
- 아이콘: ⚡ (blast radius), ⚠ (architecture violation), ◆ (taint)
- 색: 영향 규모로 단계 — 무채색(≤5 files) / amber(6–20) / red(21+)
- **흐림 상태 (in flux)**: opacity 0.25, blur 0.5px, 무채색 고정. stability score < τ_low인 동안 유지
- **또렷 상태 (stable)**: opacity 1.0, 색 입혀짐
- 전환 애니메이션: 250ms ease-out opacity + color crossfade. 휙 나타나지 않고 *서서히 나타나서* peripheral vision에 거슬리지 않음
- hover (300ms 지연): tier 3 카드 호출

**Minimap 우측 스트립**

- 폭 4px, 거터 글리프와 같은 색 매핑
- 파일 전체에서 영향 받는 라인 위치를 한눈에 — "어디가 흔들리고 있는지" 공중 사진처럼
- 클릭 시 해당 라인으로 점프

**원칙**: ambient는 *움직이지 않는다*. 깜빡임, 슬라이드, 카운트업 모두 금지. 사용자가 능동적으로 봤을 때만 정보가 있다.

---

### Tier 2 — Peripheral (호흡 지점에서 한 번 등장)

**Status bar pill**

- 위치: 하단 status bar 우측 영역 (Git branch 옆)
- 모양: 둥근 사각형, 높이 18px, 좌측에 ⚡ 아이콘 + 텍스트 `21 files · 0.88`
- 배경: 영향 규모 색의 12% tint (무채색/amber/red)
- 텍스트: 영향 파일 수 + confidence. 작업 envelope이 열려 있으면 누적값 + delta 표시 (e.g. `34 files (+13)`)

**등장 인터랙션**

- 트리거: hard breakpoint 발생 시 (저장/빌드/idle 등)
- 애니메이션: 우측에서 슬라이드 인 200ms + 첫 등장 시 *한 번만* 200ms soft pulse (외곽 ring)
- pulse 이후 완전 정적. 같은 분석이 갱신돼도 텍스트만 in-place 교체, 애니메이션 없음
- 사용자가 한 번이라도 클릭한 적 있으면 이후 pulse 생략 (학습됨)

**사라짐**

- 작업 envelope이 닫히거나 변경이 0이 되면 200ms 페이드 아웃
- 사용자가 명시적으로 dismiss하면 해당 envelope 동안 재등장 없음

**hover (300ms 지연)**

- pill 위에 작은 popover (240×120): 영향 규모 sparkline, top 3 파일, "Show details" 버튼
- popover는 클릭 없이 마우스만 떼면 100ms 후 사라짐 (코드 가리지 않음)

**클릭**: tier 3 패널 열림

---

### Tier 3 — Focal (사용자가 명시적으로 부를 때만)

**Blast Radius 패널**

- 위치: 우측 패널 (현재 우측 패널과 통합). **인라인 takeover 카드는 폐지**
- 폭: 기본 360px, 드래그 가능
- 진입 방식:
  - status bar pill 클릭
  - 거터 글리프 클릭 또는 1초 hover
  - 키보드 단축키 `⌘.` (커서 위치 기준)
  - 우측 패널 탭 직접 클릭

**패널 구조** (위에서 아래로):

1. **헤더** (40px)
   - 좌: ⚡ + `21 files affected` (큰 글씨)
   - 우: confidence bar (0.88) + stale 표시 (`5mo`)
   - 헤더는 sticky

2. **요약 카드** (80px)
   - 한 줄 자연어 요약: "Routing decision change propagates through strategy selection, affecting 21 files and 2 API paths."
   - 우측에 작은 sparkline: 최근 envelope 동안 영향 규모 변화

3. **Impacted files 리스트** (가변)
   - 그루핑: 모듈/디렉토리 별 collapsible
   - 각 파일: 경로 + 변경 라인 수 + risk badge
   - 클릭 시 좌측 에디터에 파일 열림 + 영향 라인으로 스크롤
   - 호버 시 좌측 에디터에 *임시 하이라이트* (마우스 떼면 사라짐) — 전체 파일을 열지 않고 미리보기

4. **API path / call graph 미니뷰** (160px)
   - 영향이 닿는 entry point들을 노드로 표시
   - 클릭 시 우측 패널 탭이 call graph 뷰로 전환

5. **액션 바** (하단 sticky, 48px)
   - `Migrate safely` (primary, agent 호출)
   - `Mark as reviewed` (envelope 메모)
   - `Snooze` (이 envelope 동안 다시 안 보이게)

**닫기**: ESC, 패널 토글 단축키, 또는 다른 우측 패널 탭으로 이동

---

### Tier 4 — Task Envelope 회고 카드

**언제**: envelope이 닫히는 순간 (commit, 명시적 종료, 30분+ idle)

**어디**: 화면 중앙 하단에 modal이 아닌 floating sheet (폭 480px)

**구조**:

- 헤더: `Task complete · 47 minutes · 12 commits worth of change`
- 본문 (3 섹션):
  1. **Net impact**: "이 작업이 시스템에 미친 *최종* 영향" — 21 files, 2 API paths, 0 architecture violations
  2. **Internal churn**: "작업 중 거쳐간 중간 상태" — 87 intermediate edits, peak blast radius 54 files (지금은 21로 수렴)
  3. **What was avoided**: 작업 중 trigger됐다가 안정화로 사라진 false alarm 수 — "12 transient warnings auto-resolved" (사용자에게 *우리가 침묵해준 가치*를 보여줌)
- 액션: `Review diff` / `Open PR` / `Dismiss`

**행동 양식**: 회고 카드는 화면 중앙 가까이 떠도 OK — 작업이 *이미 끝난* 시점이라 코드 흐름을 끊지 않음. 등장 애니메이션은 부드러운 fade + 8px slide-up, 300ms.

---

### In-flux 표시 (사용자가 코드를 흔들고 있는 동안)

사용자가 활발히 타이핑 중일 때:

- 거터 글리프: 흐림 상태로만 존재 (위 ambient 명세)
- minimap 스트립: 해당 라인 영역만 옅은 회색 hatching 패턴
- status bar pill: 텍스트 회색, 끝에 작은 점 3개 애니메이션 (`21 files · ···`) — *계산은 돌고 있음*을 알리되 숫자는 신뢰하지 말라는 신호
- focal 패널: 사용자가 명시적으로 열어두었으면 그대로 유지하되, 헤더에 `Updating…` 라벨 + 내용 dim 80%

**중요**: in-flux 동안에도 사용자가 명시적으로 `⌘.`을 누르면 *현재 시점의 best-effort* 결과를 즉시 보여준다. 침묵은 디폴트이지 강제가 아니다.

---

### 키보드 단축키

| 키 | 동작 |
|--|--|
| `⌘.` | 현재 커서 위치의 blast radius 패널 열기/닫기 |
| `⌘⇧.` | 현재 envelope 전체의 blast radius 보기 |
| `⌘⇧E` | Task envelope 시작/종료 토글 |
| `ESC` | 열린 focal 패널/회고 카드 닫기 |

---

### 컬러 / 모션 토큰 (디자인 시스템 연결)

- **색**: 기존 DS의 `--ds-color-warning-{subtle,default,strong}` 재사용. 새 토큰 없음
- **모션**: 모든 전환은 `--ds-motion-ease-out` (250ms 이하). spring/bounce 금지
- **그림자**: focal 패널은 기존 floating shadow 토큰 (3-layer Y-biased) 사용
- **타이포**: pill/badge는 `--ds-font-mono-sm`, 패널 본문은 `--ds-font-sans-md`

---

### 절대 금지 (Anti-patterns)

- ❌ 코드 라인 사이에 끼어드는 인라인 takeover 카드 (현재 패턴)
- ❌ 타이핑 중 깜빡이는 알림
- ❌ 모달 다이얼로그
- ❌ 빨간색 + 사운드
- ❌ "확인하지 않으면 사라지지 않는" persistent badge
- ❌ count-up 애니메이션 ("3... 7... 21 files!")
- ❌ 자동으로 우측 패널을 강제로 여는 동작

---

## 단계 (Phases)

### Phase 1 — Stop the bleeding (1주)

- 현재 인라인 배너를 **status bar pill로 강등**
- 키스트로크 burst 감지 시 모든 surfacing suppression
- 거터 글리프 ambient tier 도입
- **목표**: 시야 점유 즉시 제거, 사용자 체감 개선 측정

### Phase 1.5 — Watcher minimal (1–2주)

- 좌측 신설 아이콘 rail 도입 (하단 패널의 부모 탭 컨트롤)
- ⚡ Watcher 아이콘 + 상태 dot (stable/in flux/critical)
- Watcher 탭 minimal: vitals 3-column (큰 숫자 + sparkline + now-watching)만, feed 없이
- 하단 패널 접힘/펼침 상태 동기화
- **목표**: 침묵 정책의 짝이 되는 *항상성 신호* 확보. 사용자가 "엔진이 나를 보고 있다"를 느낌

### Phase 2 — Stability + Breakpoint (2–3주)

- M1 Stability Tracker 구현
- M2 Breakpoint Detector hard signals만 우선
- Surface Policy 3-tier 분리
- **목표**: "in flux" 영역 침묵, hard breakpoint에서만 발화

### Phase 3 — Soft breakpoints + tuning (2주)

- Idle, 함수 종료, 스크롤 정지 등 soft signals 추가
- Suppression 룰(디버거, 자동완성) 정비
- 임계치(τ_low, τ_high, idle 윈도우)를 dogfood로 튜닝
- **목표**: false positive(불필요한 flush) ≤ 5%

### Phase 4 — Task Envelope + Watcher full (3–4주)

- 암묵적 envelope (브랜치 + 첫 변경 감지)
- 명시적 envelope UI (Start/End task)
- Envelope 닫힘 시 누적 blast radius 회고 카드 (Tier 4)
- Watcher Activity feed 완성 (시간 역순, 클릭 시 스냅샷 점프)
- Watcher Now-watching 동적 갱신
- 좌측 rail의 ⚡ 아이콘에 envelope ● badge
- **목표**: Quanta의 차별화 포인트로 외부 demo 가능 수준

### Phase 5 — Personalization (탐색)

- 사용자별 breakpoint 패턴 학습
- "이 사용자는 함수 끝에서 30s 쉰다" 같은 통계로 임계치 자동 조정
- Opt-in pupillometry/eye-tracking 통합 탐색 (장기)

---

## 측정 (How we know it works)

- **Banner dismissal rate**: 사용자가 surfacing을 무시/닫는 비율. 현재 → Phase 2 후 측정.
- **Time-to-action**: surfacing이 뜬 후 사용자가 액션을 취하기까지 걸린 시간. 짧을수록 신호가 적중.
- **Flow uninterrupted streak**: 사용자가 끊김 없이 코딩한 평균 구간 길이.
- **False flush rate**: surfacing이 떴는데 사용자가 무시한 비율 (target ≤ 5%).
- **정성**: dogfood 사용자 인터뷰 — "방해받았다" 빈도.

---

## 위험 (Risks)

1. **너무 침묵해서 진짜 위험을 놓침.** Phase 2 이후 dogfood에서 critical blast radius가 묻히는 사례가 나오면 hard breakpoint 정의를 더 공격적으로 (e.g. 함수 종료를 hard로 승격).
2. **Breakpoint detection 오감지.** 59% recall은 *학술 기준*이지 우리 도메인 fit이 아닐 수 있다. Phase 3 튜닝 기간에 충분히 시간을 둔다.
3. **Task envelope의 명시적 UX가 귀찮아진다.** 암묵적 감지를 우선하고, 명시적은 power user only로 위치시킨다.
4. **사용자가 status bar pill을 알아차리지 못함.** 첫 등장 시 한 번 spotlight 애니메이션, 이후 무음.

---

## 결정 필요 (Open questions)

- Phase 1을 단독 릴리즈로 낼 것인가, Phase 1.5와 묶어서 낼 것인가?
- Task envelope의 디폴트는 *암묵적 always-on*인가, *opt-in*인가?
- Status bar pill 자리: 좌측(파일 정보 옆) vs 우측(알림 영역)?
- 거터 글리프가 다른 LSP diagnostic과 충돌하지 않게 별도 column을 둘 것인가?
- Watcher 탭이 첫 실행 시 디폴트로 활성인가, Lint/Problems가 디폴트이고 첫 envelope 시작 시점에 Watcher로 자동 전환인가?
- 좌측 신설 아이콘 rail의 폭 (32px vs 48px)? Activity bar(VSCode) 컨벤션과 시각 충돌 없게.
- 하단 패널 디폴트 높이: Compact(120px) vs Default(240px)? 첫 인상 vs 화면 여백.

---

## 참고 (References)

- [Breaking the Flow: A Study of Interruptions (ICSE 2024)](https://kjl.name/papers/icse24.pdf)
- [Effects of Intelligent Notification Management — Iqbal & Bailey, CHI 2008](https://interruptions.net/literature/Iqbal-CHI08.pdf)
- [OASIS: Linking Notification Delivery to Task Structure — Microsoft Research, TOCHI](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/TOCHI-Oasis-final.pdf)
- [Programmer, Interrupted — Parnin](https://www.gamedeveloper.com/programming/programmer-interrupted)
- [Analyzing the Ripple Effects of Refactoring (EMSE)](https://www.researchgate.net/publication/396929467_Analyzing_the_Ripple_Effects_of_Refactoring)
- [Refactoring made right — Kiro](https://kiro.dev/blog/refactoring-made-right/)
- [Intent: A workspace for agent orchestration — Augment Code](https://www.augmentcode.com/blog/intent-a-workspace-for-agent-orchestration)
