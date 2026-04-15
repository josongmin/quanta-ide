# RFC: Agent Rules Manager

**날짜**: 2026-04-15
**상태**: 기획 중
**작성**: Jo + Claude

---

## 한 줄 정의

> **"룰은 한 번 쓰고, 각 에이전트 포맷으로 컴파일한다."**
> 중립 소스 → 타겟별 빌드. Claude / Cursor / Copilot / AGENT.md 파편화를 IDE 안에서 1급 기능으로 통합한다.

---

## 문제 (Problem)

에이전트가 늘어날수록 룰 파일이 파편화된다:

- `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `AGENT.md`, `.github/copilot-instructions.md`, `.continue/config.json` ...
- 각 에이전트마다 스키마, 허용 기능, frontmatter 규약이 다르다.
- 팀이 한 룰을 바꾸면 N개 파일을 동기화해야 한다. 누락되면 에이전트별로 동작이 달라진다.
- 역으로, 한 파일만 수정된 상태를 발견해도 "어느 게 원본인지" 알 수 없다.

현재는 보통 **symlink** 또는 **손수 복붙**으로 대응한다. 둘 다 규격 분기를 처리할 수 없다. Cursor가 지원하지 않는 tool-permission 섹션을 CLAUDE.md에 쓰면, 그 룰은 Cursor에서 조용히 무시된다.

이건 팀이 커질수록 비용이 선형 누적되는 **형식 관리 비용**이다. IDE가 풀 수 있는 가장 좋은 위치에 있는데, 아무도 풀지 않았다.

---

## 비(非)목표

- 룰 **내용**을 대신 써주지 않는다. Quanta는 포맷 변환과 검증을 제공한다.
- 각 에이전트를 실행하지 않는다. 룰 배포만 담당한다.
- 기존 파일과 싸우지 않는다. 사용자가 `.cursorrules`를 직접 편집해도 공존 모드로 동작.

---

## 설계 원칙

1. **One source, many targets** — 중립 소스 1개, 어댑터가 타겟별 산출.
2. **Capability-aware** — 각 어댑터는 자신이 지원하는 기능을 선언한다. 미지원 규칙은 빌드 시 경고.
3. **Plugin-first** — 에이전트 규격이 자주 바뀌므로 어댑터는 독립 플러그인. 코어와 분리 배포.
4. **Workspace, not settings** — "관리"는 작업이다. 설정화면이 아니라 전용 워크스페이스.
5. **Existing files are first-class** — 역파싱(import) 없이는 채택 안 된다.

---

## 데이터 모델

```
.agent/
├── rules.md            # 중립 소스 (superset)
├── rules/              # 선택: 룰 모듈 단위 분할
│   ├── style.md
│   └── testing.md
├── agent.config.toml   # 타겟 / 어댑터 / 빌드 옵션
└── .build/             # 빌드 산출물 (gitignore 권장, debug용)
```

### 중립 소스 예시 (`rules.md`)

````markdown
---
name: Project Rules
version: 1
scope: repo
---

## Commands
빌드: `pnpm -C p0-ide-v2 build`
테스트: `pnpm -C p0-ide-v2 test`

## Style
- TypeScript strict. any 금지.
- 파일당 단일 책임.

## Tool Permissions  {capability: tool-permission}
- allow: read, edit, grep
- deny: shell-without-confirm

## Scoped Rule  {scope: src/entities/engine}
엔진 계층은 UI 타입을 import하지 않는다.
````

- 섹션 옆 `{capability: ...}` 플래그로 특수 기능 선언.
- `{scope: path}` 로 부분 적용.
- 미플래그 섹션은 전 어댑터가 plain markdown으로 취급.

### 타겟 선언 (`agent.config.toml`)

```toml
[targets.claude]
output = "CLAUDE.md"
adapter = "claude"

[targets.cursor]
output = ".cursorrules"
adapter = "cursor"

[targets.copilot]
output = ".github/copilot-instructions.md"
adapter = "copilot"

[targets.agent_md]
output = "AGENT.md"
adapter = "neutral"         # 거의 그대로 렌더

