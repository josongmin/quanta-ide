# ADR 0004 — SE as Live, Endogenous Indicator Layer (Governed by Workspace)

**날짜**: 2026-04-15
**상태**: Accepted
**작성**: Jo + Claude

---

## Context

Quanta 의 제품 철학은 "**팀이 소프트웨어 엔지니어링을 잘하게 만드는 것**" 이다. 문제는 기존 방식의 SE 품질 관리가 AI 시대에 맞지 않는다는 것:

- **연말 리뷰 / 주기적 감사** — AI 가 코드를 쏟아내는 속도를 따라잡지 못함.
- **Lint / 사후 CI 검사** — 변경이 끝나고 나서 통지. 이미 context 가 떠난 뒤.
- **사람이 쓰는 리포트** — 주관적·간헐적·지표마다 다른 사람이 다른 기준으로 씀.
- **별도 대시보드** — 편집 중인 개발자의 시선에 없음. 일부러 찾아가야 보임.

결과: 팀은 SE 를 "하고 싶지만 지속적으로 측정할 수단이 없어서" 흐지부지된다. AI 가 쏟아낸 코드의 구조적 부채는 계속 누적된다.

[ADR 0003](0003-three-axis-positioning.md) 의 엔진은 이미 이런 신호를 다 뽑고 있다 — blast, cpx, taint, arch violation, ownership, risk. 하지만 이걸 **"분석 결과"** 로 취급할지 **"SE 지표 계기판"** 으로 취급할지는 제품 철학의 문제다.

이 ADR 은 후자를 확정한다.

## Decision

**엔진의 모든 분석 출력은 SE 지표다.** 지표는 (1) endogenous — 코드에서 자동 파생, (2) live — 항상 노출, (3) governed — Workspace 에서 정책으로 관리.

### 1. 지표의 성격

- **Endogenous** — 사람이 별도로 기입하지 않는다. 엔진이 코드·의존성·이력에서 직접 계산.
- **Live** — 배치가 아니라 실시간. 편집 중·저장 시·PR 열 때 즉시 갱신.
- **Observable by default** — [Overlay L1 (passive)](../rfc/2026-04-14-overlay-architecture.md) 에 항상 노출. 사용자가 "볼지 말지" 선택하지 않는다.
- **Composable** — 단일 지표가 아니라 축(axes)의 집합. 팀/상황에 따라 가중치 다름.

### 2. SE 원칙 ↔ 지표 매핑

| SE 원칙 | 엔진 지표 | 노출 위치 |
|---------|----------|-----------|
| 아키텍처 무결성 | arch violation count / layer breach | gutter · inspector(Arch) |
| 변경 안전성 | blast radius / risk score | fn-header · tab banner · minimap |
| 복잡도 관리 | cpx / big-O / budget % | fn-header |
| 테스트 신뢰 | coverage × call-weight | fn-header · inspector(Ownership) |
| 보안/데이터 흐름 | taint path 존재 / sanitizer 커버리지 | gutter · flow inspector |
| 유지보수성 | dead code / clone density | gutter dim · inspector |
| 소유권/버스팩터 | ownership 분산도 | inspector(Ownership) |
| 장애 재현 가능성 | incident DNA match | gutter · tab banner |
| 비용 / 성능 | cost model / big-O | fn-header |

각 지표는 엔진 타입으로 1급 정의되고, L1 위젯이 소비한다. 새 지표는 **엔진 → 위젯** 으로만 붙인다 (RFC 0004-14 컨벤션).

### 3. Workspace 가 지표를 통제

지표 자체는 엔진이 계산하지만, **"우리 팀 기준"** 은 Workspace 가 정의한다:

```
Workspace
 └── SE Policy
      ├── Thresholds      — max blast, max cpx, min coverage, max debt ratio ...
      ├── Gates           — merge block 조건, risk 임계값, proof 요구 수준
      ├── Weights         — 리스크 스코어 합산 가중치 (팀 특성 반영)
      ├── Exceptions      — 특정 경로/모듈의 임시 면제
      └── Trend targets   — 분기 목표 (예: debt ratio -20%)
```

이것도 [ADR 0001](0001-workspace-as-work-unit.md) 의 "팀 공유 시 의미가 생기는 모든 자원" 원칙을 그대로 따른다. 개인이 아니라 팀 단위로 합의되는 기준.

### 4. AI 게이트의 근거

AI 생성·수정 결과는 SE 지표를 통과해야 한다:

- [Proof-Carrying PR](../rfc/2026-04-15-proof-carrying-pr.md) — 지표 통과 증명 첨부
- [Rule Compliance Verifier](../rfc/2026-04-15-agent-rule-compliance-verifier.md) — 룰 + 지표 동시 검증
- [Agent Orchestrator](../rfc/2026-04-15-agent-orchestrator-view.md) — 지표 기반 재시도/차단
- Merge Queue — 지표 초과 PR 뒤로 미룸

즉 AI 가 많이 짤수록 지표가 더 강하게 작동한다. "쏟아내는 속도" 와 "품질 게이트" 가 비례해서 같이 올라감.

### 5. 트렌드와 플라이휠

지표는 시점이 아니라 **궤적** 이다. Workspace 는 트렌드를 저장:

- 주/월 단위 SE 지표 변화
- 좋아진 지표 / 나빠진 지표 강조
- 인시던트 발생 시 직전 지표 상관관계 분석 → Incident DNA 로 피드백

