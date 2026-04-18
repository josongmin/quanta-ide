# Roadmap Backlog

**업데이트**: 2026-04-15
**용도**: 기능 후보 전체 집계. 그룹별로 나열. 순서 정하기 전 검토용.

---

## 0. 배경 (Background)

### 0.1 제품 정의 한 줄

> **"팀의 코드 세계를 이해하는 엔진 위에, AI 와 IDE 를 올린 플랫폼."**

| 용도 | 이름 |
|------|------|
| 카테고리명 (외부) | **Software Intelligence Platform** |
| 아키텍처 위치 (내부) | **SE Infrastructure Layer** |
| 한 줄 피칭 | **"코드를 이해하는 인프라"** |

### 0.2 왜 지금 이게 필요한가

AI 가 코드를 쏟아낸다. 문제는 LLM 이 레포 구조를 이해 못 한 채 생성하므로:

- 중복 코드, 아키텍처 붕괴, 일관성 없는 패턴이 누적
- 생성된 코드의 **구조적 신뢰성 검증** 수단이 없음
- 기존 도구(Copilot/Cursor 등)는 생성에 집중, 구조 통제 부재

→ Quanta 는 **구조 통제 + AI 적합성 검증** 을 1급으로 다루는 **인프라 레이어**.
"더 좋은 Copilot" 이 아니라 "Copilot 이 위에서 돌아가는 기반".

### 0.3 세 축 + Workspace (핵심 아키텍처)

```
┌──────────────────────────────────────────────┐
│            Workspace (팀의 코드 세계)         │
│  ┌───────────┬───────────┬───────────────┐   │
│  │ 🧠 Engine  │ 🤖 AI-native│ 🪟 IDE shell │   │
│  │  분석 신호 │  에이전트    │  오버레이     │   │
│  └───────────┴───────────┴───────────────┘   │
│   Workspace 가 셋의 경계·정책·공유 단위       │
└──────────────────────────────────────────────┘
```

세 축 중 **어느 하나라도 빠지면 Quanta 가 아님**. Workspace 가 셋을 묶어 "팀 단위 제품" 으로 성립.

### 0.4 현재 확정된 기반 (ADR)

| ADR | 결정 | 요약 |
|-----|------|------|
| [0001](adr/0001-workspace-as-work-unit.md) | Workspace as Work Unit | 팀 공유 단위, 탭은 워크스페이스 내부의 뷰 인스턴스 |
| [0002](adr/0002-workspace-as-analysis-scope.md) | Workspace as Analysis Scope | 외부 의존성 레지스트리(자동+수동), 분석 경계 선언 |
| [0003](adr/0003-three-axis-positioning.md) | Three-Axis Positioning | Engine × AI × IDE × Workspace, 기능 채택/거절 기준 |
| [0004](adr/0004-se-as-live-indicator-layer.md) | SE as Live Indicator Layer | 엔진 = SE 지표. live·endogenous·Workspace-governed. SonarQube 대체 |
| [0006](adr/0006-workspace-canvas-engine.md) | Code Universe (Canvas Engine) | 코드베이스 전체를 2D 캔버스로 탐색. LOD·공간 인덱스·WebGL 렌더링 아키텍처 |

**Workspace 가 갖는 4중 역할** (ADR 누적):
1. 팀 공유 / 탭 컨테이너
2. 정적분석 스코프 경계
3. Engine×AI×IDE 결합점
4. SE 지표 정책·게이트·트렌드 관할자

### 0.5 현재 진행 중인 RFC (기능 설계)

| RFC | 상태 |
|-----|------|
| [Control Tower IDE](rfc/2026-04-09-control-tower-ide.md) | 엔진 신호 통합 대시보드 컨셉 |
| [Flow-Aware Analysis Surfacing](rfc/2026-04-12-flow-aware-analysis-surfacing.md) | Taint flow 노출 UX |
| [Overlay Architecture](rfc/2026-04-14-overlay-architecture.md) | **시행 중** — L1 passive / L2 hover / L3 inspector / L4 shortcuts |
| [Agent Rules Manager](rfc/2026-04-15-agent-rules-manager.md) | 중립 소스 → 타겟별 컴파일, Feature Registry 드라이버 |
| [Agent Orchestrator View](rfc/2026-04-15-agent-orchestrator-view.md) | 다중 에이전트 실행 뷰 |
| [Agent Rule Compliance Verifier](rfc/2026-04-15-agent-rule-compliance-verifier.md) | 에이전트 산출물 검증 |
| [Prompt Injection Firewall](rfc/2026-04-15-prompt-injection-firewall.md) | 에이전트 입력 검역 |
| [Proof-Carrying PR](rfc/2026-04-15-proof-carrying-pr.md) | PR 에 증명 첨부 |
| [Counterfactual Branch](rfc/2026-04-15-counterfactual-branch.md) | "만약 이렇게 바꾸면" 분기 분석 |

