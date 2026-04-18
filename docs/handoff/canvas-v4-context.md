# Canvas v4 — Context Handoff for Next Agent

**목적**: 다른 Claude 에이전트가 이 프로젝트를 이어받아 확장 작업을 할 수 있도록 모든 필요한 맥락을 한 문서에.

> 이 문서를 새 Claude 세션에 붙여넣기하면 즉시 working state로 진입 가능.

---

## 1. 프로젝트 정체성

- **이름**: Quanta IDE (코드 유니버스 캔버스 내장)
- **카테고리**: Software Intelligence Platform (SE Infrastructure Layer)
- **피칭**: "코드를 이해하는 인프라"
- **핵심 기능**: 리포 전체를 2D 캔버스로 시각화 + 분석 overlay + 협업 surface
- **User-facing 이름**: "Code Universe" (코드유니버스); 내부 코드는 `workspace-canvas` / `canvas-engine`
- **위치**: `p0-ide-v2/` 모노레포
- **현재 브랜치**: `redesign/ide-shell` (main은 `main`, 현재 브랜치가 active working branch)
- **언어/스택**: TypeScript strict, React 19, PixiJS v8, Vite, bun (package runner), vitest

---

## 2. 이미 구축된 것 (Stage 0 → Batch 8)

### 2.1 핵심 데이터 모델 (`canvas-engine`)

- **EdgeKind** 19종 × **EdgeLayer** 4종 (structural/flow/safety/impact) × **EdgeSeverity** 4단계
- **Line anchor** — `FileEdge.fromLine/toLine/fromSymbol/toSymbol` (Sourcetrail-style)
- **Multi-graph join** — 여러 repo를 `graphId::` prefix로 병합, cross-graph edges 골드 dashed
- **History snapshots** — 시간별 edge delta (temporal slider + diff)
- **Proof bundles** — `evidenceId` → `ProofBundle` with `WitnessStep[]` (Semgrep/CodeQL style)
- **Blame data** — per-file line-age stripes (GitLens)
- **Effects + Latency** — 9 effect kinds + p50/p95/p99
- **Traces** — runtime call trace edges (Honeycomb/OTel)

### 2.2 분석 엔진 (`canvas-engine/src/graph/*`)

- `computeNeighborhood` — BFS k-hop
- `computeWorkspaceMetrics` — degree + Brandes betweenness (≤500 exact, >500 sampled 128)
- `findStronglyConnectedComponents` — Tarjan iterative
- `findPaths` — BFS + Yen's k-shortest
- `rankStartHere` — 0.45 centrality + 0.30 entryPoint + 0.25 risk
- `detectArchViolations` — Clean/Hexagonal layer policy
- `compileEdgeFilter` + `getCompletions` — DSL 파서 + context-aware autocomplete
- `joinGraphs` — multi-repo merge
- `elevationFromRisk` — 3D shadow depth
- `aggregateClusterEdges` — supergalaxy super-edges
- `stripesFromBlame` / `ageColor` — GitLens gutter

### 2.3 렌더러 (`canvas-pixi/src/renderers/*`)

| 렌더러 | 용도 |
|---|---|
| `GalaxyNodeRenderer` / `CityNodeRenderer` / `StreetCard` / `GroundCard` | 4-tier InstancedRectMesh 노드 |
| `EdgeStaticRenderer` | 메인 엣지 — dashed + arrow + glow dot + X-cap + animated Ticker + focus dim + arch halo + cross-graph gold + diff green/red |
| `EdgeOverlayRenderer` | hover + selection |
| `ClusterEdgeRenderer` | supergalaxy cluster-cluster |
| `SCCBubbleRenderer` | 사이클 주황 enclosure |
| `StartHereBadgeRenderer` | 번호 뱃지 |
| `PresenceRingRenderer` | AI agent pulsing rings |
| `TraceEdgeRenderer` | runtime trace cyan→magenta gradient |
| `EffectBadgeRenderer` | per-file effect chips |
| `AnomalyBadgesLayer` (DOM) | AI anomaly 경고 |

### 2.4 LOD 시스템 (6-tier hysteresis band)

