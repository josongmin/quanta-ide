# RFC: Agent Orchestrator View + Handoff Bridge

**날짜**: 2026-04-15
**상태**: 기획 중
**작성**: Jo + Claude

---

## 한 줄 정의

> **"repo 를 잡고 있는 모든 에이전트를 한 화면에서 본다. 에이전트 간 이동 시 context 를 잃지 않는다."**
> 2026 은 한 repo 에 백그라운드 에이전트 + 액티브 에이전트 + 리뷰 에이전트 가 **동시** 붙는다. 그 상태를 1급으로 다루는 IDE 가 없다.

---

## 문제

한 repo 에 붙는 에이전트는 이미 복수다:
- 백그라운드 Devin / Codex / Claude Code (worktree 에서 장시간 자율 실행)
- 액티브 editor 세션 (Cursor / Windsurf / Claude Code)
- PR 리뷰 봇 (CodeRabbit / GitHub Copilot Chat / custom)
- 스케줄 에이전트 (nightly refactor, dep-upgrade bot)

그런데 IDE 는 지금도 **단일 세션** 가정으로 만들어져 있다:
1. 다른 에이전트가 같은 파일을 편집 중인 걸 모른다 → 충돌
2. 에이전트 간 이동 = context 재구축 (grep · read 반복 = 비용 폭발)
3. "지금 백그라운드 에이전트가 뭐하고 있나" 관찰 수단이 없음 → 블랙박스
4. 3시간 뒤에 돌아오면 에이전트가 어디까지 갔는지 코드 diff 로만 역추적

멀티 에이전트가 기본값인데 IDE 만 혼자 단일 에이전트 UX 에 살고 있다. 이 구멍이 2026 의 **blue ocean**.

---

## 비(非)목표

- 에이전트를 대신 실행하지 않는다. Quanta 는 **관찰 + 조정** 을 제공.
- 에이전트 간 프로토콜 표준화 시도 안 함. adapter 로 각 에이전트의 런타임 상태를 수집.
- 자동 충돌 해결 안 함. 감지 + 수동 조정 전용.

---

## 설계 원칙

1. **Agents are first-class entities** — 파일·심볼처럼 `AgentInstance` 가 entity 레이어에 있다.
2. **Observe by adapter, not by integration** — 각 에이전트는 adapter 가 상태를 수집 (polling · MCP · stdout tail). 코어는 에이전트 런타임을 몰라도 됨.
3. **Locks are advisory** — 에이전트가 특정 파일 편집 선언 시 lock 표시. 강제 차단 아님, 경고.
4. **Handoff = serializable snapshot** — 에이전트 전환 = 현재 상태를 교환 가능한 snapshot 으로 패킹.
5. **Background visibility first** — 현재 세션 에이전트는 이미 보인다. 숨겨진 에이전트를 드러내는 데 집중.

---

## 데이터 모델

### Agent entity

```ts
type AgentInstance = {
  id: string                      // stable ID across sessions
  kind: "interactive" | "background" | "review-bot" | "scheduled"
  runtime: "claude-code" | "cursor" | "devin" | "codex" | "github-copilot" | string
  status: "idle" | "working" | "blocked" | "done" | "errored"
  startedAt: number
  lastActiveAt: number
  workingOn: {
    files: string[]               // currently edited/reading
    task?: string                 // declared goal
    branch?: string               // worktree branch if any
  }
  metrics: {
    tokensIn: number
    tokensOut: number
    costUsd: number
    actionsCount: number
  }
  health: {
    drift?: number                // 0-1, 이상 감지 (Agent Drift Monitor RFC)
    lies?: number                 // compliance lie-detected count
  }
}
```

### Adapter 인터페이스

```ts
interface AgentAdapter {
  id: string                      // "claude-code", "devin", ...
  discover(): AgentInstance[]     // 현재 repo 에 붙은 인스턴스 목록
  subscribe(id: string): AsyncIterable<AgentEvent>  // 상태 변화 스트림
  snapshot(id: string): Promise<AgentSnapshot>      // 현재 전체 상태 (handoff 용)
  apply(id: string, snapshot: AgentSnapshot): Promise<void>  // 다른 에이전트 상태를 흡수
}

type AgentEvent =
  | { kind: "file-touch"; path: string; op: "read" | "edit" }
  | { kind: "status-change"; to: AgentInstance["status"] }
  | { kind: "task-update"; task: string }
  | { kind: "metric"; tokensDelta: number; costDelta: number }
```

### Handoff snapshot

```ts
type AgentSnapshot = {
  version: "1"
  sourceAgent: string
  capturedAt: number
  context: {
    files: { path: string; pinned: boolean; summary?: string }[]
    symbols: string[]
    memory: { type: string; name: string; body: string }[]
    tasks: { state: string; content: string }[]
  }
  rules: { source: string; hash: string }   // Rules Manager 와 동기
  history: {
    recentTurns: { t: string; kind: string; note: string }[]
  }
}
```

