# RFC: Proof-Carrying PR

**날짜**: 2026-04-15
**상태**: 기획 중
**작성**: Jo + Claude
**의존**: Rule Compliance Verifier · Counterfactual Branch · Patch Trail

---

## 한 줄 정의

> **"AI PR 은 증거와 함께 온다. 리뷰어는 엔진이 검증한 부분은 스킵하고 불확실한 부분만 본다."**
> 리뷰 exhaustion 의 해법은 리뷰어를 늘리는 게 아니라 **어디를 안 봐도 되는지** 를 증거로 고정해 주는 것이다. PR 이 자체 검증 증명을 싣는다.

---

## 문제

2026 의 팀 개발은 이미 AI PR overflow 상태다:
- 팀이 하루 5개 쓰던 PR 이 에이전트로 20개로 불어남
- 리뷰어는 여전히 사람 → 1인당 하루 4배 리뷰 → **리뷰 exhaustion**
- 결과: "승인만 누르는" 리뷰 / "쌓아두는" 리뷰 / 머지 속도 vs 품질 trade-off 악화

해결 시도들:
- **자동 리뷰 봇** (CodeRabbit, GitHub Copilot Review): 주석 달아주지만 신뢰도 낮고 인간이 또 확인
- **CI 게이트**: pass/fail 만. "어디가 안전한지" 는 안 알려줌
- **PR 템플릿**: 작성자 자가보고. 신뢰할 수 없음

엔진이 이미 taint / blast / behavior diff / type / arch / coverage / compliance 를 알고 있다면, PR 이 **"이 파일의 이 부분은 엔진이 검증했고 이 부분은 안 했다"** 를 실어 보낼 수 있다. 리뷰어는 검증 안 된 부분만 집중한다. **리뷰 범위를 줄이는 게 유일한 출구다.**

---

## 비(非)목표

- 자동 승인 / 자동 merge 안 함 (설정으로 선택은 가능). 기본은 보조.
- 코드 품질 판단 대체 안 함. 구조적 안전성만 증명.
- GitHub / GitLab 의 리뷰 UI 를 대체 안 함. **증거를 그 위에 얹는다**.

---

## 설계 원칙

1. **Proof travels with PR** — 증거는 PR 메타데이터 (PR body · commit trailer · attached file) 에 내장. 별도 서버 의존 X.
2. **Per-hunk attestation** — PR 단위가 아니라 **hunk** 단위로 증거. "이 파일은 통과, 저 파일은 미검증" 가능.
3. **Verifier independence** — PR 은 어느 버전의 verifier 로 서명됐는지 기록. 검증자가 업그레이드되면 재검증.
4. **Human-readable proof** — proof 는 기계용 JSON + 인간용 마크다운 두 버전 병행.
5. **Signed, revocable** — 증거는 서명된 토큰 (Compliance Verifier 의 evidence token 재사용). 사후 수정 시 무효화.

---

## 데이터 모델

### PR proof payload

```ts
type ProofCarryingPR = {
  prId: string
  commitSha: string
  generatedAt: number
  generator: {
    engineVersion: string
    verifierVersions: Record<string, string>   // verifier id → version
  }

  coverage: {
    totalHunks: number
    verifiedHunks: number
    ratio: number                              // 0-1
  }

  attestations: HunkAttestation[]
  counterfactuals: {
    apply: ProjectionSummary                   // 요약
    dismiss: ProjectionSummary
  }
  complianceSummary: {
    pass: number
    fail: number
    unknown: number
    liesDetected: number
  }
  patchTrailRefs: string[]                     // 이 심볼들에 대한 과거 patch 이력
  signature: string                            // evidence token
}

type HunkAttestation = {
  file: string
  hunkHeader: string                           // e.g. "@@ -12,6 +12,8 @@"
  verified: boolean
  checks: {
    verifier: string                           // "taint v2", "behavior diff", ...
    status: "pass" | "fail" | "unknown"
    detail?: string
  }[]
  risk: { before: number; after: number }
  classification: "mechanical" | "logic-preserved" | "new-behavior" | "risky"
}
```

### 분류 (classification)