### 0.6 현재 구현된 Shell (p0-ide-v2)

- **Topbar 탭 / Bottom panel / Inspector / Toast / Command Palette / Dev Console** — 기본 shell 동작 중
- **Overlay L1~L4** — gutter glyphs, fn-header, SymbolPopup, CallSitePopup, inspector modes, shortcuts 일부
- **Code Universe (코드유니버스)** — 코드베이스 전체를 2D 캔버스로 탐색하는 뷰. galaxy/city/street/ground LOD, PixiJS WebGL 렌더링, 공간 인덱스(RBush) 기반. [ADR 0006](adr/0006-workspace-canvas-engine.md) 참조.
- **Feature Registry / Tab Bus** — 초기 골격 있음, 확장 필요
- **Workspace 개념 미도입** — ADR 0001 기반 리팩터 대기
- **Home/Picker** — Workspace 도입 시 재설계 필요

자세한 상태는 섹션 7 (Shell/UX) 참조.

### 0.7 서비스 지향점 (Product Direction)

**① 흡수 대상 (Replace)** — Quanta 가 엔진·Workspace 덕분에 원천적으로 이기는 카테고리.
`AI 코딩 / 코드 품질 / PR 작성·리뷰·머지 / 개발자 포털 / 엔지니어링 메트릭 / Reachability SCA / 코드베이스 Q&A / AI 테스트`

**② 연동 대상 (Integrate)** — 개발 세계 밖이거나 경계가 다른 영역, 깊게 연결하되 소유하지 않음.
`Linear·Jira (조직 티켓) / Rootly·FireHydrant (인시던트) / Sentry·DataDog (observability) / Slack (커뮤니케이션)`

**③ 선점 대상 (Category king, 2026+)** — 아직 주인 없는 태동 카테고리, Quanta 가 표준 제정할 기회.
`AI code provenance / Agent fleet orchestration / Spec-first AI codegen / Policy-as-code for AI / Multi-repo intelligence`

→ 상세 치환 지도는 섹션 10 참조.

### 0.8 기능 채택/거절 기준 (Feature Filter)

새 기능 제안 시 다음 4가지를 통과해야 함:

1. **세 축 중 어디에 속하는가?** (Engine / AI / IDE) — 어디에도 안 걸리면 Quanta 기능 아님
2. **Workspace 에 귀속되는가?** — 팀 공유 의미 없으면 개인 전역 스코프 고려, 그 외 스코프는 없음
3. **엔진 신호를 쓰는가 / 강화하는가?** — 순수 LLM 래퍼는 Quanta 가 할 일 아님
4. **Overlay 레이어(L1~L4) 중 어디에 노출되는가?** — 레이어 매핑 없이 UI 를 늘리지 않음

### 0.9 본 문서 읽는 법

- **섹션 0** — 배경 (지금 여기)
- **섹션 1~7** — 내부 기능 후보 (그룹별)
- **섹션 8** — 외부 카테고리 흡수 대상 (경쟁 대체)
- **섹션 9** — 2026 신생 카테고리 (선점 기회)
- **섹션 10** — 치환 지도 (한 눈 요약)
- **우선순위 후보** — Wave 1~5, 검토용 최초 추천

---

## 범례

| 상태 | 의미 |
|------|------|
| 🟢 **Draft RFC** | 이미 RFC 문서 있음 |
| 🔵 **ADR** | 구조 결정으로 확정됨 |
| ⚪ **Idea** | 아이디어 단계, 문서 없음 |

우선순위(P0/P1/P2) 칼럼은 비워둠 — 검토 후 채울 것.

---