| Tier | UP | DOWN | Renderer | Edge Layer Policy |
|---|---|---|---|---|
| ground | 0.60 | 0.57 | ground DOM card | 전체 |
| street | 0.25 | 0.22 | street DOM card | 전체 |
| city | 0.13 | 0.10 | InstancedRectMesh | structural only |
| galaxy | 0.10 | 0.07 | InstancedRectMesh | safety high+ / impact |
| supergalaxy | 0.07 | 0.015 | ClusterNode | 없음 (cluster edges만) |
| universe | 0.015 | 0.008 | SuperclusterNode | 없음 |

### 2.5 Feature 목록 (총 30+)

`packages/app-ide/src/features/workspace-canvas/lib/feature-registry.ts`에 선언적 등록:

- **Collab (6)**: presence / cursors / follow / comments / reactions / lock
- **Annotation (7)**: toolbar / pen / text / shape / connector / laser / frame
- **Dev Mode (5)**: inspector / hoverSummary / copyAs / export / measure
- **Review (5)**: voting / poker / timer / retrospective / kanban
- **Navigation (4)**: pages / bookmarks / storyboard / templates
- **AI (4)**: naturalLanguageFilter / clusterStickies / repoTour / anomalyAlerts
- **Power (5)**: commandPalette / lasso / smoothCamera / zoomLens / themeSwitcher
- **Embeds (4)**: imagePaste / tickets / prBadge / slackThread

### 2.6 인터랙션 매트릭스

```
click file                → select
shift+click 2nd file      → shortest path query
cmd+click edge bezier     → Evidence Panel (exact edge)
cmd+click file            → first evidenced edge (fallback)
shift+dblclick empty      → new sticky
dblclick                  → zoom-to-fit (selected or whole)
hover edge (~50ms)        → overlay highlight
hover file (300ms)        → AI hover summary popover
Cmd+K / Ctrl+K            → Command palette
Cmd+Shift+D               → HUD toggle
Cmd+Shift+T               → Theme cycle
Shift+drag empty          → Lasso multi-select
Hold Z + hover            → Zoom lens magnifier
Ctrl+V image              → paste image at cursor
M + click two files       → Measure mode
Ctrl+V on file            → quick vote
@ in comment/sticky       → user mention autocomplete
Esc                       → close panel / sticky deactivate / cancel tool
Cmd+/  in filter input    → DSL ↔ NL mode
```

---

## 3. 아키텍처 핵심 결정

### 3.1 패키지 구조
```
p0-ide-v2/packages/
├── canvas-engine/     # renderer-agnostic logic (graph / layout / analysis / spatial)
├── canvas-pixi/       # Pixi v8 renderers (depends on canvas-engine types only)
├── canvas-worker/     # Web worker for layout + metrics (canvas-engine consumer)
├── app-ide/           # React app shell; workspace-canvas feature lives here
├── shell/             # IDE shell chrome
└── app-demo/          # standalone demo app
```

**불변 의존성 방향**: `app-ide → canvas-pixi → canvas-engine`. `canvas-engine`은 Pixi에 절대 의존 안 함.

### 3.2 Store 아키텍처 (19 slices)

`packages/app-ide/src/features/workspace-canvas/store/`:

```
workspace-canvas-store.ts    # ~50 LOC, batch() microtask coordinator only
viewport-store.ts            # x/y/scale
scene-store.ts               # graph + layout + visibleScene + repoRoot
interaction-store.ts         # lod + viewState + pathQuery + focus + temporal + inspectedEvidence + graphFlash
render-settings-store.ts     # edge/node visual toggles (~22 fields)
ux-settings-store.ts         # stickies/heatmap/grid/hit/autoSync (5 fields)
debug-settings-store.ts      # debugHudOpen/forceLod/freezeScene (3 fields)
feature-flags-store.ts       # per-feature on/off with localStorage + dependency resolution
presence-store.ts            # AI agent presence (3 mock agents)
cursors-store.ts             # real-time cursors (mock driver)
follow-store.ts              # which user the current viewer follows
comments-store.ts            # threaded comments on files/edges
reactions-store.ts           # emoji reactions
stickies-store.ts            # Miro-style sticky notes (5 colors)
annotations-store.ts         # pen/text/shape/connector/frame + activeTool
pages-store.ts               # multi-page canvases
bookmarks-store.ts           # named views with thumbnails
storyboard-store.ts          # playback state
voting-store.ts              # dot voting
estimation-store.ts          # poker planning
timer-store.ts               # session timer (memory only)
retro-store.ts               # retrospective columns
review-state-store.ts        # kanban lanes
ai-alerts-store.ts           # anomaly alerts
images-store.ts              # pasted images (1MB × 5 cap)
ticket-links-store.ts        # file → ticket mapping (Linear/Jira/GitHub)
theme-store.ts               # dark/light/high-contrast
multi-selection-store.ts     # lasso-selected file ids
```

모든 store는 **같은 패턴**: `getState` / `subscribe` / `useXStore(selector)` + typed actions + (대부분) localStorage 영구화. `useSyncExternalStore` 기반.

### 3.3 Feature Flag 시스템 (핵심)

사용자 요구: **"모든 기능 런타임 on/off"**. 구현:

1. **Registry** (`lib/feature-registry.ts`): 선언적 `FEATURE_REGISTRY: FeatureDescriptor[]`
2. **Store** (`store/feature-flags-store.ts`): 
   - `useFeature(id)` 훅 → resolved enabled state (dependency 체인까지 본 후)
   - `featureFlagsStore.setFlag(id, bool)` / `.enableCategory(cat, bool)` / `.resetToDefaults()`
   - localStorage 영구화
3. **HUD** (`components/debug-hud/FeaturesSection.tsx`): features 탭, 카테고리별 그룹, maturity 색점, dep-off 뱃지, presets
4. **사용 패턴**: 모든 신규 컴포넌트는 `if (!useFeature("xxx.yyy")) return null;` 또는 `if (!featureFlagsStore.isEnabled("xxx.yyy")) return;`

**신규 기능 추가 시**:
1. `FEATURE_REGISTRY`에 descriptor 푸시 (id는 kebab-case `category.feature`, 영구 변경 금지)
2. 필요하면 `FeatureCategory` union 확장
3. 컴포넌트/훅에서 `useFeature(id)` gate
4. 의존성 있으면 `dependsOn` 배열

### 3.4 PixiStage 오버레이 레지스트리

`canvas-pixi/src/renderers/overlay-registry.ts` — 8 overlay renderer가 self-register. `RendererStack` 클래스가 균일 `update/clear/destroy` 인터페이스. PixiStage는 thin orchestrator (577 LOC, 이전 820).

### 3.5 MultiFileCanvas 구조

315 LOC, 5 hooks로 분리:
- `use-canvas-interactions` — modifier + click cascade + edge hit test
- `use-edge-focus-logic` — focus/path/violations → edgeFocus
- `use-url-state-sync` — URL apply + debounced sync
- `use-keyboard-shortcuts` — global keybinds
- `use-scene-derivations` — temporal / trace / cross-graph memos

---

## 4. 코드 컨벤션

### 4.1 CLAUDE.md + AGENT.md 규칙
- `CLAUDE.md` → `.ai/AGENT.md`를 binding reference로 선언
- **Naming conventions** (`.ai/AGENT.md`에 문서화됨):
  - `build*` — allocate structured result
  - `compute*` — run graph/numeric algorithm
  - `create*` — factory for stateful objects
  - `resolve*` — pick one value from many
  - `derive*` — pure transform
  - `rank*` — sort + slice top-N
  - `find*` — search/filter
  - `detect*` — boolean-ish finding

### 4.2 하드 규칙
- **TypeScript strict**. `any` 금지. `as unknown as X` 금지.
- **이모지 금지 (코드 파일 내부)**. UI 문자열엔 OK (sticky text, reaction palette).
- **주석 원칙**: WHAT 설명 금지. WHY만, 그것도 subtle할 때만.
- **Comment 언어**: 영어.
- **파일 네이밍**: kebab-case (`use-edge-focus-logic.ts`).