- **타겟 에이전트 adapter** 가 apply 시 자기 포맷으로 변환 (Rules Manager 와 같은 adapter 패턴).
- snapshot 은 JSON + 별도 payload (e.g. 파일 본문 해시만, 본문은 필요시 fetch).

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│  Orchestrator View (IDE)                 │  ← 신규 workspace
├──────────────────────────────────────────┤
│  Agent Observer                          │
│    discover · subscribe · merge          │
├──────────────────────────────────────────┤
│  Handoff Pipeline                        │
│    snapshot(src) → transform → apply(dst)│
├──────────────────────────────────────────┤
│  Adapter Registry (plugin)               │
│    claude-code / devin / cursor / ...    │
├──────────────────────────────────────────┤
│  File Lock Registry                      │
│    path → [agents currently touching]    │
└──────────────────────────────────────────┘
```

---

## IDE 통합

### 신규 Workspace: "Agents"

```
┌─── Agents ──────────────────────────────────────────────────┐
│ ● claude-code (you)           editing orchestrator.py        │
│   task: Harden taint sink                                    │
│   t+4m · 18k tok · $0.24                                     │
│                                                              │
│ ● devin-0xA3                  background · branch/refactor   │
│   task: Extract auth module                                  │
│   t+2h 14m · 320k tok · $4.80 · drift 0.18                   │
│   editing: auth/*, user_service.py      [LOCK: 3 files]      │
│                                                              │
│ ○ coderabbit                  review-bot · PR #482           │
│   status: idle  · last: 12m ago                              │
│                                                              │
│ ⚠ codex-nightly               scheduled · next 03:00         │
│   task: Dep upgrade sweep                                    │
└──────────────────────────────────────────────────────────────┘
```

각 행 클릭 → 상세 패널:
- workingOn files 리스트 (링크)
- task 변경 이력
- 토큰·비용 sparkline (세션 전체)
- drift / lies 헬스 지표
- Actions: `[Handoff to me →]` `[Pause]` `[Terminate]` (adapter 가 지원하면)

### L1 gutter 경고 — Agent-in-file lock

다른 에이전트가 편집 중인 파일:
- editor tab 에 작은 agent-id 뱃지 (`devin-0xA3`)
- gutter 에 해당 라인 옆 점
- 저장 시 경고 모달: "이 파일은 devin 이 편집 중. 진행?"

### L2 hover — Agent touch provenance

심볼 호버 시 기존 정보에 더해:
```
last touched: devin-0xA3, 32m ago
recent turns: 3 (grep, read, edit)
```

### L4 단축키

| 바인딩 | 동작 |
|--------|------|
| `⌘⇧A` | Agents workspace 열기 |
| `⌘⇧H` | Handoff from selected agent → current session |
| `⌘⇧L` | Lock current file for current session |

### Statusbar contribution

활성 에이전트 수 + 락 충돌 여부 pill:
```
● 3 agents · 1 lock conflict
```

---

## Handoff Bridge 시나리오

1. 사용자가 Agents workspace 에서 `devin-0xA3` 에서 "Handoff to me" 클릭
2. devin adapter `snapshot()` → 내부 포맷 생성 (context pins, memory, pending tasks, recent turn summaries)
3. **transform layer** 가 target adapter (claude-code) 포맷으로 번역 — Rules Manager 와 공통 엔진
4. claude-code adapter `apply(snapshot)` → 현재 세션이 컨텍스트/메모리/task 를 흡수, 사용자에게 요약 표시:
   ```
   HANDED OFF FROM devin-0xA3
   · 8 files pinned into context (12k tok)
   · 3 pending tasks copied to global todo
   · 2 rule memory entries merged
   · recent turns: summarized as context
   ```
5. 사용자 세션 이어서 작업

**Round-trip** 은 보장 안 함 (에이전트 런타임이 다르면 lossless 어려움). lossy 는 UI 에 명시.

---

## Feature Registry

```ts
registerFeature({
  id: "agent-orchestrator",
  title: "Agents",
  workspace: AgentsWorkspace,
  commands: [
    { id: "agents.open", title: "Open Agents workspace", run: open },
    { id: "agents.handoff", title: "Handoff from agent", run: handoffFlow },
    { id: "agents.lock", title: "Lock current file", run: lockCurrent },
  ],
  shortcuts: [
    { key: "cmd+shift+a", command: "agents.open" },
    { key: "cmd+shift+h", command: "agents.handoff" },
  ],
  statusContribution: { id: "agents-status", render: AgentsStatusPill },
})
```

---

## MVP 범위 (v0.1)

1. adapter 2개: **claude-code** (self) + **devin** (webhook/API polling).
2. Agents workspace 좌측 리스트 + 우측 상세.
3. File-lock advisory — 저장 시 경고 모달만.
4. Handoff: **devin → claude-code** 단방향 (v0.2 양방향).
5. Statusbar agents count pill.

v0.2+: cursor / copilot adapter, 역방향 handoff, drift / lies 지표 (Rule Compliance Verifier 와 연계), 충돌 자동 해결 제안, ⌘⇧H UI.

---

## 열린 질문

1. **adapter 가 필요한 최소 권한** — 백그라운드 에이전트의 실시간 상태를 읽으려면 에이전트 벤더가 API 를 열어야 함. 벤더 협조 없으면 파일시스템 이벤트 / git log 로 후처리 추론.
2. **snapshot 보안** — handoff 에 민감 데이터 섞일 수 있음. 로컬 전용 보장 + 암호화.
3. **adapter version skew** — 에이전트 런타임 업데이트 시 adapter 깨짐. Rules Manager 와 같은 플러그인 규율 필요.
4. **권한 위임** — "내 세션 handoff 받아서 devin 이 계속" 은 자동 가능해야 하나, 수동 동의 필요한가.

---

## 성공 지표

- repo 에 붙은 에이전트를 **한 화면에서** 확인 가능 — 현재 어느 IDE 도 못 함.
- 파일 충돌이 저장 시점에 잡힘 (충돌 후 머지 고통 감소).
- Handoff 1회 성공률 > 80% (context loss ≤ 20% 기준, 사용자 자체 평가).
- "백그라운드 에이전트가 뭐하고 있는지 모른다" 고 불평하는 사용자 리포트 감소.