## 0. 구조 / 기반 (Foundation)

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| F1 | Workspace as Work Unit | 🔵 ADR | [adr/0001](adr/0001-workspace-as-work-unit.md) | 팀 공유 단위 |
| F2 | Workspace as Analysis Scope | 🔵 ADR | [adr/0002](adr/0002-workspace-as-analysis-scope.md) | 외부 의존성 레지스트리 |
| F3 | Three-Axis Positioning | 🔵 ADR | [adr/0003](adr/0003-three-axis-positioning.md) | Engine × AI × IDE |
| F4 | Overlay Architecture (L1~L4) | 🟢 RFC | [rfc/…overlay-architecture](rfc/2026-04-14-overlay-architecture.md) | 실제 shell 반영 중 |
| F5 | Feature Registry | ⚪ Idea | — | Workspace 탭 타입 등록 레지스트리. Agent Rules Manager RFC 의 강제 드라이버 |
| F6 | Workspace Switcher UI | ⚪ Idea | — | 좌측 레일 vs Topbar 드롭다운 vs 팔레트 — 별도 ADR 필요 |
| F7 | Workspace 저장/동기화 | ⚪ Idea | — | 로컬 + git vs 원격 레지스트리 |
| F8 | 권한 모델 | ⚪ Idea | — | v0 owner+guest, v1+ role-based |

---

## 1. Core 분석 엔진

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| E1 | Flow-Aware Analysis Surfacing | 🟢 RFC | [rfc/…flow-aware](rfc/2026-04-12-flow-aware-analysis-surfacing.md) | Taint flow 노출 |
| E2 | Control Tower IDE | 🟢 RFC | [rfc/…control-tower](rfc/2026-04-09-control-tower-ide.md) | 엔진 신호 통합 대시보드 |
| E3 | Dependency Registry UI | ⚪ Idea | — | ADR 0002 의 "얼굴". 자동 감지 + 수동 선언 편집 |
| E4 | Taint/Source/Sink 편집 UX | ⚪ Idea | — | 함수 단위 역할 오버라이드 |
| E5 | Arch Rules 편집/검증 | ⚪ Idea | — | 레이어·금지 의존 선언, 실시간 위반 표시 |
| E6 | Incident DNA 관리 | ⚪ Idea | — | 과거 장애 패턴 등록·매칭 결과 |
| E7 | Cost / Big-O 모델 | ⚪ Idea | — | 외부 호출 비용 lookup |
| E8 | Dead code cascade removal | ⚪ Idea | — | 구조 파악 → 실제 수정 연결 |
| E9 | Clone detection | ⚪ Idea | — | 중복 코드 실시간 감지 |
| E10 | Typestate 분석 | ⚪ Idea | — | 상태머신 위반 감지 |

---

## 2. AI-native 기능

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| A1 | Agent Rules Manager | 🟢 RFC | [rfc/…agent-rules-manager](rfc/2026-04-15-agent-rules-manager.md) | 중립 소스 → 타겟별 컴파일 |
| A2 | Agent Orchestrator View | 🟢 RFC | [rfc/…agent-orchestrator](rfc/2026-04-15-agent-orchestrator-view.md) | 다중 에이전트 실행 뷰 |
| A3 | Rule Compliance Verifier | 🟢 RFC | [rfc/…compliance-verifier](rfc/2026-04-15-agent-rule-compliance-verifier.md) | 에이전트 산출물 룰 준수 검증 |
| A4 | Prompt Injection Firewall | 🟢 RFC | [rfc/…firewall](rfc/2026-04-15-prompt-injection-firewall.md) | 에이전트 입력 검역 |
| A5 | Proof-Carrying PR | 🟢 RFC | [rfc/…proof-pr](rfc/2026-04-15-proof-carrying-pr.md) | PR 에 증명 첨부 |
| A6 | Counterfactual Branch | 🟢 RFC | [rfc/…counterfactual](rfc/2026-04-15-counterfactual-branch.md) | "만약 이렇게 바꾸면" 분기 분석 |
| A7 | 팀 프롬프트 라이브러리 | ⚪ Idea | — | 팀이 축적한 프롬프트/예제. Agent Rules 확장형 |
| A8 | Agent 세션 공유 & 핸드오프 | ⚪ Idea | — | "내 세션 이어받아줘", 사람↔AI↔사람 인계 |
| A9 | Agent 비용/쿼터 대시보드 | ⚪ Idea | — | 토큰 spend 팀 추적, budget alert |
| A10 | Agent 성과 리포트 | ⚪ Idea | — | 어떤 agent/rule 조합이 good PR 냈나 (proof 기반) |
| A11 | Issue Auto-triage | ⚪ Idea | — | 엔진 + AI 가 영향범위·담당자·우선순위 판별 |
| A12 | AI Pair Handoff | ⚪ Idea | — | 맥락 보존한 상태로 세션 인계 |