플라이휠: **장애 → 지표 업데이트 → 다음 분석 강화 → 미래 장애 예방**.

## Consequences

### 장점

- **SE 가 선택이 아니라 인프라가 된다** — 팀이 "SE 잘하자" 고 다짐하지 않아도 지표가 항상 돌아감.
- **AI 시대와 정렬** — 코드 생성 속도가 빨라질수록 지표 레이어의 가치가 커짐 (역비례가 아닌 정비례).
- **객관화** — "이 PR 느낌이 안 좋다" 가 아니라 "blast 47, risk 0.82, coverage 34%" 로 대화.
- **팀 공유된 SE 언어** — Workspace 정책 = 팀의 SE 기준. 온보딩 · 회고 · 성장 대화 모두 같은 지표로.
- **Copilot/Cursor 와의 차별** — 쟤넨 코드를 찍어내기만 함. Quanta 는 찍혀 나온 코드가 SE 기준에 맞는지 계속 잰다.
- **SonarQube / CodeClimate / Codacy 같은 외부 품질 플랫폼 대체** — 별도 서버·CI 파이프라인·웹 대시보드 없이 **IDE 안에서 live 로** 같은 일을 한다. 편집 중에 보이니까 fix-in-place, 쌓여서 나중에 치우는 부채가 되지 않는다. 그리고 엔진이 AI 게이트와 동일 스코프라 "품질 플랫폼 ↔ AI 도구" 이중 관리가 사라진다.

### 비용

- **지표 폭주 리스크** — L1 에 너무 많이 띄우면 노이즈. [Overlay](../rfc/2026-04-14-overlay-architecture.md) 의 "시선 이동 최소" 원칙을 엄격히 적용해야 함.
- **임계값 튜닝의 책임** — Workspace 기본값이 너무 엄하면 알람 피로, 너무 느슨하면 무의미. preset + 팀별 조정 UX 필요.
- **거짓 양성(false positive)** — 지표가 틀렸을 때의 신뢰 붕괴 비용이 큼. 엔진 정확도 유지가 제품 수명선.
- **정책 편집 UX** — Workspace 정책을 누가·어떻게 편집하는가의 거버넌스 (권한 모델과 연결).

### 비(非)영향

- [ADR 0001/0002/0003](0001-workspace-as-work-unit.md) 그대로. 이 ADR 은 Workspace 의 **네 번째 역할** 을 추가.
- Overlay 4-레이어 구조 유지. 지표는 기존 레이어에 얹힐 데이터.
- Agent Rules 는 별도 — 에이전트 행동 규약. 지표는 **코드·변경** 에 대한 계측.

## Workspace 역할 정리 (지금까지 누적)

| ADR | Workspace 의 역할 |
|-----|------------------|
| 0001 | 팀 공유 / 탭 컨테이너 |
| 0002 | 정적분석 스코프 경계 |
| 0003 | 세 축(Engine × AI × IDE)의 결합점 |
| **0004** | **SE 지표 정책·게이트·트렌드의 관할자** |

Workspace = **"우리 팀의 코드 세계 + 그 세계를 재는 기준 + 그 기준을 강제하는 게이트"**.

## 확정 사항

- **SE 원칙은 엔진 지표로 환원된다.** 환원 불가능한 원칙은 제품 범위 밖.
- **지표는 항상 노출된다.** 숨기기 옵션은 기본값 아님. 줄이려면 Workspace 정책으로 명시적 조정.
- **정책은 Workspace-scoped.** 개인 환경에서 임계값을 느슨하게 할 수 없음.
- **AI 출력물도 지표를 통과해야 한다.** 예외 없음.

## 열린 질문

1. **임계값 preset 배포** — 업계/언어/도메인별 프리셋을 누가 큐레이션하나. 팀이 빈 상태에서 시작하는 비용이 큼.
2. **거짓 양성 처리 UX** — 지표가 틀렸을 때 팀이 "무시/suppress" 하는 경로와, 그게 남용되지 않게 하는 가드.
3. **트렌드 저장 위치** — 로컬 git 히스토리로 파생 가능한지 vs 원격 저장 필요.
4. **개인 레벨 계기판** — 팀 정책과 별도로 "내 개인의 SE 품질 지표" 를 보여줄지(과도한 감시 이슈 존재).
5. **성장 / 온보딩 루프** — 신규 멤버가 지표를 어떻게 학습하게 할지. 단순 숫자가 아니라 맥락 교육.

---

## 참고

- [ADR 0001 — Workspace as Work Unit](0001-workspace-as-work-unit.md)
- [ADR 0002 — Workspace as Analysis Scope](0002-workspace-as-analysis-scope.md)
- [ADR 0003 — Three-Axis Positioning](0003-three-axis-positioning.md)
- [RFC — Overlay Architecture](../rfc/2026-04-14-overlay-architecture.md) — 지표 노출 레이어
- [RFC — Proof-Carrying PR](../rfc/2026-04-15-proof-carrying-pr.md) — 지표 기반 PR 게이트
- [RFC — Agent Rule Compliance Verifier](../rfc/2026-04-15-agent-rule-compliance-verifier.md)
- [RFC — Control Tower IDE](../rfc/2026-04-09-control-tower-ide.md) — "철학 주입" 의 원류