### 4.3 Design tokens + 색 centralize
- `packages/canvas-pixi/src/renderers/shared/colors.ts` — 모든 semantic color (SAFETY_RED / VIOLATION_RED / RISK_HIGH_RED / CYCLE_ORANGE / FLOW_CYAN / NEUTRAL_GREY / etc.)
- `workspace-canvas.css` `:root` — CSS 변수 (`--ws-selection-accent`, `--ws-risk-*`, `--ws-hud-*` etc.)
- 테마 override: `[data-ws-theme="light"]` / `[data-ws-theme="high-contrast"]` scope

### 4.4 유틸
- `canvas-engine/src/util/math.ts` — `clamp` / `lerp` / `mixHex` / `hexToCss` / `cssToHex` (local 중복 금지)
- `app-ide/src/features/workspace-canvas/lib/css-classes.ts` — `WS_CLASSES` const (JSX 클래스 하드코딩 대신 사용)

### 4.5 금지 패턴 (음부터 반복된 지적)
- **카드/행 왼쪽 color stripe 금지** — 아이콘/dot/텍스트 색으로 대체
- `useWorkspaceCanvas` facade 사용 금지 (이미 제거됨, sub-store 직접 구독)
- Settings store 단일 god-store 금지 (3 slice 분리됨)

---

## 5. 빌드 / 테스트 / 검증

```bash
# 모노레포 루트: /Users/songmin/Documents/code-new/quanta-ide
# 작업 디렉토리: /Users/songmin/Documents/code-new/quanta-ide/p0-ide-v2

# 타입체크 (전 패키지)
bun run --cwd p0-ide-v2 typecheck
# = tsc -b

# 테스트 (vitest)
bun run --cwd p0-ide-v2 test
# 또는 특정: test -- canvas / test -- neighborhood

# 개발 서버
bun run --cwd p0-ide-v2 dev
# http://localhost:5173 (Vite default)

# 린트
bun run --cwd p0-ide-v2 lint
```

### 5.1 현재 상태 (2026-04-20 기준)
- **Typecheck**: 깨끗 (사전 `sample-graph.ts` import.meta.glob 4건만 — 무관)
- **Tests**: 441 pass / 5 fail
  - 5 fail 전부 `packages/shell/` (Shell.test.tsx + toast-store) — 사전, canvas 무관
- **Canvas 전용 테스트**: ~162 pass / 0 regression
- **빌드 경고**: 없음

### 5.2 pre-existing 알려진 이슈
- `sample-graph.ts`의 `import.meta.glob` — Vite-specific API, tsc가 몰라서 에러. Vite가 런타임에 해결. 무시해도 됨.
- Shell 테스트 2개 파일 — 이 레포에서 canvas 작업 시작 전부터 실패, 무관.

---

## 6. 주요 파일 맵