---

## 3. PR / Review / Merge

> **PR 라이프사이클 3구간 분리** — 각 구간에 별도 도구가 존재하며, Quanta 는 셋 다 흡수.
>
> `[작성 / Graphite] → [리뷰 / CodeRabbit] → [머지 / Mergify]`

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| R1 | Stacked PR 관리 | ⚪ Idea | — | **Graphite 대체 [작성 구간]**. 엔진이 stack call-graph 앎 → AI 가 구조적 rebase |
| R2 | Engine-aware Merge Queue | ⚪ Idea | — | **Mergify/Aviator 대체 [머지 구간]**. blast radius 기반 머지 순서·병렬 판단 |
| R3 | Reviewer 자동 추천 | ⚪ Idea | — | ownership × blast × 과거 인시던트 매칭 |
| R4 | PR Risk Badge | ⚪ Idea | — | Proof-PR 확장 — 머지 전 risk score |
| R5 | PR Health Board | ⚪ Idea | — | stuck/aging/blocked 대시보드, agent auto-ping |
| R6 | Review SLA / 응답성 트래킹 | ⚪ Idea | — | 팀 리뷰 문화 지표 |
| R7 | Change Card (AI agent 결과 확정) | ⚪ Idea | — | 기존 노트 참고 — AI 변경을 사람이 승인·거절하는 UI |
| R8 | AI PR 리뷰 | ⚪ Idea | — | **CodeRabbit/Ellipsis/Qodo Merge 대체 [리뷰 구간]**. diff 만 보는 봇과 달리 엔진 신호(blast/taint/arch/인시던트) 전체 기반. Proof-PR + Compliance Verifier 조합으로 재료 이미 있음 |
| R9 | Spec drift 감지 (PR 시점) | ⚪ Idea | — | OpenAPI/Protobuf/GraphQL 스펙 ↔ 구현 drift. Dep Registry 내부 서비스 엔트리에 spec 바인딩 |
| R10 | Performance regression (PR 시점) | ⚪ Idea | — | 엔진의 big-O/cost 모델로 PR 에서 회귀 감지 (prod 기다리지 않음) |

---

## 4. 팀 / 프로젝트 관리

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| T1 | Service Catalog | ⚪ Idea | — | Dependency Registry 자동 파생. "우리 팀이 쓰는 서비스 지도" |
| T2 | Ownership Dashboard | ⚪ Idea | — | call-graph weighted ownership, bus factor 알림 |
| T3 | Tech Debt Ledger | ⚪ Idea | — | arch 위반 + 인시던트 + 커버리지 ↔ 우선순위화된 빚 목록 |
| T4 | Decision Log (ADR in-IDE) | ⚪ Idea | — | docs/adr 를 1급 뷰로 |
| T5 | Onboarding Tracker | ⚪ Idea | — | 신규 멤버 건드린 영역 × risk → 램프업 맵 |
| T6 | Postmortem → Incident DNA 루프 | ⚪ Idea | — | 장애 리포트 → 엔진 피드백, 플라이휠 |
| T7 | Roadmap / Sprint 뷰 | ⚪ Idea | — | 태스크가 코드 영역에 바인딩, 스프린트 단위 모듈 집계 |
| T8 | Tickets 통합 (Linear/Jira 양방향) | ⚪ Idea | — | **결정: 외부 = source of truth, Quanta = link layer.** Linear/Jira 는 조직 세계, Quanta 는 코드 세계 — 경계 분리. 연동은 양방향 깊게 (티켓 ↔ PR/커밋/파일/지표/인시던트) |
| T9 | Compliance Audit Trail | ⚪ Idea | — | Proof-PR + 룰 컴플라이언스 로그 → SOC2/ISO 증거 |

