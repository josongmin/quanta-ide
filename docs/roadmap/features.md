기능 현황 (Stage 0 → Stage 7 누적)
데이터 모델 & 분석 엔진
기능	모듈	상태
EdgeKind 19종 × EdgeLayer 4계층 × EdgeSeverity 4단계	graph/types.ts + deriveEdgeLayer	✅
라인 앵커 (fromLine/toLine/fromSymbol/toSymbol)	layout/edge-anchor.ts	✅
k-hop 이웃 탐색 (Focus mode)	graph/neighborhood.ts	✅
Centrality 메트릭 (degree + Brandes betweenness sampled)	graph/metrics.ts	✅
Tarjan SCC (iterative, import/call 사이클)	graph/scc.ts	✅
Yen's k-shortest path	graph/pathfinding.ts	✅
Start-here 랭킹 (centrality + entry + risk)	graph/start-here.ts	✅
Arch violation (Clean/Hexagonal)	graph/arch-violations.ts	✅
Cluster edge aggregation (log(count) + halo)	layout/cluster-edge-aggregate.ts	✅
Evidence (ProofBundle + WitnessStep)	graph/evidence.ts	✅
Graph history (snapshots + diff)	graph/history.ts	✅
Edge pick index (16-sample bezier)	spatial/edge-pick-index.ts	✅
Filter DSL (compile + autocomplete)	graph/edge-filter-dsl.ts + completions.ts	✅
Git blame (age ramp + stripes)	graph/blame.ts	✅
Elevation (risk → sqrt easing height)	graph/elevation.ts	✅
Multi-graph join (NamedGraph + crossGraph flag)	graph/multi-graph.ts	✅
Effect annotations (9 kinds)	graph/effects.ts	✅
Latency heatmap (5-band ramp)	graph/latency.ts	✅
Runtime traces (TraceSpan + TraceEdge)	graph/traces.ts	✅
공간 색인 (RBush FileIndex + EdgeFilter)	spatial/*	✅
렌더러 (canvas-pixi, 10개 direct-mount)
렌더러	역할	티어
InstancedRectMesh × 4	Galaxy/City/Street/Ground rect instancing	각 tier
EdgeStaticRenderer	라인-앵커 glow + dashed bezier arc sampling + animated Ticker + arrow + X-cap + 이전 모든 모드 통합	전 tier
EdgeOverlayRenderer	hover + selected (hover edge 2× 굵기 indigo)	전 tier
ClusterEdgeRenderer	슈퍼갤럭시 cluster-cluster super-edges	supergalaxy
SCCBubbleRenderer	사이클 감싸는 주황 enclosure + "cycle·N" 라벨	galaxy+
StartHereBadgeRenderer	번호 뱃지 (galaxy 14px → ground 22px)	galaxy/city/street/ground
PresenceRingRenderer	AI 에이전트 링 (1Hz pulse + staleness fade)	전 tier
TraceEdgeRenderer	런타임 trace cyan→magenta gradient + ×N 뱃지	전 tier
UI / UX Surface
컴포넌트	용도
6-tab HUD (fps/lod/scene/perf/graph/agents)	디버그 + 제어 전체
EvidencePanel	cmd+click edge → witness trace step-by-step
Minimap + risk heatmap canvas overlay	글로벌 뷰 + 핫스팟
FilterDslInput	autocomplete dropdown (arrow/Tab/Enter/Esc)
Temporal slider	live scrub + diff A/B 비교 + play/pause 1200ms
StickiesLayer + StickyNote	Miro 스타일 5색 포스트잇
BlameGutter (Ground SVG)	라인 age 그라데이션 + 호버 툴팁
GroundCard / StreetCard	code + effect chips + latency p95 + elevation shadow
ShareSection	copy/import/reset URL + autoSync
인터랙션 / 설정
입력	결과
click file	select
shift+click	path query (shortest)
cmd+click edge bezier	Evidence Panel 정확 오픈
hover edge	overlay 하이라이트
shift+dblclick empty	새 sticky
dblclick	zoom-to-fit
Cmd+Shift+D	HUD toggle
Esc	panel/sticky close
pinch/wheel	zoom (감도 조정됨)
스토어 필드 ~30+	edgeKinds/edgeLayers/edgeMinSeverity/edgeWidthMul/edgeFilterQuery + focus/elevation/blame/stickies/presence/latency/trace/URL autoSync 등
성능 기반
항목	상세
LOD 6단계 (hysteresis band, 사용자 피드백 반영 tuning)	universe 0.015 / supergalaxy 0.07 / galaxy 0.10 / city 0.13 / street 0.25 / ground 0.60
Layer policy per tier	galaxy 이하는 safety/impact만 (hairball 95% 감소)
Frame-hot 경로 zero-alloc	HUD ring buffer Float32Array, sub-store 직접 subscribe
Worker IPC stale-request guard	LAYOUT/AGGREGATES/GEOMETRY 모두
StrictMode-safe Pixi 컨텍스트 캐시	canvas-keyed WeakMap
테스트	146/146 ✓ (18 테스트 파일)
Roadmap TODO (미래)
Tier 1 — Collab / Social (Miro 확장)
기능	스케치
Realtime multi-user cursors	presence-store를 WebSocket/BroadcastChannel에 bind, 다른 유저 커서 월드 좌표 + 이름 뱃지
Collaborative sticky editing	sticky CRDT (Yjs 또는 Automerge), 동시 편집 + 충돌 해결
Canvas comments threads	sticky에 reply 체인, @mention, resolve/reopen
Frame / group annotation	여러 파일을 묶어 "Feature: X" 프레임으로 표시 (Miro Frame)
Voice/draw annotations	pressure-sensitive pen stroke 오버레이 (freehand)
Tier 2 — AI / Intelligence
기능	스케치
Hover file → AI summary popover	파일 hover 300ms 유지 시 LLM 기반 1-line 요약 ("이 파일은 세션 관리 담당")
AI-generated tour	"이 repo 처음 본다면 여기부터" 순서 제안 + 자동 camera 이동 (Storyboard playback과 연계)
Natural language filter	DSL 대신 "show me taint flows that touch auth" → DSL 변환
Anomaly detection overlay	갑자기 늘어난 coupling, 비정상 betweenness 스파이크 하이라이트
Recommend fix edges	impact 엣지 위에 "이 변경 이전에 저 파일도 검토" 제안 뱃지
Tier 3 — Runtime / Observability 심화
기능	스케치
Live span streaming	현재 실행 중인 trace를 실시간 애니메이션으로 표시
Flame graph per file	파일 클릭 → 하단 패널에 해당 파일의 flamegraph
Error rate overlay	파일별 exception rate를 latency와 별도 layer로
Feature flag exposure map	어떤 코드가 어떤 feature flag 뒤에 숨어 있는지
Tier 4 — Workspace / Persistence
기능	스케치
Storyboard playback	키프레임 시퀀스 저장 → 자동 재생 (demo/onboarding), 단계별 label + 내레이션
Workspace snapshots gallery	저장된 URL state 썸네일 그리드, 태그 + 설명
Export as PNG/SVG/PDF	현재 뷰 이미지 추출 (PR 첨부용)
Diff of diffs	PR A ↔ PR B 메타-diff 오버레이
Custom workspace color theme	다크/하이콘트라스트/색약 변형
Tier 5 — 분석 정확도 / 범위
기능	스케치
Effect inference from AST	현재 path-heuristic 대신 실제 AST 분석
Dependency inversion auto-fix	arch violation 발견 시 dependency-inject refactor 제안
Test coverage heatmap	파일별 coverage%를 blame과 합성한 overlay
Git branch compare	두 브랜치 간 엣지/파일 추가/제거 그래프
Regression impact prediction	테스트 실패 시 영향받을 파일 predict
Graph patch format	로컬 수정사항 (저장 안 한 것) 오버레이
Tier 6 — Rendering / Performance
기능	스케치
Instanced edge mesh (bezier SDF)	현재 Graphics clear+replay → GPU 단일 draw call, 10k+ 엣지 목표
Virtual-list Ground code rendering	큰 파일의 코드 가상 스크롤
Proper 3D mode (Pixi layers + perspective)	CodeCity 정식 3D (현재는 shadow 흉내)
WebGPU fallback/pathway	Pixi WebGPU renderer 전환 검토
Tier 7 — 외부 통합
기능	스케치
Linear / Jira ticket 뱃지	파일에 연결된 티켓 수 표시 + 클릭 시 deep-link
Slack discussion thread	파일에서 언급된 슬랙 쓰레드 링크
Live-lint / typecheck overlay	tsc 에러를 엣지/뱃지로
Git blame click → GitHub PR	blame 호버에서 PR deep-link
CLI export	헤드리스 렌더로 터미널/CI에서 스크린샷
Tier 8 — Accessibility / Polish
기능	스케치
Keyboard-only navigation	Tab으로 파일 선택, arrow로 이동, ?로 help
Screen-reader outline	현재 뷰를 "layer X에 N 파일" 오디오로
Color-blind palette variants	deuteranopia/protanopia 안전 색
Reduced-motion mode	애니메이션 비활성 (taint flow 정적)
i18n	영어/한국어 외 언어
우선순위 추천 (사용자 가치 × 구현 난이도):

⭐ Hover AI summary (Tier 2) — 적은 비용, 엄청난 UX 승부수
⭐ Realtime cursors + collab sticky (Tier 1) — 팀 사용 시 바이럴 요소
⭐ Storyboard playback (Tier 4) — 데모/온보딩 lever
Export PNG/SVG (Tier 4) — PR 문화 연결
Live typecheck overlay (Tier 7) — IDE 통합 핵심