[build]
auto_sync = true            # 저장 시 자동 빌드
warn_unsupported = true
on_conflict = "prompt"      # 타겟 파일이 외부 편집됐을 때
```

---

## 아키텍처

### 레이어

```
┌──────────────────────────────────────────┐
│  Rules Workspace (IDE)                   │  ← L3 inspector mode로 편입
├──────────────────────────────────────────┤
│  Build Pipeline                          │
│    parse → AST → lint → render (per tgt) │
├──────────────────────────────────────────┤
│  Adapter Registry (plugin)               │
│    claude / cursor / copilot / ...       │
├──────────────────────────────────────────┤
│  Core AST                                │
│    Document, Section, Rule, Capability   │
└──────────────────────────────────────────┘
```

### Core AST (축약)

```ts
type Document = {
  meta: { name: string; version: number; scope?: string }
  sections: Section[]
}

type Section = {
  title: string
  body: MarkdownNode[]
  scope?: string           // glob or path
  capabilities: string[]   // ["tool-permission"], ["frontmatter"], ...
}
```

### Adapter 인터페이스

```ts
interface Adapter {
  id: string
  capabilities: Capability[]       // 지원 선언
  parse(raw: string): Document     // 역파싱 (import용)
  render(doc: Document): string    // 포팅
  lint?(doc: Document): Diagnostic[]
}
```

- `capabilities` 선언이 **계약**. 코어가 이걸 보고 미지원 섹션에 warning을 단다.
- parse/render는 round-trip을 보장해야 한다 (테스트 강제).

### 어댑터 분리

- 코어는 `claude`, `cursor`, `copilot`, `neutral` 4개만 번들.
- 그 외는 `quanta-adapter-<name>` 패키지로 유저가 추가. 규격 변동 시 해당 패키지만 업데이트.

---

## IDE 통합

### Rules Workspace (신규 Inspector 모드 후보)

```
┌─── Agent Rules ──────────────────────────────┐
│  ┌────────────┬───────────────────────────┐  │
│  │ rules.md   │ Preview: [Claude▼]        │  │
│  │ (editor)   │ ─────────────────────────  │  │
│  │            │ # Project Rules           │  │
│  │            │ ...                       │  │
│  └────────────┴───────────────────────────┘  │
│  Build: ✓ claude ✓ cursor ⚠ copilot(1)        │
│  Warnings:                                    │
│   • "Tool Permissions" 섹션은 Cursor 미지원   │
└───────────────────────────────────────────────┘
```

- 좌: 중립 소스 에디터.
- 우: 타겟별 렌더 프리뷰 (탭 전환).
- 하단: 빌드 상태 + capability 경고.

Inspector 모드로 둘지, 별도 workspace로 둘지는 구현 단계에서 결정 (overlay architecture L3에 얹는 방식이 자연스러움).

### L2 Hover 기여

중립 소스 섹션 위에 마우스 올리면:
- 어느 타겟에서 어떻게 렌더되는지 요약.
- 미지원 타겟이 있으면 경고 뱃지.

### L4 단축키

| 바인딩 | 동작 |
|--------|------|
| `⌘⇧R` | Rules Workspace 열기 |
| `⌘B` (워크스페이스 내) | 수동 빌드 |
| `⌘⇧I` | Import 마법사 — 기존 파일 → 중립 소스 |

### 설정화면 접점

글로벌 설정에는 **진입점 한 줄만**:
> "Agent Rules 관리 → 워크스페이스 열기"

실제 편집/빌드/프리뷰는 전부 워크스페이스에서. 설정화면 sprawl 방지.

---

## Feature Registry (확장성 대비)

Agent Rules는 앞으로 올 **수십 개 기능 중 첫 번째**다. 지금 등록 패턴을 세워두지 않으면 VSCode 설정지옥을 반복하게 된다.

```ts
registerFeature({
  id: 'agent-rules',
  title: 'Agent Rules',
  workspace: RulesWorkspace,
  commands: [
    { id: 'rules.build', title: 'Build Agent Rules', run: buildAll },
    { id: 'rules.import', title: 'Import Existing Rules', run: importWizard },
  ],
  shortcuts: [
    { key: 'cmd+shift+r', command: 'rules.openWorkspace' },
  ],
  settingsSchema: { ... },    // 글로벌 설정에 자동 집계
  statusContribution: {
    id: 'rules-build-status',
    render: BuildStatusPill,
  },
})
```

- 기능 추가 = feature 모듈 하나.
- 커맨드 팔레트 / 단축키 / 설정화면 / 상태바 자동 집계.
- 각 기능은 자기 UI를 self-describe — 코어가 sprawl을 막는다.

이 RFC는 Feature Registry 도입의 **강제 드라이버**이기도 하다.

---

## Capabilities Surface (Hub)

Feature Registry는 탐색 surface 없이는 사용자가 기능의 존재조차 모른다. 반대로 숨김 원칙에 과몰입하면 제품 자체가 invisible해진다. 해결책은 **이미 존재하는 New Tab 페이지를 Capabilities Hub로 승격**하는 것.

Hub는 별도 소환 오버레이가 아니다. **탭이다.** `⌘T` / `+` / `⌘⇧H`로 열리는 New Tab 페이지가 곧 Hub. 이 선택은 IDE-native 멘탈 모델을 유지하고, takeover/dismiss 메커니즘을 구현하지 않게 해준다.

### 원칙

- **탭이 곧 surface.** 별도 오버레이/모달/풀스크린 takeover 없음. New Tab = Hub.
- **Settings ≠ Hub.** 상단 ⚙️ 아이콘은 순수 설정(theme, keybindings, account)만. feature 탐색과 섞지 않는다.
- **숨김은 dev-only에만 적용.** `visibility: 'user'`는 전부 Hub에 노출한다. feature는 scaffolding이 아니라 제품이다.
- **Top 3 + more.** 자주 쓰는 primary 3개는 크게, 나머지는 컴팩트 라인. 2026 SOTA: "discoverable but not sprawling".

### Layout

```
┌─ 🏠  order-service  payment-service  [New Tab ✕] +    🔍 🔔 ⚙️ 👤 ┐
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│              SOFTWARE INTELLIGENCE PLATFORM                        │
│         Where would you like to start?                             │
│                                                                    │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│   │ Open Repo  │  │ AI Agent   │  │ PR Review  │   ← primary tile   │
│   │            │  │            │  │            │                   │
│   │ Browse and │  │ Start a    │  │ Review PRs │                   │
│   │ load a repo│  │ coding     │  │ with auto- │                   │
│   │            │  │ session    │  │ fix        │                   │
│   └────────────┘  └────────────┘  └────────────┘                   │
│                                                                    │
│   ── more capabilities ──                        [ browse all → ]  │
│                                                                    │
│   Flow Analysis · Blast Radius · Incident DNA · Agent Rules        │
│   Simulate · Ownership · Behavior Diff · Dead Code                 │
│                                                                    │
│   RECENT                                                           │
│   payments-api    +248 -87  +3 changes                  1h ago     │
│   order-service   quiet      clean                      3h ago     │
│   ledger-core     +1.2k -140 12 in review               yesterday  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 인터랙션