---

## 5. 지식 / 증거 (Knowledge & Evidence)

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| K1 | Work Memory | ⚪ Idea | — | 개인/현재 작업 맥락, AI 와 공유 |
| K2 | Team Memory | ⚪ Idea | — | 공유 암묵지, 룰로 굳기 전 결정 |
| K3 | Wiki (런북/온보딩/카탈로그) | ⚪ Idea | — | 정리된 문서, workspace-scoped |
| K4 | Architecture Diagram 자동 생성 | ⚪ Idea | — | Dependency Registry + call-graph 기반 |
| K5 | Runbook 실행 트래킹 | ⚪ Idea | — | 런북을 IDE 에서 실행·기록 |

---

## 6. 운영 경계 (Edges — 통합/경계 기능)

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| O1 | Prod Telemetry Bind | ⚪ Idea | — | 에러/알림 → 코드 위치 → 담당자 자동 라우팅 (Sentry 연동) |
| O2 | SLO / 에러 버짓 | ⚪ Idea | — | workspace 모듈 단위 추적, 소진 시 엔진 보수화 |
| O3 | Secret / Credential 관리 | ⚪ Idea | — | Firewall 과 연계 |
| O4 | 외부 API 스펙 연동 (OpenAPI/gRPC) | ⚪ Idea | — | Dependency Registry 확장 |
| O5 | IDE Shell Settings (글로벌) | ⚪ Idea | — | 키바인딩/테마/로컬 캐시 등 user-scoped |

---

## 7. Shell / UX (IDE 뼈대)

| # | 기능 | 상태 | 문서 | 비고 |
|---|------|------|------|------|
| U1 | Command Palette | 🟢 부분구현 | widgets/command-palette | 확장 필요 (feature registry 연동) |
| U2 | Dev Console | 🟢 부분구현 | widgets/dev-console | |
| U3 | Toast / Notification | 🟢 구현 | shared/ui/toast | |
| U4 | Bottom Panel (agent/logs/terminal) | 🟢 구현 | widgets/bottom-panel | |
| U5 | Inspector Modes (Flow/Blast/Incidents/Behavior/Ownership) | 🟢 RFC | overlay-architecture | 일부 구현 |
| U6 | Home / Picker 랜딩 | 🟢 구현 | widgets/home-picker | Workspace 도입 시 재설계 필요 |
| U7 | Global Shortcuts | 🟢 구현 | features/global-shortcuts | Feature Registry 연동 필요 |
| U8 | **Code Universe** (코드유니버스) | 🔵 ADR | [adr/0006](adr/0006-workspace-canvas-engine.md) | 코드베이스 전체 2D 캔버스 탐색. LOD galaxy→city→street→ground, WebGL+DOM 렌더링. 구현 중 |

---

## 8. 흡수 대상 카테고리 (2026 트렌드 기반)

> **경쟁/인접 카테고리 중 Quanta 가 엔진·Workspace 덕분에 원천적으로 이길 수 있는 것.**
> ⚠️ 지식 cutoff 2025-05 기준 추정. 2026 실시간 트렌드는 별도 검증 필요.

### 🔥 Tier S — 엔진만 있으면 압도적으로 이김

| # | 카테고리 | 대표 도구 | Quanta 흡수 지점 | 왜 이기는가 |
|---|---------|---------|----------------|------------|
| X1 | AI PR 리뷰 | CodeRabbit, Ellipsis, Qodo Merge | R8 | 엔진 신호 전체 기반 vs diff 만 읽는 봇. Proof-PR + Compliance Verifier 로 재료 완비 |
| X2 | 내부 개발자 포털 / 서비스 카탈로그 | **Backstage**, Cortex, Port.io, OpsLevel | T1 + E3 | Dep Registry + call-graph 로 **자동 파생**. 엔터프라이즈 수백만$ 시장. Backstage 의 YAML 지옥을 죽임 |
| X3 | 엔지니어링 메트릭 / DX 플랫폼 | Jellyfish, LinearB, Swarmia, DX | ADR 0004 + 새 대시보드 | endogenous live 지표가 git/Jira 집계 후행 지표보다 **원천적으로 정확** |
| X4 | Reachability SCA / 공급망 보안 | **Endor Labs**, Socket.dev, Snyk Reachable | E3 확장 | 엔진이 이미 call-graph 앎 → CVE 도달성 분석 한 레이어 추가로 끝 |