### 6.1 Canvas 진입점
```
p0-ide-v2/packages/app-ide/src/features/workspace-canvas/
├── components/
│   ├── MultiFileCanvas.tsx       # 🎯 메인 캔버스 컴포넌트 (315 LOC)
│   ├── DebugHud.tsx              # 8-tab HUD
│   ├── debug-hud/
│   │   ├── FeaturesSection.tsx   # 🎯 features 탭 (feature 토글)
│   │   ├── SceneSection.tsx      # scene 탭 (필터, 토글, sticky 목록)
│   │   ├── GraphSection.tsx      # graph 탭 (centrality, SCC, startHere, hot paths)
│   │   ├── AgentsSection.tsx     # agents 탭
│   │   ├── ReviewSection.tsx     # review 탭
│   │   └── ...                   # fps, lod, perf
│   ├── StreetCard.tsx / GroundCard.tsx
│   ├── Minimap.tsx               # + risk heatmap
│   ├── EvidencePanel.tsx         # cmd+click edge → witness trace
│   ├── InspectorPanel.tsx        # 우측 sidebar (9 섹션)
│   ├── StickiesLayer.tsx / StickyNote.tsx
│   ├── AnnotationsLayer.tsx / AnnotationToolbar.tsx
│   ├── CollabLayer.tsx / CursorsLayer.tsx / CommentPin.tsx / FollowBanner.tsx
│   ├── ReviewLayer.tsx / SessionTimer.tsx / RetroColumns.tsx / KanbanView.tsx
│   ├── DevModeLayer.tsx / HoverSummaryPopover.tsx / ExportButton.tsx / MeasureOverlay.tsx
│   ├── PagesTabBar.tsx / BookmarksDrawer.tsx / StoryboardPlayer.tsx / TemplatesMenu.tsx
│   ├── CommandPalette.tsx / LassoOverlay.tsx / ZoomLens.tsx / ThemeSwitcher.tsx
│   ├── ImagesLayer.tsx / TicketsLayer.tsx / PrBadgesLayer.tsx / SlackEmbed.tsx
│   └── AnomalyBadgesLayer.tsx
├── hooks/
│   ├── use-workspace-canvas.ts   # orchestrator
│   ├── use-canvas-viewport.ts    # pan/zoom
│   ├── use-canvas-interactions.ts # pointer/click cascade
│   ├── use-edge-focus-logic.ts   # focus/path/violations → edgeFocus
│   ├── use-keyboard-shortcuts.ts # global keybinds
│   ├── use-url-state-sync.ts     # URL apply + debounced sync
│   ├── use-scene-derivations.ts  # temporal/trace/crossgraph memos
│   ├── use-smooth-camera.ts      # eased camera
│   ├── use-measure-mode.ts       # M-key 2-file pick
│   ├── use-anomaly-detection.ts  # AI anomaly run
│   ├── use-perf-recorder.ts      # fps drop log to file
│   ├── use-worker-bridge.ts      # worker IPC
│   ├── use-ground-data.ts / use-ground-data-batch.ts
│   └── use-lod-sync.ts
├── store/                        # 19 slices (see §3.2)
├── lib/
│   ├── feature-registry.ts       # 🎯 feature 선언
│   ├── ai-service.ts + mock-ai-service.ts + ai-service-ref.ts
│   ├── templates.ts              # Security/Onboarding/Post-mortem/Architecture
│   ├── command-registry.ts       # Cmd+K 팔레트 backend
│   ├── export-helpers.ts + export-canvas.ts  # Mermaid / DOT / PNG / SVG
│   ├── mock-presence.ts + mock-cursors.ts + mock-tickets.ts + mock-prs.ts + mock-slack.ts
│   ├── heatmap.ts                # 미니맵 히트맵
│   ├── camera-animator.ts        # 이지 보간
│   ├── estimate-memory.ts        # 유니버스 메모리 측정
│   ├── css-classes.ts            # WS_CLASSES 상수
│   └── workspace-url.ts + apply-workspace-url.ts  # URL share
├── data/
│   └── sample-graph.ts           # 🎯 mock 데이터 생성 (40+ 파일 + 50+ edges + proofs + blame + effects + latency + traces + history)
└── workspace-canvas.css          # ~1200 LOC (theme tokens + 모든 컴포넌트 스타일)
```

### 6.2 Engine 진입점
```
p0-ide-v2/packages/canvas-engine/src/
├── index.ts                      # 🎯 12-line barrel (sub-barrel re-exports)
├── graph/
│   ├── index.ts                  # 7 카테고리 divider
│   ├── types.ts                  # FileNode / FileEdge / WorkspaceGraph + glossary
│   ├── evidence.ts / history.ts / blame.ts / elevation.ts / traces.ts
│   ├── effects.ts / latency.ts / multi-graph.ts
│   ├── metrics.ts (Brandes) / scc.ts (Tarjan) / pathfinding.ts (Yen)
│   ├── neighborhood.ts / start-here.ts / arch-violations.ts
│   └── edge-filter-dsl.ts + edge-filter-completions.ts
├── layout/
│   ├── treemap-layout.ts + grid-layout.ts + enrich-layout.ts
│   ├── edge-anchor.ts + orthogonal-routing.ts + edge-bundling.ts
│   ├── cluster-edge-aggregate.ts
│   └── types.ts                  # WorkspaceLayout + FILE_CARD_W/H
├── view/
│   ├── types.ts                  # WorkspaceView / Scene / FileView / glossary
│   └── build-view.ts
├── lod/
│   ├── lod-manager.ts            # hysteresis band 6-tier
│   └── lod-config.ts             # LOD_TIERS + layerPolicy
├── render/edge-geometry-cache.ts
├── spatial/
│   ├── file-index.ts (RBush)
│   ├── edge-filter.ts
│   ├── edge-pick-index.ts        # 16-sample bezier pick
│   └── visible-query.ts
└── util/math.ts                  # clamp / lerp / mixHex
```

