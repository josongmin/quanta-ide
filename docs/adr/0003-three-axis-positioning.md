# ADR 0003 — Three-Axis Positioning: Engine × AI × IDE, Bound by Workspace

**날짜**: 2026-04-15
**상태**: Accepted
**작성**: Jo + Claude

---

## Context

[ADR 0001](0001-workspace-as-work-unit.md) 과 [ADR 0002](0002-workspace-as-analysis-scope.md) 에서 Workspace 를 공유 단위 + 분석 스코프로 확정했다. 이 결정은 단순한 UI 구조 정리가 아니라, 그동안 쌓아둔 RFC 들을 한 축으로 꿰는 **제품 포지셔닝** 의 귀결이기도 하다.

이 ADR 은 그 포지셔닝을 명시적으로 고정한다. 미래에 기능을 추가/거절할 때 기준이 될 **세 축** 을 문서화한다.

## Decision

Quanta 는 다음 **세 축의 교집합** 으로 정의된다. 각 축은 단독으로 존재하지 않으며, Workspace 가 셋을 묶는다.

### 🧠 Core 분석 엔진

> "코드를 이해하는" 레이어.

- Taint flow / Blast radius / Arch rules / Typestate / Incident DNA / Behavior diff / Ownership / Cost.
- Workspace 의 [의존성 레지스트리](0002-workspace-as-analysis-scope.md) 를 스코프 루트로 삼아 동작.
- 엔진은 **AI 의 전제** 이지 보조가 아니다. 엔진이 먼저, AI 가 그 위에 얹힘.

### 🤖 AI-native

> 에이전트는 부가기능이 아니라 Workspace 의 1급 시민.

- 기능 계열: [Agent Rules Manager](../rfc/2026-04-15-agent-rules-manager.md), [Agent Orchestrator](../rfc/2026-04-15-agent-orchestrator-view.md), [Rule Compliance Verifier](../rfc/2026-04-15-agent-rule-compliance-verifier.md), [Prompt Injection Firewall](../rfc/2026-04-15-prompt-injection-firewall.md), [Proof-Carrying PR](../rfc/2026-04-15-proof-carrying-pr.md), [Counterfactual Branch](../rfc/2026-04-15-counterfactual-branch.md).
- 모두 **엔진 신호 위에서** 동작. "AI 가 추측한다" 가 아니라 **"엔진이 아는 걸 AI 가 쓴다"**.
- 에이전트·룰·세션·증명은 전부 Workspace 자원.

### 🪟 Modern IDE shell

> VSCode 수준의 익숙함 + 팀 중심 구조.

- [Overlay 4-레이어](../rfc/2026-04-14-overlay-architecture.md) (L1 passive / L2 hover / L3 inspector / L4 shortcuts).
- Feature Registry → Workspace tab 타입 등록.
- 에디터·Inspector·Bottom panel 등은 Workspace 내부의 뷰 인스턴스.

### 묶는 단위: Workspace

세 축은 **Workspace 가 없으면 분리된 세 제품** 이다. Workspace 가 있어서:

- 엔진은 분석 경계를 안다.
- AI 는 "어느 팀의 세계" 에서 일하는지 안다.
- IDE shell 은 "어느 팀 자원" 을 렌더할지 안다.

**Workspace = 팀의 코드 세계 그 자체.**

## 포지셔닝 한 줄

> **"팀의 코드 세계를 이해하는 엔진 위에, AI 와 IDE 를 올린 플랫폼."**

카테고리: **Software Intelligence Platform**
아키텍처 층위: **SE Infrastructure Layer**
피칭: **"코드를 이해하는 인프라"**

## 경쟁 구도

| 제품군 | 엔진 | AI | IDE shell | 팀 경계 |
|--------|------|------|----------|---------|
| Cursor / Copilot / Windsurf | ✕ | ○ | ○ | ✕ |
| Sourcegraph / Semgrep / CodeQL | ○ | △ | △ | △ |
| JetBrains / VSCode | △ | △ (플러그인) | ○ | ✕ |
| **Quanta** | **○** | **○** | **○** | **○ (Workspace)** |

차별점: 세 축 모두를 갖고 **팀 경계를 1급 개념** 으로 처음부터 설계했다는 점. 기존 에디터는 "개인 생산성 도구" 에서 출발해 팀 경계를 나중에 붙이지 못함.

## 기능 채택/거절 기준

앞으로 기능을 추가할 때 다음을 묻는다:

1. **세 축 중 어디에 속하는가?** 어느 축에도 걸리지 않으면 Quanta 기능이 아님.
2. **Workspace 에 귀속되는가?** 팀과 공유될 때 의미가 생기지 않는 기능은 보수적으로 접근.
3. **엔진 신호를 쓰는가 / 강화하는가?** AI 기능이라면 엔진 위에서 동작해야 함. 순수 LLM 래퍼는 Quanta 가 할 일 아님.
4. **Overlay 레이어 중 어디에 노출되는가?** 레이어 매핑 없이 UI 를 늘리지 않음.

## Consequences

### 장점

- **제품 방향성의 나침반** — 기능 논의 시 "이게 우리 축에 맞는가?" 로 빠르게 결정.
- **RFC 들의 일관성 근거** — 그동안의 RFC 들이 왜 함께 존재하는지 설명됨.
- **포지셔닝 메시지의 단단함** — 투자자/사용자/팀원 대상 설명이 한 문장으로 고정.

### 비용

- **유혹 차단 비용** — "요즘 뜨는 LLM 기능 붙이자" 같은 무축 기능을 거절해야 함. 이 거절을 명시적으로 수행할 책임이 생김.
- **세 축 전부 유지 비용** — 한 축만 잘해서 살아남는 제품이 아니게 됨. 엔진도, AI 도, IDE shell 도 각각 수준을 유지해야 함.

## 확정 사항

- Quanta = **Engine × AI × IDE**, bound by **Workspace**.
- 세 축 중 어느 하나라도 빠지면 Quanta 가 아니다.
- 모든 기능은 Workspace 에 귀속되거나, 사용자-전역(개인 취향 한정) 이어야 한다. 그 외 스코프는 없다.

---

## 참고

- [ADR 0001 — Workspace as Top-Level Work Unit](0001-workspace-as-work-unit.md)
- [ADR 0002 — Workspace as Analysis Scope Boundary](0002-workspace-as-analysis-scope.md)
- [RFC — Overlay Architecture](../rfc/2026-04-14-overlay-architecture.md)
- [RFC — Control Tower IDE](../rfc/2026-04-09-control-tower-ide.md)
- [RFC — Flow-Aware Analysis Surfacing](../rfc/2026-04-12-flow-aware-analysis-surfacing.md)