### 🔥 Tier A — 핵심 축에 자연스럽게 붙음

| # | 카테고리 | 대표 도구 | Quanta 흡수 지점 | 비고 |
|---|---------|---------|----------------|------|
| X5 | 코드베이스 Q&A | Sourcegraph Cody, Greptile, Unblocked, Supermaven | AI pane 확장 | 엔진-grounded Q&A (RAG 아님). flow/blast 아는 답 |
| X6 | AI 테스트 생성·유지 | Qodo, Meticulous, Codium | A 시리즈 확장 | coverage × taint × ownership 아는 상태에서 테스트 제안 |
| X7 | Stacked PR / Merge Queue | **Graphite**, Mergify, Aviator | R1, R2 | blast 기반 순서는 Quanta 만 가능 |
| X8 | AI 코딩 에이전트 | Continue, Aider, Cline, Devin | Orchestrator RFC | Workspace + 엔진 + Proof 게이트 위에서 동작 |
| X9 | Spec-drift / Spec-first codegen | Stainless, Speakeasy, Orval | R9 | Dep Registry 에 spec 바인딩 → live drift |
| X10 | Performance regression at PR | CodSpeed, Bencher | R10 | 엔진 big-O/cost 모델로 prod 기다리지 않고 감지 |

### 🔁 Tier B — 흡수보다 연동이 나음 (다른 세계)

| # | 카테고리 | 대표 도구 | 관계 |
|---|---------|---------|------|
| X11 | 인시던트 관리 | Rootly, FireHydrant, incident.io | 연동. 코드 측(Incident DNA)은 Quanta, 온콜·커뮤니케이션은 외부 |
| X12 | Observability / APM | Sentry, Honeycomb, DataDog | 연동. prod 시그널 → 엔진 피드백 (O1) |
| X13 | 조직 티켓/프로젝트 | Linear, Jira, Asana | 연동만 (조직 세계 — T8 에서 확정) |
| X14 | 정책·규제 보안 | Chainguard, Wiz, Prisma Cloud | 부분 흡수(reachability), 나머지 연동 |

---

## 9. 2026 신생 카테고리 (추정, 자리 잡기 유리한 것들)

> 기존 도구가 아직 없거나 태동 중인 카테고리. Quanta 가 **표준 제정자(category king)** 가 될 수 있는 자리.

| # | 카테고리 | 설명 | Quanta 에 유리한 이유 |
|---|---------|------|---------------------|
| N1 | **AI code provenance / attribution** | "이 코드는 어느 에이전트·프롬프트·모델에서 나왔나" 추적. EU AI Act / SOC2 류 규제 대응 | Workspace 세션·에이전트 기록 이미 있음. ADR 0004 지표에 attribution 축 추가 |
| N2 | **Agent fleet orchestration** | 여러 에이전트 병렬 작업, 분업, 합의 | Orchestrator RFC 이미 시작. Workspace 가 fleet 경계 |
| N3 | **Spec-first AI codegen** | OpenAPI/GraphQL/Protobuf 스펙이 source of truth, AI 가 거기에 맞춰 생성 | Dep Registry + spec 바인딩 구조적으로 유리 |
| N4 | **Policy-as-code for AI behavior** | 에이전트가 뭘 할 수 있는지 정책으로 강제 | Agent Rules + Firewall + Compliance 조합이 이미 이 방향 |
| N5 | **Multi-repo intelligence** | 마이크로서비스 크로스-리포 분석·리팩토링 | ADR 0002 의 `internal-cross-repo` 엔트리가 준비됨 |
| N6 | **MCP-style tool registry (team-scoped)** | 에이전트 도구 마켓플레이스의 워크스페이스별 큐레이션 | Workspace 가 자연스러운 경계 |
| N7 | **AI evaluation harness (팀 내장)** | 팀 리포에서 agent 성과 벤치마킹 | A10 Agent 성과 리포트의 확장 |
| N8 | **Semantic / Behavior diff as standard** | 구문 diff 가 아니라 의미 diff 가 PR 표준으로 | Behavior Diff RFC 이미 있음 |
| N9 | **Context/memory infrastructure** | 팀·에이전트 기억의 공용 인프라 (Mem0 류의 팀 버전) | K1~K3 (Work/Team Memory, Wiki) |
| N10 | **Living ADR / Decision graph** | 결정과 코드 영역의 양방향 바인딩, 영향받는 결정 자동 알림 | T4 Decision Log 확장 |