### 6.3 Pixi 진입점
```
p0-ide-v2/packages/canvas-pixi/src/
├── index.ts                      # 4 exports only (PixiStage + Props + debug)
├── stage/PixiStage.tsx           # 577 LOC, overlay-registry driven
├── renderers/
│   ├── index.ts                  # side-effect barrel (registry 등록)
│   ├── overlay-registry.ts       # RendererStack + 8 overlay 팩토리
│   ├── shared/
│   │   ├── colors.ts             # 🎯 모든 semantic color + DESIGN_TOKENS
│   │   ├── renderer-registry.ts  # LOD tier renderer registry
│   │   ├── InstancedRectMesh.ts / RectNodeRenderer.ts
│   │   ├── SpatialPickIndex.ts / BitmapFontAtlas.ts
│   │   └── file-card-dims.ts (deleted; canvas-engine owns)
│   ├── [10 renderers — see §2.3]
└── debug/pixi-debug-hook.ts      # 타입 안전 __pixi 접근
```

### 6.4 Worker
```
p0-ide-v2/packages/canvas-worker/src/
├── index.ts                      # worker entry
└── messages.ts                   # IPC types + serialize/deserialize (stale req guard)
```

---

## 7. 커밋 히스토리 (canvas v2→v4)

```
137d450 Batch 7: Power user (palette, lasso, smooth cam, lens, theme)
00d915b Batch 8: Smart embeds (image paste, tickets, PR, slack)
bbf99db Batch 5: Navigation (pages, bookmarks, storyboard, templates)
b386ba0 Batch 4: Review flows (voting, poker, timer, retrospective, kanban)
9ff78da Batch 1: Collab features (cursors, follow, comments, reactions, lock)
55f134d Batch 3: Annotation toolbar (pen, text, shape, connector, laser, frame)
62e16d2 Add feature-flag infrastructure (registry + store + HUD tab)
12fc7b2 Canvas v2: Stage 1-7 features + structural refactor
```

Batch 2 (Dev Mode) + Batch 6 (AI) 파일은 위 커밋에 rolled up됨 (worktree auto-amalgamation).

---

## 8. 남은 로드맵 후보

### Tier A — Real backend (mock → live)
1. **WebSocket presence** — mock cursors/comments → 실 WebSocket (Yjs CRDT 고려)
2. **Real LLM** — `AiService` 인터페이스 이미 있음, `createMockAiService()` → `createAnthropicService()` 스왑
3. **Real git history** — blame / PR / Slack / ticket 모두 mock → live integration
4. **Real span stream** — Honeycomb/OTEL webhook → TraceEdge live update

### Tier B — 미착지 SOTA 패턴
5. **Spatial audio** — Figma Audio 스타일 (WebRTC)
6. **Version history gallery** — URL share → 실 snapshot diff viewer
7. **CRDT sticky + comment 동시 편집** — Yjs/Automerge
8. **3D proper mode** — 현재 CSS shadow → 실 Pixi 3D (또는 Three.js 레이어)
9. **Mobile touch ergonomics** — pinch 이미 있지만 multi-touch gesture 확장

### Tier C — Canvas 확장
10. **Frame-as-module collapse/expand** — 디렉토리 접기
11. **Test ↔ Source instance link** (Figma Component 직역)
12. **Dependency inversion auto-fix 제안** (AI hint)
13. **Coverage heatmap overlay**
14. **CODEOWNERS 기반 ownership grouping**
15. **Diff of diffs** — PR A vs PR B 메타 다이어그램

