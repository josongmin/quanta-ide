# ADR 0001 — Workspace as Top-Level Work Unit

**날짜**: 2026-04-15
**상태**: Accepted
**작성**: Jo + Claude

---

## Context

현재 [p0-ide-v2/src/app/App.tsx](p0-ide-v2/src/app/App.tsx) 의 상단 탭은 앱 최상위에 **평평하게** 붙어있다.

```ts
const initialTabs: Tab[] = [
  { id: "t1", app: "ide", label: "order-service" },
  { id: "t2", app: "ide", label: "payment-service" },
  { id: "t3", app: "rules", label: "Agent Rules" },
  { id: "t4", app: "settings", label: "Settings" },
];
```

이 구조는 두 가지를 혼동하게 만든다:

1. **작업 컨텍스트**(어느 프로젝트/리포/팀) — 지금은 암묵적. 탭 라벨로만 추정.
2. **뷰 모드**(IDE / 코드 에이전트 / 룰 / 설정) — 이건 탭으로 표현됨.

기능이 늘어나면 (Agent Rules, Reviews, Scenario, Counterfactual, Firewall, Orchestrator…) 탭이 한 평면에 쏟아져 섞인다. 어느 탭이 어느 프로젝트에 속하는지, 팀과 무엇을 공유하는지 구조로 드러나지 않는다.

또한 팀 협업 요구(코드 공동 편집, 룰 공유, 에이전트 세션 공유)는 "공유 단위"를 필요로 한다. 탭 개별 공유는 의미가 약하다 — IDE 탭만 공유하고 룰은 뺀다? 세션만 공유하고 코드는 뺀다? 대부분의 경우 묶여야 의미가 산다.

## Decision

**Workspace** 를 IDE 의 최상위 작업 단위로 도입한다. 탭은 **워크스페이스 안의 뷰 인스턴스**로 내려간다.

### 개념 층위

```
User
 └── Workspace (N개, 팀 공유 단위)
      ├── Code          — 리포/경로/브랜치 컨텍스트
      ├── Dependencies  — 외부 의존성 레지스트리 (ADR 0002)
      ├── Agent Rules   — .agent/rules.md 등 중립 소스
      ├── Arch Rules    — 팀 아키텍처 계약 (레이어/금지 의존 등)
      ├── Lint/Style    — 팀 코드 스타일·포맷 규약
      ├── Tickets       — 협업/이슈 트래킹 (공유)
      ├── Reviews       — PR·리뷰 산출물
      ├── Incidents     — 팀이 겪은 장애 DNA
      ├── Work Memory   — 개인/현재 작업 맥락 (진행 중인 판단·시도)
      ├── Team Memory   — 공유 암묵지 (룰로 굳기 전의 결정·이유)
      ├── Wiki          — 정리된 문서 (런북·온보딩·서비스 카탈로그)
      ├── Members       — 팀 공유/권한
      ├── Sessions      — 에이전트 실행 히스토리
      ├── Settings      — 워크스페이스 스코프 설정
      └── Tabs[]        — 이 워크스페이스 안의 뷰 인스턴스들
           ├── IDE 탭 (파일/서비스)
           ├── Agent 탭 (orchestrator / run)
           ├── Rules 탭
           ├── Reviews 탭
           ├── Settings 탭
           └── …
```

일반 원칙: **팀과 공유될 때 의미가 생기는 모든 자원은 워크스페이스에 귀속한다.** 사용자 전역으로 남겨야 할 것은 "디바이스/개인 취향에 종속된 것" 뿐(키바인딩 일부, UI 테마, 로컬 캐시 등).

### 핵심 속성

1. **Workspace = 공유 단위.** 팀원 초대, 권한, 실시간 협업은 워크스페이스 수준에서 일어난다. 탭 단위 공유 기능은 만들지 않는다.
2. **Tab = 뷰 인스턴스.** 탭의 `app` 필드는 "어느 feature 의 뷰인가" 를 가리킨다. 동일 app 의 탭이 여러 개 존재할 수 있다 (예: IDE 탭 여러 개가 각 서비스 폴더를 가리킴).
3. **Tab state 는 workspace-scoped.** 탭은 자신이 속한 워크스페이스의 컨텍스트(리포, 브랜치, 룰, 세션) 위에서 렌더된다. 워크스페이스를 전환하면 탭 세트도 통째로 전환된다.
4. **Workspace switcher 는 탭과 분리된 layer.** 탭 바(Topbar)는 "현재 워크스페이스 내부" 를 보여주는 뷰다. 워크스페이스 자체의 전환은 별도 UI — 좌측 레일 또는 `⌘1~9` / 팔레트.
5. **Settings 는 이중 스코프.** 사용자 전역 설정과 워크스페이스 설정이 분리된다. 워크스페이스 설정은 팀과 공유되고, 사용자 설정은 공유되지 않는다.