**3단 디스커버리 깊이**:

1. **Glance** — 상단 3개 primary 타일. 가장 자주 쓰는 진입점. 고정(MVP) → MRU 학습(v0.2+).
2. **Scan** — "more capabilities" 라인. capability 이름만 텍스트 링크로 나열. 호버 시 해당 위치에 1줄 설명 reveal, 클릭 시 바로 실행.
3. **Browse** — 우측 "browse all →" 클릭 시 **같은 탭 안에서** full grid로 확장 (페이지 전환 아님, 인-뷰 토글). 카테고리(Intelligence / Editing / Rules / Integration / Workflow) + 상태 필터 + 검색.

**Full grid 확장 상태**:

```
┌─ [New Tab ✕]                                                       ┐
├────────────────────────────────────────────────────────────────────┤
│  Capabilities                                      ← back  🔎 /    │
│                                                                    │
│  [ All ] [ Intelligence ] [ Editing ] [ Rules ] [ Integration ]    │
│                                                                    │
│  INTELLIGENCE                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ Flow Analysis    │ │ Blast Radius     │ │ Incident DNA     │    │
│  │ taint → sink     │ │ change impact    │ │ pattern match    │    │
│  │ ● active   ⌘1    │ │ ● active   ⌘3    │ │ ○ off     new    │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│                                                                    │
│  EDITING                                                           │
│  ┌──────────────────┐ ┌──────────────────┐                         │
│  │ Agent Rules      │ │ Simulate         │                         │
│  │ neutral → any    │ │ predict diff     │                         │
│  │ ● active  ⌘⇧R   │ │ ● active   ⌘⇧S  │                         │
│  └──────────────────┘ └──────────────────┘                         │
│                                                                    │
│  ──  12 capabilities · 2 off · 1 beta                              │
└────────────────────────────────────────────────────────────────────┘
```