---

## 10. 치환 지도 요약 (Displacement Map)

> Quanta 가 흡수/연동하는 카테고리 한 눈에.

```
┌─────────────────────────────────────────────────────────────┐
│  Quanta (Workspace-native, Engine × AI × IDE)               │
├─────────────────────────────────────────────────────────────┤
│  흡수 (Replace)                                              │
│    🤖 AI 코딩         ← Copilot / Cursor / Windsurf          │
│    📊 코드 품질       ← SonarQube / CodeClimate / Codacy    │
│    🔀 PR 작성         ← Graphite                             │
│    🗣  PR 리뷰         ← CodeRabbit / Ellipsis / Qodo        │
│    🚦 PR 머지         ← Mergify / Aviator                    │
│    🏛 개발자 포털     ← Backstage / Cortex / Port            │
│    📈 엔지니어링 메트릭 ← Jellyfish / LinearB / Swarmia / DX │
│    🛡 Reachability SCA ← Endor Labs / Socket.dev             │
│    🔎 코드베이스 Q&A  ← Sourcegraph Cody / Greptile          │
│    🧪 AI 테스트       ← Qodo / Meticulous                    │
│                                                              │
│  연동 (Integrate, not replace)                               │
│    🎫 조직 티켓       ↔ Linear / Jira                        │
│    🚨 인시던트 관리   ↔ Rootly / FireHydrant                 │
│    📡 Observability   ↔ Sentry / DataDog / Honeycomb         │
│    💬 커뮤니케이션    ↔ Slack / Discord                      │
│                                                              │
│  선점 (Category king potential, 2026+)                       │
│    📝 AI code provenance                                     │
│    🤝 Agent fleet orchestration                              │
│    📐 Spec-first AI codegen                                  │
│    🔐 Policy-as-code for AI                                  │
│    🌐 Multi-repo intelligence                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 우선순위 후보 (최초 추천, 검토용)

> 차별성 × 레버리지 × 시장 크기 기준. 확정 아님.

### Wave 1 — 기반 (선행 필수)

1. **F5 Feature Registry** + **F6 Workspace Switcher** — Workspace 를 실제로 돌릴 수 있게 하는 기반. 나머지가 전부 여기에 얹힘.
2. **E3 Dependency Registry UI** — ADR 0002 를 사용자가 만질 수 있게. T1/X4 가 이거 위에 얹힘.

### Wave 2 — PR 라이프사이클 흡수 (즉각 가치)

3. **R1 Stacked PR + R2 Merge Queue + R3 Reviewer 추천 + R8 AI PR 리뷰** — PR 3구간을 한 번에. Graphite + Mergify + CodeRabbit 대체.

### Wave 3 — 엔진 플랫폼화 (네트워크 효과)

4. **T1 Service Catalog (X2)** — Backstage 대체. Dep Registry 의 얼굴.
5. **ADR 0004 지표 대시보드 (X3)** — Jellyfish/LinearB 대체. 팀 SE 계기판.
6. **X4 Reachability SCA** — Endor 대체. 보안 세일즈 각도.

### Wave 4 — AI 플라이휠 (장기 해자)

7. **A9 Agent 비용 + A10 Agent 성과** — AI 시대 팀 계기판.
8. **T6 Postmortem → Incident DNA 루프** — 엔진이 시간 지날수록 똑똑해지는 플라이휠.

### Wave 5 — 카테고리 선점 (2026 기회)

9. **N1 AI code provenance** — 규제 대응 + 엔터프라이즈 진입점.
10. **N3 Spec-first codegen** — AI 코딩 기반 표준 전환기 대응.

---

## 참고

- [docs/adr/](adr/) — 구조 결정
- [docs/rfc/](rfc/) — 기능 설계
- [docs/ideanote.md](ideanote.md) — 날것 아이디어