## Consequences

### 장점

- **구조 무결성** — 탭이 "어디에 속했는지" 가 타입으로 드러난다. 탭 평면에 뒤섞여 팀/리포 경계가 흐려지는 일이 없어진다.
- **팀 공유가 1급 개념** — Workspace 단위 공유가 기본. Agent Rules / Sessions / Reviews 같은 협업 산출물의 귀속이 자명해진다.
- **Feature Registry 와 정합** — [docs/rfc/2026-04-15-agent-rules-manager.md](docs/rfc/2026-04-15-agent-rules-manager.md) 의 Feature Registry 는 "workspace 에 붙을 수 있는 탭 타입" 을 등록하는 레지스트리가 된다. 기능 추가 = 탭 타입 추가.
- **설정 sprawl 방지** — 전역/워크스페이스 스코프가 구조로 분리됨. 각 feature 는 자기 스코프만 선언.
- **확장성** — Counterfactual, Firewall, Orchestrator, Compliance 등 앞으로 올 뷰는 전부 "탭 타입" 으로 등록되며, 워크스페이스 안에 자연스럽게 편입된다.

### 비용

- **현 App.tsx 리팩터 필요** — 탭 상태가 최상위에서 workspace-scoped 로 내려가야 한다. `tabBus` 도 workspace 인식으로 바뀜.
- **Workspace 전환 UI 추가** — 좌측 레일 또는 그에 준하는 영역이 필요. 화면 밀도가 증가.
- **탭 state 지속성 규약 필요** — 워크스페이스를 떠났다 돌아올 때 탭 세트를 복원해야 함. 세션 저장 위치(로컬? 원격?) 를 정해야 한다.
- **권한 모델** — 팀 공유가 생기면 read/write/admin 권한 스키마가 필요. v0 에서는 최소한으로만 (소유자 + 게스트).

### 비(非)영향

- 기존 L1~L4 [overlay architecture](docs/rfc/2026-04-14-overlay-architecture.md) 는 탭 내부 구조이므로 변경 없음.
- Agent Rules Manager 의 중립 소스/어댑터 설계는 독립. Rules 는 "워크스페이스에 속한 자원" 이 될 뿐.

## 확정 사항

- **Tab type 은 Workspace 내부의 view instance 이다.** 공유/권한/리포 컨텍스트는 Workspace 가 갖는다.
- **Feature Registry 는 "Tab type" 을 등록한다.** 글로벌 settings / shortcut / status contribution 은 feature 단위로 자동 집계.
- **Topbar 는 current-workspace 의 탭만 보여준다.** 워크스페이스 자체 전환은 별도 UI layer.

## 열린 질문 (후속 결정)

1. **Workspace switcher 의 위치** — 좌측 세로 레일 vs. Topbar 좌측 드롭다운 vs. 팔레트 전용. → 별도 ADR.
2. **Workspace 저장/동기화** — 로컬 파일(.quanta/workspace.json) + 팀 공유 시 원격? 아니면 처음부터 원격? → 별도 ADR.
3. **권한 모델 세분도** — v0: owner + guest. v1 이후 role-based? → 필요 시점에 결정.
4. **Tab state 지속성** — 닫힌 탭 복원 범위, 크로스 디바이스 동기화 여부.
5. **Home / Picker 와의 관계** — 현재 [HomePage](p0-ide-v2/src/pages/home) 는 "탭 안의 초기 뷰" 다. Workspace 도입 후에는 "no-workspace 상태의 랜딩" 이 별도로 필요할 수 있음.

## 후속 결정

- **[ADR 0002 — Workspace as Analysis Scope Boundary](0002-workspace-as-analysis-scope.md)** — Workspace 는 공유 단위일 뿐 아니라 **정적분석의 스코프 경계** 이기도 하다. 외부 의존성 레지스트리(자동 감지 + 수동 선언)를 Workspace 에 귀속.

---

## 참고

- [docs/rfc/2026-04-14-overlay-architecture.md](docs/rfc/2026-04-14-overlay-architecture.md) — 탭 내부의 L1~L4 노출 모델
- [docs/rfc/2026-04-15-agent-rules-manager.md](docs/rfc/2026-04-15-agent-rules-manager.md) — Feature Registry 의 강제 드라이버
- [p0-ide-v2/src/app/App.tsx](p0-ide-v2/src/app/App.tsx) — 현 평면 탭 구조 (리팩터 대상)
- [p0-ide-v2/src/shared/model/tab-bus/](p0-ide-v2/src/shared/model/tab-bus/) — 탭 오픈 요청 버스 (workspace-aware 로 전환 필요)