**카드 인터랙션**:
- Hover: `--surface-1` → `--surface-2` 배경만. scale/shadow 금지.
- Enter/Click: capability 기본 액션 실행 (보통 workspace open). 카드 1회 펄스 후 탭이 해당 workspace로 전환.
- `Space`: 우측 slide-in 상세 시트 (actions / settings / depends-on / state / disable).
- `⌘.`: 컨텍스트 메뉴.

### 시각 언어 (2026 SOTA × quanta)

- **Type-led hierarchy**: 17px title (`letter-spacing: -0.01em`) / 13px subtext / 11px mono uppercase meta.
- **색 절제**: 카드 색 없음. 상태 dot만 색 보유. `Beta`/`New` 뱃지는 텍스트 컬러만, 배경 없음.
- **좌측 border-stripe 금지.** (기존 원칙 유지)
- **Surface 3층**: `--surface-0` (탭 배경) / `--surface-1` (카드) / `--surface-2` (hover).
- **여백**: 카드 간 24px, 섹션 간 56px. 카드 내부는 16px (사이 넓고 안은 타이트).
- **모션**: 등장 120ms spring, 페이드 80ms, 실행 전환 180ms. stagger 금지.
- **아이콘**: 주 카드엔 없음. 상세 시트 안에서만 작은 line-icon.

### 진입 경로

| 경로 | 결과 |
|------|------|
| `⌘T` / `+` 탭 버튼 | 새 New Tab = Hub |
| `⌘⇧H` | 어디서든 → 새 Hub 탭 or 기존 New Tab으로 점프 |
| Command Palette → `"capabilities"` / 개별 capability명 | 팔레트 유저 |
| ⚙️ Settings → "Browse Capabilities →" 하단 링크 1개 | 최초 발견 (onboarding) |

**사이드바 1급 아이콘 없음** — 상주 chrome 낭비. 탭 소환 모델로 충분.

### Settings와의 역할 분리

| | Capabilities Hub | Settings |
|---|---|---|
| 목적 | 탐색 | 값 조정 |
| 진입 | `⌘T` / `⌘⇧H` | 상단 ⚙️ |
| 내용 | feature 카탈로그, 실행 | theme, keybinding, account, sync, feature별 setting 집계 |
| sprawl 방지 | Hub 하나로 수렴 | flat list 고정 |

Settings 안에 feature 탐색 UI를 **두지 않는다**. 단, Settings 하단에 Hub 진입 링크 1개는 허용(발견성).

### Dev Console (개발자향, 유지)

커맨드 팔레트 `Quanta: Open Dev Console` 또는 `⌘⌥⇧D` (IDE에서 쓰지 않는 조합). 사용자에게는 존재가 드러나지 않는다.

```
┌── Dev Console ─────────────────────────────────────────────────────┐
│ [ Features ] [ Events ] [ Registry Graph ]                 ✕ close │
├────────────────────────────────┬───────────────────────────────────┤
│ FEATURES (12)        filter: ▢ │ Agent Rules                        │
│                                │ ─────────────────────────────────  │
│ ● agent-rules         active   │ id           agent-rules           │
│ ● flow-analysis       active   │ version      0.1.0                  │
│ ● overlay-l2          active   │ visibility   user                   │
│ ● engine-contract     active   │ state        active                 │
│ ● inspector           active   │ loaded       142ms                  │
│ ● bottom-panel        active   │                                     │
│ ○ incident-dna        disabled │ CONTRIBUTIONS                        │
│ ⚠ behavior-diff       error    │   commands     2                    │
│ ● simulate-overlay    active   │   shortcuts    1                    │
│ ...                            │   settings     1 schema             │
│                                │   status       1 pill               │
│                                │   workspace    1 (RulesWorkspace)   │
│                                │                                     │
│                                │ DEPENDS ON                           │
│                                │   → engine-contract                 │
│                                │   → inspector                       │
│                                │                                     │
│                                │ DEPENDED ON BY                       │
│                                │   ← bottom-panel (pane: agent)      │
│                                │                                     │
│                                │ [ reload ] [ disable ] [ logs → ]   │
└────────────────────────────────┴───────────────────────────────────┘
```

