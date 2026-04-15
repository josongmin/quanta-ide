# RFC: Agent Rule Compliance Verifier

**날짜**: 2026-04-15
**상태**: 기획 중
**작성**: Jo + Claude
**의존**: `2026-04-15-agent-rules-manager.md` (Rules Manager)

---

## 한 줄 정의

> **"룰은 컴파일되는 문서가 아니라 엔진이 런타임에 검증하는 계약이다."**
> Rules Manager 가 정의한 룰이 실제 에이전트 액션 후 지켜졌는지 엔진이 확인하고, 거짓말 / 위반 / drift 를 compliance log 에 박는다.

---

## 문제

에이전트는 **자가보고** 로 움직인다.
- "테스트 통과했어" → 실제로는 실패
- "public API 안 건드렸어" → signature 바뀜
- "arch rule 지켰어" → domain 에서 infra import
- "validate_trace 호출 추가했어" → 다른 경로에서 우회

사람이 매번 grep 으로 확인하면 에이전트를 쓰는 의미가 없다. IDE 가 룰을 **문서 포맷**으로만 다루면 배포만 되고 검증은 안 된다.

Rules Manager RFC 는 "룰 작성·배포" 문제를 푼다. 이 RFC 는 그 다음 단계 — **"룰이 실제로 지켜졌는가"** 를 엔진이 구조 신호로 검증한다. 에이전트 자가보고 → 엔진 재검증 → compliance 기록 파이프라인.

---

## 비(非)목표

- 에이전트를 감옥에 가두지 않는다. 위반해도 막지 않고 **기록** 한다. 막는 건 hook 레이어가 따로.
- 모든 룰을 자동 검증하지 않는다. 엔진 신호로 reachable 한 룰만 (나머지는 best-effort lint).
- 룰 자체를 생성·수정하지 않는다. 검증만.

---

## 설계 원칙

1. **Rule = contract + verifier** — 룰 섹션에 `{verify: ...}` 플래그가 있으면 엔진이 본다. 플래그 없는 룰은 plain 문서.
2. **Post-action, not preflight** — 에이전트 액션이 끝난 뒤 엔진이 **차분(diff)** 을 상대로 재검증. preflight 는 다른 기능.
3. **Fact-backed, not string-matched** — "에이전트가 '통과했다' 라고 썼다" 가 아니라 엔진 신호로 확인. taint · blast · behavior diff · arch · type check.
4. **Attested, not logged only** — 통과한 액션은 서명 받음 (evidence token). 이후 수작업 수정 시 서명 무효.
5. **No silent pass** — 검증 불가한 룰은 compliance 에서 `unknown` 상태로 남음. `pass` 를 가짜로 만들지 않음.

---

## 데이터 모델

### 룰 섹션에 verifier 플래그

```markdown
## Arch: domain imports  {verify: arch.no-import-from, from: domain, to: [infra, adapter]}
도메인 계층은 infra / adapter 를 import 하지 않는다.

## Taint: store sinks  {verify: taint.no-sink-without-sanitizer, sinks: [ExperienceStore.save], sanitizers: [validate_trace]}
persistence 계층에 들어가는 trace 는 validator 를 거쳐야 한다.

## Tests: coverage  {verify: coverage.branch, min: 0.8}
변경된 함수의 브랜치 커버리지는 80% 이상.
```

- verifier id 는 엔진 capability 에 매핑 (`arch.no-import-from` / `taint.no-sink-without-sanitizer` / `coverage.branch` / `behavior.no-api-break` / `typestate.protocol-conformant` ...).
- 파라미터는 engine-specific.
- verifier 가 모르는 id 면 compliance `unknown`.

### Verifier 인터페이스

```ts
interface Verifier {
  id: string
  capabilities: string[]               // 의존 엔진 신호
  check(params: unknown, change: ChangeSet): VerifyResult
}

type VerifyResult =
  | { status: "pass"; evidence: EvidenceRef[] }
  | { status: "fail"; evidence: EvidenceRef[]; violations: Violation[] }
  | { status: "unknown"; reason: string }

type ChangeSet = {
  files: string[]
  diffHunks: DiffHunk[]
  author: "human" | "agent"
  agentId?: string
  sessionId?: string
  claim?: string                       // 에이전트 자가보고 (있으면)
}
```

### Compliance 로그 스키마

```ts
type ComplianceEvent = {
  ts: number
  changeSetId: string
  ruleId: string
  verifierId: string
  status: "pass" | "fail" | "unknown"
  agentClaim?: string                  // "tests pass" 등
  agentClaimVerified: boolean          // 엔진 결과와 일치하는가
  violations?: Violation[]
  evidenceTokenId?: string             // pass 시 발급된 서명
}
```