리뷰어가 집중할 곳을 결정하는 핵심:

| classification | 의미 | 리뷰 제안 |
|----------------|------|-----------|
| `mechanical` | rename · formatting · lint fix — 엔진이 behavior-identical 확인 | **skip** |
| `logic-preserved` | 구조 변경이지만 behavior diff 가 의미적 동일 확인 | **skim** |
| `new-behavior` | 새 기능 · 의도된 동작 변경 | **review** |
| `risky` | 엔진이 "검증 불가" 또는 "잠재적 위험" 표시 | **focus** |

리뷰어가 `risky` 한 청크만 보게 되면 리뷰 부담이 드라마틱하게 준다.

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│  PR Creation / Update                    │
│    (git push · gh pr create)             │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Proof Generator                         │
│    per-hunk verifier run                 │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Classifier                              │
│    mechanical / logic / new / risky      │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  Proof Serializer                        │
│    json + markdown                       │
└──────────────────┬───────────────────────┘
                   ▼
┌──────────────────────────────────────────┐
│  PR Attacher                             │
│    commit trailer · PR body · file       │
└──────────────────────────────────────────┘
```

### Proof 부착 방식 (GitHub 기준)

1. **Commit trailer** (기계용): `Quanta-Proof: sha256:...`
2. **PR body** 섹션 (인간용):
   ```
   ## 🛡️ Engine proof
   Verified 42/48 hunks · 3 risky spots · counterfactual cost: +3.5 eng-days
   <details>
     <summary>Full attestation</summary>
     ...markdown...
   </details>
   ```
3. **PR attached file** `.quanta-proof.json` (full payload)
4. **GitHub check** (선택): `Quanta Proof` check status

로컬 워크플로우:
- `quanta pr prepare` 커맨드 — 현재 branch 로부터 proof 생성 + push
- `gh` 대체가 아님, 보조

---

## IDE 통합

### Review dashboard (신규 workspace: "Reviews")

```
┌─── Reviews · waiting ─────────────────────────────────────┐
│  AI PRs pending                                            │
│                                                            │
│  ● #482  Agent: claude-code      14h ago                   │
│     Harden taint sink                                      │
│     ▓ verified 42/48  ⚠ 3 risky  ·  cf: +2.8 ed            │
│     [1-click review →]                                     │
│                                                            │
│  ● #481  Agent: devin           1d ago                     │
│     Extract auth module                                    │
│     ▓ verified 67/120  ⚠ 8 risky  ·  cf: +5.4 ed           │
│     [skim non-risky · focus risky →]                       │
│                                                            │
│  ○ #479  Agent: nightly         2d ago                     │
│     Dep upgrade sweep                                      │
│     ▓ verified 200/200  (mechanical)                       │
│     [✓ auto-merge ready]                                   │
└────────────────────────────────────────────────────────────┘
```

PR 을 **검증 ratio + risky count + counterfactual** 로 **티어 분류**:
- `auto-merge ready`: 100% mechanical 또는 logic-preserved, 0 risky
- `focus risky`: 일부 risky, 리뷰어 집중 대상
- `full review`: 증거 부족, 수동 전체 리뷰 필요

### Per-PR review view

PR 클릭 → 상세:
```
┌─── PR #482 · Harden taint sink ──────────────────────────┐
│  SUMMARY                                                  │
│    ▓▓▓▓▓▓▓▓▓▓▓░░░  42/48 verified  (88%)                  │
│    3 risky · 0 lies                                       │
│                                                           │
│  COUNTERFACTUAL                                           │
│    apply: 0.3 ed  ·  dismiss: 2.8 ed                      │
│    [view graph →]                                         │
│                                                           │
│  COMPLIANCE                                               │
│    7 rules checked · 7 pass                               │
│                                                           │
│  HUNKS                                                    │
│    ✓ orchestrator.py L212-218    mechanical               │
│    ✓ orchestrator.py L226-230    logic-preserved          │
│    ⚠ experience_store.py L84-92  risky  ← FOCUS HERE      │
│    ✓ tests/test_orchestrator.py  new-behavior             │
│    ...                                                    │
│                                                           │
│  [Open in GitHub]  [Approve verified]  [Review risky]     │
└───────────────────────────────────────────────────────────┘
```

- `risky` hunk 는 빨간 포커스 뱃지
- `Approve verified` 버튼 = risky 이외를 일괄 승인 (GitHub review API)
- `Review risky` = risky hunk 만 표시하는 집중 뷰로 이동

### Editor inline marks

로컬에서 PR branch 체크아웃 시:
- mechanical hunk: gutter 에 회색 체크
- logic-preserved: 초록 체크
- new-behavior: 노란 점
- risky: 빨간 느낌표

사용자가 편집기에서 바로 "위험 hunk" 만 탐색 가능.

---

## 연계되는 다른 RFC

- **Rule Compliance Verifier**: `attestations[i].checks` 의 기반. verifier 레이어 동일.
- **Counterfactual Branch**: `counterfactuals` 필드에 apply/dismiss 비용 첨부.
- **Patch Trail (Topic ③)**: `patchTrailRefs` 로 과거 이력 링크. 리뷰어가 "이 심볼은 과거에 이렇게 고쳐졌었네" 확인.
- **Agent Orchestrator**: 어느 에이전트가 만든 PR 인지 메타데이터에 포함.

---

## Feature Registry

```ts
registerFeature({
  id: "proof-carrying-pr",
  title: "Proof-Carrying PR",
  workspace: ReviewsWorkspace,
  dependsOn: ["compliance-verifier", "counterfactual"],
  commands: [
    { id: "reviews.open", title: "Open reviews dashboard", run: open },
    { id: "pr.prepare", title: "Prepare PR with proof", run: prepare },
    { id: "pr.verify", title: "Verify current PR", run: verify },
    { id: "pr.approveVerified", title: "Approve all verified hunks", run: approveVerified },
  ],
  shortcuts: [
    { key: "cmd+shift+r", command: "reviews.open" },
  ],
  statusContribution: { id: "review-queue", render: ReviewQueuePill },
})
```

---

## MVP 범위 (v0.1)

1. Proof generator — per-hunk verifier 실행, JSON 직렬화
2. `quanta pr prepare` CLI — 로컬에서 proof 생성 + PR body 에 markdown 섹션 주입 + `.quanta-proof.json` 첨부
3. GitHub only (GitLab · Bitbucket 은 v0.2+)
4. Reviews workspace 좌측 리스트 + 우측 상세
5. 분류 4티어 + "Approve verified" 일괄 승인
6. Editor inline marks (체크아웃 시)

v0.2+: GitHub check API 로 체크 통합 / counterfactual 그래프 PR inline 렌더 / 증거 서명 + revocation / auto-merge 정책 / GitLab / Bitbucket / 팀 대시보드 (주간 verified ratio 트렌드)

---

## 열린 질문

1. **GitHub 권한** — Proof 를 PR body 에 주입하려면 GitHub app / token 필요. 최소 권한 설계.
2. **분류 신뢰도** — `mechanical` 분류가 틀리면 (새 버그를 안전하다고 표시) 신뢰 무너짐. 보수적으로 기본값 = "unknown → review".
3. **인간 PR 도 지원?** — 에이전트 PR 만 겨냥 vs 모든 PR 에 적용. 후자면 "인간 기여를 엔진이 검증하는" 팀 수용성 이슈.
4. **proof 크기** — 큰 PR 은 proof payload 가 커서 PR body 한계 초과. 첨부 파일 전략 필요.

---

## 성공 지표

- **리뷰 시간 단축** — 베이스라인 대비 PR 당 평균 리뷰 시간 감소 (verified ratio 높은 PR 일수록 유의미).
- **리뷰 범위** — 리뷰어가 실제로 연 hunk 의 `risky` 비율 > 70% (집중 효과).
- **auto-merge ready 비율** — 전체 AI PR 중 증거로 자동 merge 가능한 비율 측정.
- **팀이 "proof 없으면 merge 안 함" 규범을 채택** — 문화 지표.
- **incident 회귀** — Proof 가 통과된 PR 에서 incident 발생률이 일반 PR 대비 유의미하게 낮다.