**탭 3개**:

1. **Features** (기본) — 좌측 리스트 + 우측 상세. 상태 dot, 로딩 시간, 기여 요약, 의존성 양방향, reload/disable/logs 액션. 에러 상태 feature는 상단 정렬 + 경고 아이콘.
2. **Events** — 최근 이벤트 스트림 (feature register / command invoke / shortcut hit / error). 모노스페이스, virtualized list. 디버깅용.
3. **Registry Graph** — feature 의존 그래프. 노드 = feature, 엣지 = depends-on. 문제 있는 노드만 색 강조. 큰 프로젝트 시각화용.

**스타일**: overlay-architecture RFC 원칙 그대로 — 플랫, 1px border, 숫자는 모노 + `tabular-nums`, 라벨은 10px uppercase. Dev Console은 "제품" 아닌 "도구"의 결이어야 함 — 의도적으로 밀도 높고 장식 없음.

### 동작 정책

- **Disable**: 런타임 즉시 unregister. 기여한 command/shortcut/status/workspace 전부 자동 회수. 재활성화는 reload 없이 가능.
- **Error state**: feature 로딩 중 throw하면 격리하고 나머지는 계속 로드. Dev Console에서 스택트레이스 노출.
- **Persistence**: enable/disable는 user settings에 저장. 팀 단위 강제가 필요하면 workspace settings에 `features.required: [...]` 선언 (v0.3+).

### MVP 범위 업데이트

v0.1에 들어갈 최소 단위:

- `visibility: 'user' | 'dev-only'` 필드를 feature manifest에 추가.
- `category: 'intelligence' | 'editing' | 'rules' | 'integration' | 'workflow'` 필드 추가.
- **Capabilities Hub**: New Tab 페이지에 "more capabilities" 라인 + "browse all" 확장 그리드. Top 3 primary 타일은 하드코딩 기본값.
- **Dev Console**: **Features 탭만** (Events / Registry Graph는 v0.2+).
- Hub / Dev Console 모두 같은 Feature Registry 데이터를 읽는다.

---

## Discovery Surface (Command Palette)

Hub가 **탐색 surface**라면, Command Palette는 **즉시 실행 surface**다. 두 면은 상호 보완: Hub는 "뭐가 있는지 모를 때", Palette는 "이름을 알고 바로 쓰고 싶을 때".

### 엔트리 포인트

| 단축키 | 스코프 |
|--------|--------|
| `⌘K` / `⌘P` | 범용 — commands + workspaces + files + settings 전부 |
| `⌘⇧P` | commands-only (VSCode 관습 유지) |
| `⌘⌥⇧D` | Dev Console (숨김) |

### 인덱싱 규칙 (Feature Registry 기반 자동)

Feature가 `registerFeature` 로 선언한 모든 기여가 자동 팔레트에 오른다.

- `commands[]` → 각 command가 한 항목. title + 설명 + 키힌트 노출.
- `workspace` → `"Open <Title> Workspace"` 항목이 자동 생성. 예: `"Open Agent Rules Workspace"`.
- `settingsSchema` → 설정 키가 검색어로 매칭. 선택 시 해당 Settings 섹션으로 점프.
- **Feature 이름 자체도 검색어**. `"agent rules"` → Open Workspace / Build / Import 3개 묶음으로 노출.

### 필터링 정책

- **`visibility: 'dev-only'`**: 기본 숨김. Dev Console 활성 세션이거나 `>dev ` 프리픽스 입력 시 노출.
- **disabled feature**: 완전 숨김이 아니라 **dim + 별도 그룹** ("Disabled features"). 선택 시 "활성화할까요?" 프롬프트. 기능 존재 자체를 교육한다.
- **컨텍스트 랭킹**: 현재 에디터 / Inspector 모드 / 선택된 심볼에 관련된 command는 상단 부스트. VSCode의 "when clause" 개념을 가볍게 차용.
- **최근 사용(MRU)**: 같은 command를 반복 호출하면 상위로. 단, dev-only 항목은 MRU에서도 조용히 유지(히스토리 노이즈 방지).