- 위반 + 자가보고 불일치 = `lie-detected` 하위 분류. 팀 대시보드의 핵심 지표.

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│  Agent action (edit / patch / commit)    │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Change capture (git-hook / IDE event)   │
│    ChangeSet + agent claim               │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Rule Resolver                           │
│    rules.md → active rules for changeset │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Verifier Pipeline (parallel)            │
│    taint · arch · behavior · coverage …  │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Compliance Sink                         │
│    log · evidence sign · UI surface      │
└──────────────────────────────────────────┘
```

### 트리거

- **Agent patch apply** (inspector L3 Apply 버튼)
- **Git commit** (pre-commit hook 옵션)
- **Agent claim submit** (에이전트 "done" 선언 시)
- **Manual** (`rules.verify` 커맨드)

### Evidence Token (Proof-Carrying PR 로 연결)

- pass 이벤트마다 `(ruleId, changeSetSha, timestamp, verifierVersion)` 을 서명
- `.agent/.compliance/` 에 append-only 저장 (기본 gitignore, 팀 공유는 선택)
- 이후 동일 코드가 수정되면 → change detector 가 관련 토큰 무효화 → UI 에 "proof lost, re-verify" 배너

---

## IDE 통합

### Inspector L3 — "Compliance" 서브 섹션

기존 Verification checklist 옆에 compliance summary 카드:
```
COMPLIANCE · for this patch
✓ arch: domain → infra rule           [arch.no-import-from]
✓ taint: save sink guarded            [taint.no-sink-without-sanitizer]
⚠ coverage: 72% branch (< 80% min)    [coverage.branch]
? tests-pass claim — no signal         [unknown]
```

- Apply 버튼은 `fail` 존재 시 `Apply anyway` 로 다운그레이드 (진행은 가능, 로그 박힘).
- `unknown` 다수면 "enable verifier plugins" 안내.

### Agent pane — "Compliance" 전용 섹션

기존 Grounding 섹션과 형제로:
```
COMPLIANCE · this session
  8 changes · 23 rules · 19 pass · 2 fail · 2 unknown
  Lies detected: 1   (claimed "no API break", behavior diff said otherwise)
  [open log →]
```

드로어 열면:
- 전체 이벤트 타임라인
- 위반별 필터
- `lie-detected` 는 red-emphasis

### Topbar status chip

에이전트가 `lie-detected` 일으킨 직후 5초간 danger chip:
`⚠ compliance: claim ↔ engine mismatch`

### Team dashboard (별도 page, `agent/compliance`)

- 팀 전체 compliance 통계
- 주별 lie-detection 건수 (에이전트별)
- 가장 자주 위반되는 rule Top 10 → Rule Drift Detector 로 연결

---

## Verifier 번들 (MVP 대상 5개)

| Verifier | 엔진 기반 | MVP 포함 |
|----------|-----------|----------|
| `arch.no-import-from` | 기존 arch rules | ✅ |
| `taint.no-sink-without-sanitizer` | taint v2 | ✅ |
| `behavior.no-api-break` | behavior diff | ✅ |
| `type.no-new-errors` | type check | ✅ |
| `coverage.branch` | coverage | ✅ |
| `typestate.protocol-conformant` | typestate | v0.2 |
| `test.claim-matches` | 실제 테스트 실행 결과 | v0.2 |

---

## Feature Registry 통합

```ts
registerFeature({
  id: "compliance-verifier",
  title: "Rule Compliance",
  dependsOn: ["agent-rules"],
  commands: [
    { id: "rules.verify", title: "Verify change against rules", run: verifyCurrent },
    { id: "rules.verify.session", title: "Show session compliance log", run: openComplianceLog },
  ],
  statusContribution: {
    id: "compliance-status",
    render: ComplianceStatusPill,
  },
  settingsSchema: { /* pre-commit hook toggle, fail-threshold */ },
})
```

- Rules Manager 에 의존 (`dependsOn`) — 룰 없이 혼자 못 산다.

---

## MVP 범위 (v0.1)

1. 5개 verifier 번들 (위 표).
2. Inspector L3 Compliance 서브섹션.
3. Trigger: Apply 버튼 + manual command.
4. Compliance log 로컬 저장 + Agent pane 섹션.
5. Evidence token: 서명 + 수동 invalidate (auto-invalidate 는 v0.2).

v0.2+: pre-commit hook · `lie-detected` 전용 UI · typestate/test verifier · 팀 대시보드 · 외부 verifier plugin API.

---

## 열린 질문

1. **에이전트 claim 캡처 경로** — MCP tool call? 자유 텍스트 응답 parsing? 에이전트마다 다르면 어뎁터 레이어 필요.
2. **fail 시 정책** — 기본은 "기록만". 팀 설정으로 block (pre-commit hook 수준) 옵션 제공하지만, IDE 레이어에서 Apply 차단은 안 함 (UX 마찰 과도).
3. **Evidence token 공유** — 로컬 전용 vs 서버 동기화. v0.1 로컬, v0.3+ 팀 레지스트리.
4. **verifier 버전 관리** — 같은 `arch.no-import-from` 라도 버전 업 되면 이전 서명 무효? 정책 필요.

---

## 성공 지표

- Apply 행동의 ≥ 80% 가 compliance 결과와 함께 기록된다.
- `lie-detected` 이벤트가 **감지** 된다 (숫자 자체는 훈장, 0 은 오히려 의심 신호).
- 팀이 arch rule 위반을 PR merge 전에 잡는 비율 증가 (baseline 측정 필요).
- 사용자가 "에이전트가 말한 것" 을 그대로 믿지 않고 compliance 탭을 **먼저** 본다.