### Tier D — 외부 통합
16. **Linear/Jira 실 sync** (OAuth + webhook)
17. **PR inline review** — canvas에서 바로 comment → GitHub
18. **Slack bot** — 캔버스 view를 DM 링크로 share

### Tier E — Accessibility/I18n
19. Keyboard-only navigation 확장
20. Screen reader outline
21. Reduced-motion 모드
22. i18n (ko/en/ja)

### Tier F — 미개척
23. **Canvas Storybook 통합** — 스토리북 스토리를 파일 옆에 mount
24. **Live-lint/typecheck overlay** — tsc 에러를 엣지로
25. **Regression impact prediction** — 테스트 실패 시 영향 파일

---

## 9. 새 에이전트에게 주는 프롬프트 (복붙용)

다음 Claude 세션에 이렇게 주면 즉시 작업 가능:

```
이 프로젝트는 Quanta IDE의 Code Universe 캔버스 (p0-ide-v2 모노레포)다.
`/Users/songmin/Documents/code-new/quanta-ide/docs/handoff/canvas-v4-context.md`를 먼저 읽어라.
현재 브랜치 redesign/ide-shell, 테스트 441 pass / 5 fail (5는 사전 shell 실패).

내가 요청할 작업은:
[여기에 구체 요구]

작업 방식:
- TypeScript strict, `any` 금지
- 새 기능은 `feature-registry.ts`에 등록 후 `useFeature(id)` gate
- Store는 기존 19 slice 패턴 따라 `useSyncExternalStore`
- 색은 `colors.ts` DESIGN_TOKENS + CSS `:root` 변수
- 주석 WHAT 금지, WHY만
- 이모지 코드 내 금지 (UI 문자열 OK)
- 작업 후 `bun run --cwd p0-ide-v2 typecheck` + test 확인
- `.ai/AGENT.md` 컨벤션 (build/compute/create/resolve/...)

병렬 작업이 필요하면 worktree isolation (`isolation: "worktree"`)을 써라.
```

---

## 10. 디자인 원칙 요약

1. **모듈성 > 완성도**: 모든 기능 런타임 on/off 가능. "all off" → Stage 0 순수 캔버스.
2. **Registry 패턴 일관**: renderers / overlays / features / commands 전부 선언적 registry.
3. **Mock-first, contract-ready**: AI / presence / tickets / PRs 모두 인터페이스 먼저, 실 백엔드는 drop-in.
4. **Figma/Miro DNA**: UX 패턴은 검증된 도구에서 가져온다 — 사용자가 이미 학습한 제스처.
5. **Hairball 대응**: 엣지 레이어링 (layer × severity × LOD 게이팅) + focus + cluster 집계 + query 기반 하이라이트.
6. **Performance first**: Float32Array ring buffer (HUD), InstancedRectMesh (Pixi), StrictMode-safe cache, stale request guard (worker IPC).
7. **단일 source of truth**: 색은 `colors.ts`, LOD는 `lod-config.ts`, features는 `feature-registry.ts` — duplicate 금지.

---

## 11. 자주 쓰는 명령어

```bash
# 현재 상태 빠른 확인
cd /Users/songmin/Documents/code-new/quanta-ide
git status --short
git log --oneline -8

# 테스트 실행
bun run --cwd p0-ide-v2 typecheck
bun run --cwd p0-ide-v2 test
bun run --cwd p0-ide-v2 test -- <pattern>

# 새 feature 추가 워크플로
# 1. feature-registry.ts에 descriptor 추가
# 2. 해당 store 생성 (useSyncExternalStore 패턴)
# 3. 해당 컴포넌트 생성, 맨 위에서 useFeature(id) gate
# 4. MultiFileCanvas.tsx (또는 적절한 layer aggregator)에서 mount
# 5. HUD에 토글 행 추가 (자동으로 features 탭에도 나타남)
# 6. typecheck + test
# 7. commit
```

---

**끝.** 이 문서만 있으면 다른 Claude가 바로 이어받아 작업 가능.