### UI

```
┌─── ⌘P ─────────────────────────────────────────────────┐
│ 🔎 agent rules_                                         │
├─────────────────────────────────────────────────────────┤
│ ▸ WORKSPACE                                             │
│   Open Agent Rules Workspace               ⌘⇧R         │
│                                                         │
│ ▸ COMMANDS                                              │
│   Build Agent Rules                                     │
│   Import Existing Rules                    ⌘⇧I         │
│                                                         │
│ ▸ SETTINGS                                              │
│   rules.autoSync                     currently: on      │
│                                                         │
│ ▸ DISABLED (1)                                          │
│   Incident DNA Match                 ⏻ click to enable  │
└─────────────────────────────────────────────────────────┘
```

- 섹션 헤더는 10px uppercase, `--fg-subtle` (overlay RFC 톤).
- 우측 키힌트/현재값은 모노 + `tabular-nums`.
- 좌측 border-stripe 없음. 그룹 구분은 헤더 라벨로만.

### MVP 범위 업데이트

v0.1 팔레트에 들어갈 최소:

- Commands + Workspace 자동 인덱싱.
- `visibility` 필터링.
- `⌘P` / `⌘⇧P` 2개 엔트리.

v0.2+: settings 인덱싱, disabled 그룹, 컨텍스트 랭킹, MRU, `>dev` 프리픽스.

---

## MVP 범위 (v0.1)

**Agent Rules 본체**:
1. 어댑터: **claude** + **cursor** 2개.
2. 파일: `.agent/rules.md` 단일 소스 (모듈 분할은 v0.2).
3. Build: 수동 커맨드 1개 (`rules.build`). watch는 v0.2.
4. Rules Workspace: 좌/우 2-pane + 빌드 버튼 + 경고 리스트.
5. Import 마법사: 기존 `CLAUDE.md` / `.cursorrules` → `rules.md` 역생성.

**Feature Registry 기반 설비** (Agent Rules가 첫 사용자):
6. Feature Registry 골격 — `registerFeature` + `visibility` + `category` 필드.
7. **Capabilities Hub** — New Tab에 "more capabilities" 라인 + "browse all" 확장 그리드. Top 3 primary 타일은 하드코딩.
8. **Command Palette** 자동 인덱싱 — commands + workspace, `visibility` 필터링, `⌘P` / `⌘⇧P` 엔트리.
9. **Dev Console** — `⌘⌥⇧D`, Features 탭만 (Events / Graph는 v0.2+).

v0.2+: watch/auto-sync, pre-commit hook, copilot/windsurf 어댑터, 모듈 분할, capability 경고 lint, 외부 편집 충돌 UI, Dev Console Events/Graph 탭, Hub MRU 학습, Command Palette settings 인덱싱.

---

## 열린 질문

1. **중립 포맷을 어디까지 superset으로 가져갈지** — 최소 공약수로 가면 무력해지고, 최대 합집합으로 가면 어댑터가 지저분해진다. v0.1은 "CLAUDE.md superset"에서 출발.
2. **round-trip 보장 수준** — 사용자가 `.cursorrules`를 직접 수정했을 때 어디까지 merge할지. v0.1은 "타겟 파일 외부 수정 감지 시 경고만".
3. **모듈 분할 규약** — `rules/*.md`을 어떻게 합칠지 (순서? 섹션 병합?). v0.2 과제.
4. **팀 공유** — `.agent/` 디렉토리만 git 커밋하면 충분한가, 아니면 중앙 레지스트리가 필요한가. 일단 git만으로 충분하다고 가정.

---

## 성공 지표

- 사용자가 `CLAUDE.md`와 `.cursorrules`를 **직접 편집하지 않게** 된다.
- 신규 에이전트 지원 = 어댑터 1개 추가로 끝난다 (코어 수정 0).
- 룰 변경 → 모든 타겟 sync까지 **저장 1회**.
- quanta-ide에 다음 기능이 추가될 때, Feature Registry 위에 얹히며 설정화면을 건드리지 않는다.
