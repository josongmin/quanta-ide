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

### M3. Surface Policy (3-tier)

| Tier | 위치 | 트리거 | 정보량 | 시야 점유 |
|--|--|--|--|--|
| **Ambient** | 거터 글리프, minimap 스트립 | stability ≥ τ_low | 색/아이콘만 | 0 |
| **Peripheral** | status bar pill | hard breakpoint | "21 files · 0.88" | 하단 한 칸 |
| **Focal** | 카드/패널 | 사용자 hover/click/단축키 | 전체 impacted files, diff, fix 액션 | 명시적 |

**현재 인라인 takeover 카드는 Focal로만 사용 가능. 자동 발화 금지.**

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

## UX 변경 요약 (What the user will see)

**Before**: 타이핑 직후마다 인라인 배너가 코드를 가르고 등장. 21 files 경고가 5초마다 깜빡임.

**After**:
- 타이핑 중: 거터에 ⚡ 글리프가 흐릿하게 (in flux). 그 외 침묵.
- 저장 직후: 거터 글리프가 또렷해지고, status bar에 `⚡ 21 files · 0.88` pill 등장.
- 사용자가 pill을 클릭하거나 거터 글리프에 hover: Focal 카드 펼침 (현재의 21-files 카드).
- 사용자가 envelope을 닫거나 커밋: "이 작업의 총 영향" 회고 카드.

인라인 takeover 카드는 사용자가 부르지 않는 한 절대 자동으로 뜨지 않는다.

---

## 단계 (Phases)

### Phase 1 — Stop the bleeding (1주)

- 현재 인라인 배너를 **status bar pill로 강등**
- 키스트로크 burst 감지 시 모든 surfacing suppression
- 거터 글리프 ambient tier 도입
- **목표**: 시야 점유 즉시 제거, 사용자 체감 개선 측정

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

### Phase 4 — Task Envelope (3–4주)

- 암묵적 envelope (브랜치 + 첫 변경 감지)
- 명시적 envelope UI (Start/End task)
- Envelope 닫힘 시 누적 blast radius 회고 카드
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

- Phase 1을 단독 릴리즈로 낼 것인가, Phase 2와 묶어서 낼 것인가?
- Task envelope의 디폴트는 *암묵적 always-on*인가, *opt-in*인가?
- Status bar pill 자리: 좌측(파일 정보 옆) vs 우측(알림 영역)?
- 거터 글리프가 다른 LSP diagnostic과 충돌하지 않게 별도 column을 둘 것인가?

---

## 참고 (References)

- [Breaking the Flow: A Study of Interruptions (ICSE 2024)](https://kjl.name/papers/icse24.pdf)
- [Effects of Intelligent Notification Management — Iqbal & Bailey, CHI 2008](https://interruptions.net/literature/Iqbal-CHI08.pdf)
- [OASIS: Linking Notification Delivery to Task Structure — Microsoft Research, TOCHI](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/TOCHI-Oasis-final.pdf)
- [Programmer, Interrupted — Parnin](https://www.gamedeveloper.com/programming/programmer-interrupted)
- [Analyzing the Ripple Effects of Refactoring (EMSE)](https://www.researchgate.net/publication/396929467_Analyzing_the_Ripple_Effects_of_Refactoring)
- [Refactoring made right — Kiro](https://kiro.dev/blog/refactoring-made-right/)
- [Intent: A workspace for agent orchestration — Augment Code](https://www.augmentcode.com/blog/intent-a-workspace-for-agent-orchestration)
