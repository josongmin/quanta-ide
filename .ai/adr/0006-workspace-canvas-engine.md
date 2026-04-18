# RFC-0006: Workspace Canvas Engine

**Status:** Proposed  
**Date:** 2026-04-18  
**Author:** Song Min  
**Reviewers:** TBD

---

## Summary

코드베이스 전체를 2D 캔버스에 펼쳐 Figma처럼 탐색할 수 있는 **Workspace Canvas** 시스템을 도입한다.

파일, 함수/클래스 구조, 심볼 인사이트(taint, blast, dead), 파일 간 dependency 엣지, 인라인 댓글을 줌 레벨에 따라 적절한 추상화로 보여준다.

200만 줄 이상 레포를 전제로 설계한다.

---

## Motivation

### 현재 한계

현재 `app-ide`의 `editor-canvas`는 **단일 파일**을 캔버스에 표시한다.

```
FileFacts → CanvasGraph → CanvasView (단일 파일)
```

- 파일 하나만 볼 수 있음
- 파일 간 관계 (import, taint propagation, blast radius)가 단절됨
- 10,000개 파일 규모 레포에서 전체 구조 파악 불가

### 목표

```
WorkspaceFacts → WorkspaceGraph → WorkspaceLayout → MultiFileCanvas (파일 N개)
```

```
zoom 5%   Galaxy  파일 = 위험도 색상 사각형 + 숫자 배지
zoom 25%  City    파일 내부 구조 (함수/클래스) + 리스크 탐색 — 주 탐색 레벨
zoom 55%  Street  코드 라인 + 심볼 마커 도트
zoom 80%+ Ground  풀 코드 + ExtNode + EdgeLayer + 댓글
```

**City가 핵심 탐색 레벨이다.** 대부분의 리스크/구조 의사결정이 여기서 일어난다.

---

## 규모 전제 (설계 기준)

```
대상: 200만 줄, 약 10,000개 파일 레포

Galaxy 레벨에서 동시 렌더:
  파일 카드    최대 1,000개 (viewport culling 후)
  파일 간 엣지 최대 10,000개 (파일당 평균 import 10개)

Ground 레벨에서 동시 렌더:
  파일 2-5개
  파일당 코드 라인 ~200개 (virtual rendering)
  ExtNode ~15개, 댓글 ~10개, 엣지 ~30개
```

DOM + SVG는 Galaxy 레벨 엣지 10,000개에서 즉사한다.  
**Galaxy/City 레벨은 WebGL, Street/Ground는 DOM** — 이것이 이 RFC의 핵심 판단이다.

---

## 결정: 하이브리드 렌더링 + 도메인 격리

### 렌더링 레이어 분리

| LOD | Scale 범위 | 렌더러 | 이유 |
|---|---|---|---|
| Galaxy | < 0.15 | PixiJS (WebGL) | 파일 1000개 + 엣지 10000개 |
| City | 0.15 – 0.35 | PixiJS (WebGL) | 파일 내부 구조 + 번들 엣지, **주 탐색 레벨** |
| Street | 0.35 – 0.75 | DOM | 코드 라인 시작, 텍스트 중요 |
| Ground | ≥ 0.75 | DOM | 풀 코드, 인터랙션, 현재 시스템 |

Scale 0.35를 경계로 PixiJS ↔ DOM이 스왑된다.  
텍스트/인터랙션은 DOM, 선/도형 수만 개는 WebGL — 각자 잘하는 것을 한다.

### City LOD: 주 탐색 레벨

City는 단순한 중간 단계가 아니다. 파일 내부 구조(함수/클래스 블록)와 리스크 신호(taint count, blast radius, dead code)를 동시에 보여주는 **의사결정 레벨**이다.

- 함수 블록: 이름 + 줄 범위 + 시그널 카운트
- 파일 간 엣지: taint-propagation 강조, import 번들
- 댓글: 함수 블록당 숫자 배지
- 리스크: 함수별 complexity + taint 색상 히트맵

### 도메인 격리: 별도 패키지

`canvas-engine`을 React, PixiJS와 완전히 독립된 순수 TypeScript 패키지로 격리한다.  
**UI framework 의존성 0** — 렌더링 기술이 바뀌어도 도메인 로직은 변경되지 않는다.

---

## 핵심 아키텍처: 3-Layer 모델

렌더링 전에 데이터를 세 단계로 분리한다:

```
WorkspaceGraph      그래프 토폴로지 (불변, 위치 없음)
     ↓ Layout Engine
WorkspaceLayout     좌표/크기/엣지 경로 (ElkLayout 결과)
     ↓ Viewport Projection
WorkspaceView       현재 viewport에 보이는 요소들 (SpatialIndex 쿼리 결과)
```

**이유:** 위치(position)를 그래프 노드 자체에 두면 레이아웃이 바뀔 때마다 그래프 전체를 복사해야 한다. 위치는 레이아웃 레이어가 독점 소유한다.

---

## 패키지 구조

```
packages/
│
├── canvas-engine/                  ← 신규 (UI framework 의존성 0)
│   ├── src/
│   │   ├── scene/
│   │   │   ├── types.ts            WorkspaceGraph, FileNode, FileEdge, Comment
│   │   │   └── WorkspaceGraph.ts   그래프 생성/변경 불변 API
│   │   │
│   │   ├── layout/
│   │   │   ├── types.ts            WorkspaceLayout, WorkspaceView, ViewState
│   │   │   ├── ElkLayout.ts        ELK.js 씨앗 배치 (Worker)
│   │   │   ├── GridLayout.ts       단순 그리드 (즉각 초기 배치)
│   │   │   └── SpatialIndex.ts     rbush R-tree, 파일 + 엣지 쿼리
│   │   │
│   │   ├── render/
│   │   │   └── EdgeGeometryCache.ts 엣지 베지어 지오메트리 캐시
│   │   │
│   │   ├── lod/
│   │   │   └── LodManager.ts       scale → LodLevel, 히스테리시스
│   │   │
│   │   └── index.ts                public API
│   │
│   └── package.json                deps: rbush, elkjs only
│
├── canvas-pixi/                    ← 신규 (WebGL 렌더러)
│   ├── src/
│   │   ├── GalaxyRenderer.ts       파일 카드 스프라이트
│   │   ├── CityRenderer.ts         함수 블록 + 리스크 히트맵
│   │   ├── EdgeRenderer.ts         Static + Overlay 2층 엣지
│   │   └── PixiStage.tsx           React → PixiJS 브릿지
│   │
│   └── package.json                deps: pixi.js
│
└── app-ide/                        ← 기존 패키지 (확장)
    └── src/
        └── features/
            └── workspace-canvas/
                ├── MultiFileCanvas.tsx     전체 조립
                ├── FileCard.tsx            LOD 스위치
                ├── GroundCard.tsx          ← 현재 CanvasView 내용 이식
                ├── StreetCard.tsx          코드 라인 (no syntax highlight)
                ├── GlobalEdgeLayer.tsx     파일 간 엣지 (DOM, Ground)
                └── Minimap.tsx             전체 레이아웃 오버뷰
```

### 의존성 방향

```
canvas-engine   ← 순수 TS, UI framework 의존성 0
canvas-pixi     ← canvas-engine + pixi.js
app-ide         ← canvas-engine + canvas-pixi + shell-contract
```

---

## 도메인 타입

### WorkspaceGraph (`scene/types.ts`)

```typescript
// 전체 워크스페이스 그래프 (불변, 위치 정보 없음)
interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];
  comments: WorkspaceComment[];
}

// 그래프 노드 — 위치(position)는 WorkspaceLayout이 소유
interface FileNode {
  id: string;                  // 파일 경로
  name: string;
  layer: ArchLayer;            // "domain" | "adapter" | "infra" | ...
  riskScore: number;
  signals: SignalSummary;      // { taintCount, blastCritical, deadCount }
  functions: FunctionBlock[];  // City LOD용
  // Ground LOD 데이터는 DataTier 2-4로 lazy load
}

interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  signalCount: number;
  complexity: number;          // City 리스크 히트맵용
}

// 파일 간 엣지 (위치 없음 — 경로는 WorkspaceLayout.edgeRoutes가 결정)
interface FileEdge {
  id: string;
  from: string;                // FileNode.id
  to: string;
  kind: "import" | "taint-propagation" | "blast";
  weight: number;
}

// 댓글 (파일:줄 앵커)
interface WorkspaceComment {
  id: string;
  fileId: string;
  line: number;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: number;
}
```

### WorkspaceLayout (`layout/types.ts`)

```typescript
// 레이아웃 결과: 파일 위치 + 엣지 경로 (WorkspaceGraph와 분리)
interface WorkspaceLayout {
  fileRects:   Map<string, Rect>;          // fileId → { x, y, w, h }
  edgeRoutes:  Map<string, BezierRoute>;   // edgeId → 제어점
  aggregates:  LodAggregateCache;          // LOD별 사전 계산 데이터
  totalBounds: Rect;                       // 전체 캔버스 경계
}

interface BezierRoute {
  x1: number; y1: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  x2: number; y2: number;
}

// LOD별 집계 캐시 — 레이아웃 시 사전 계산, 렌더 시 재계산 없음
interface LodAggregateCache {
  // City: 함수 블록당 댓글 수
  commentsByFunction: Map<string, number>;   // `${fileId}:${funcName}` → count
  // Galaxy: 파일당 댓글 총수
  commentsByFile: Map<string, number>;
  // Street: 줄 번호 → 댓글 존재 여부
  commentedLines: Map<string, Set<number>>; // fileId → Set<lineNumber>
}
```

### WorkspaceView + ViewState (`layout/types.ts`)

```typescript
// Viewport projection 결과 — SpatialIndex 쿼리 출력
interface WorkspaceView {
  files:    FileNode[];
  edges:    FileEdge[];
  comments: WorkspaceComment[];
}

// 렌더러 독립적 전역 상태 SSOT
// PixiJS 렌더러와 DOM 렌더러가 모두 이 객체를 읽는다
interface ViewState {
  viewport:       Viewport;           // { x, y, scale }
  lod:            LodLevel;           // "galaxy" | "city" | "street" | "ground"
  selectedFileId: string | null;
  hoveredFileId:  string | null;
  selectedEdgeId: string | null;
  focusedNodeId:  string | null;      // Ground LOD 내 ExtNode
}
```

---

## Spatial Index (`SpatialIndex.ts`)

파일(Rect) + 엣지(bounding box)를 모두 커버한다. 전체 순회 없이 항상 O(log n) 쿼리.

```typescript
import RBush from 'rbush';

class SpatialIndex {
  private fileBush = new RBush<FileBBoxItem>();
  private edgeBush = new RBush<EdgeBBoxItem>();

  loadFiles(layout: WorkspaceLayout): void {
    const items: FileBBoxItem[] = [];
    for (const [id, rect] of layout.fileRects) {
      items.push({
        minX: rect.x, minY: rect.y,
        maxX: rect.x + rect.w, maxY: rect.y + rect.h,
        fileId: id,
      });
    }
    this.fileBush.load(items);
  }

  loadEdges(edges: FileEdge[], layout: WorkspaceLayout): void {
    const items: EdgeBBoxItem[] = [];
    for (const edge of edges) {
      const r = layout.edgeRoutes.get(edge.id);
      if (!r) continue;
      // 제어점 포함 bounding box
      const xs = [r.x1, r.cx1, r.cx2, r.x2];
      const ys = [r.y1, r.cy1, r.cy2, r.y2];
      items.push({
        minX: Math.min(...xs), minY: Math.min(...ys),
        maxX: Math.max(...xs), maxY: Math.max(...ys),
        edgeId: edge.id,
      });
    }
    this.edgeBush.load(items);
  }

  queryFiles(viewport: Rect): string[] {
    return this.fileBush.search(toRBush(viewport)).map(i => i.fileId);
  }

  // 엣지 coarse filtering: bounding box가 viewport와 겹치는 엣지만 반환
  queryEdges(viewport: Rect): string[] {
    return this.edgeBush.search(toRBush(viewport)).map(i => i.edgeId);
  }
}
// 파일 10,000개, 엣지 50,000개 → O(log n) 쿼리
```

---

## EdgeGeometryCache + 렌더링 레이어 구조

엣지 지오메트리는 레이아웃 시 한 번 계산하고 이후 절대 재계산하지 않는다.  
**hover/select는 Static 레이어 위에 Overlay를 덧씌우는 방식** — 전체 redraw 금지.

```typescript
interface BezierGeometry {
  x1: number; y1: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  x2: number; y2: number;
  bbox: Rect;   // 선택 감지용 근사 경계 (사전 계산)
}

class EdgeGeometryCache {
  private cache = new Map<string, BezierGeometry>();

  build(edges: FileEdge[], layout: WorkspaceLayout): void {
    this.cache.clear();
    for (const edge of edges) {
      const route = layout.edgeRoutes.get(edge.id);
      if (!route) continue;
      this.cache.set(edge.id, { ...route, bbox: computeBBox(route) });
    }
  }

  get(edgeId: string): BezierGeometry | undefined {
    return this.cache.get(edgeId);
  }
}
```

### PixiJS EdgeRenderer: 3-레이어 구조

```
Static layer   모든 엣지 지오메트리 (레이아웃 시 한 번, 이후 불변)
Overlay layer  선택/hover 엣지 하이라이트 (ViewState 변경 시만 갱신)
DOM layer      엣지 라벨, 클릭 핫스팟 (Street/Ground)
```

```typescript
class EdgeRenderer {
  private staticGfx  = new PIXI.Graphics();  // 전체 엣지 (불변)
  private overlayGfx = new PIXI.Graphics();  // 활성 엣지 (갱신 가능)

  // 레이아웃 변경 시 한 번만 호출
  buildStatic(edges: FileEdge[], cache: EdgeGeometryCache): void {
    this.staticGfx.clear();
    for (const edge of edges) {
      const geo = cache.get(edge.id);
      if (!geo) continue;
      drawBezier(this.staticGfx, geo, baseStyle(edge));
    }
  }

  // ViewState.selectedEdgeId / hoveredEdgeId 변경 시만 호출
  // 전체 redraw 절대 금지
  updateOverlay(viewState: ViewState, cache: EdgeGeometryCache): void {
    this.overlayGfx.clear();
    const ids = [viewState.selectedEdgeId, viewState.hoveredEdgeId]
      .filter(Boolean) as string[];
    for (const id of ids) {
      const geo = cache.get(id);
      if (!geo) continue;
      drawBezier(this.overlayGfx, geo, highlightStyle());
    }
  }
}
```

---

## LOD Manager

```typescript
type LodLevel = "galaxy" | "city" | "street" | "ground";

// 히스테리시스: 경계에서 깜빡임 방지
const THRESHOLDS = {
  galaxy_to_city:   { up: 0.15, down: 0.12 },
  city_to_street:   { up: 0.35, down: 0.32 },
  street_to_ground: { up: 0.75, down: 0.72 },
} as const;

class LodManager {
  private current: LodLevel = "galaxy";

  update(scale: number): LodLevel {
    // 현재 레벨에서 임계값 체크 (히스테리시스 적용)
    // ...
    return this.current;
  }
}
```

LOD 전환은 **ViewState.lod**를 갱신한다. PixiJS 렌더러와 DOM 렌더러 모두 ViewState를 구독하므로 동기화가 자동이다.

---

## Layout: ElkLayout (씨앗 배치)

ELK.js는 **초기 씨앗 배치**를 담당한다. 사용자가 파일 카드를 드래그하면 해당 노드만 pinned 처리하고 partial relayout을 트리거한다.

```typescript
interface LayoutOptions {
  pinnedNodes?: Map<string, Rect>;  // 사용자가 고정한 노드
}

async function elkLayout(
  graph: WorkspaceGraph,
  options: LayoutOptions = {},
): Promise<WorkspaceLayout> {
  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "200",
      "elk.spacing.nodeNode": "60",
    },
    children: graph.files.map(f => ({
      id: f.id,
      width: FILE_CARD_W,
      height: FILE_CARD_H,
      // pinned 노드는 좌표 고정
      ...(options.pinnedNodes?.has(f.id) && {
        x: options.pinnedNodes.get(f.id)!.x,
        y: options.pinnedNodes.get(f.id)!.y,
        layoutOptions: { "elk.fixed": "true" },
      }),
    })),
    edges: graph.fileEdges.map(e => ({
      id: e.id, sources: [e.from], targets: [e.to],
    })),
  };

  const result = await elk.layout(elkGraph);  // Worker에서 실행
  return buildLayout(result, graph);
}
```

**ELK 한계 및 대응:**

| 문제 | 대응 |
|---|---|
| 10,000개 파일 → 수초 소요 | GridLayout 선배치 → ELK 결과로 부드럽게 교체 |
| 레이아웃이 마음에 안 들 수 있음 | 사용자 드래그 → pinned 처리 → partial relayout |
| ELK 결과 품질 불안정 | layer 그룹별 분리 배치 + manual override 항시 허용 |

초기 배치는 **GridLayout** (즉각), 백그라운드 **ElkLayout** 완료 후 부드럽게 교체.

---

## Ground LOD: 데이터 레이어 로딩

Ground LOD는 파일 전체 데이터가 필요하다. 2-5개 파일을 한꺼번에 완전히 로드하면 메인 스레드가 블로킹된다. **데이터를 5개 Tier로 분할**하여 점진적으로 로드한다.

| Tier | 데이터 | 크기 | 로드 시점 |
|---|---|---|---|
| 0 | 파일 메타 (이름, LOC, riskScore, signals) | ~1KB | WorkspaceGraph에 포함, 항시 존재 |
| 1 | 함수/클래스 목록 + 줄 범위 + complexity | ~10KB | City LOD 진입 시 |
| 2 | 코드 라인 (텍스트만) | ~100KB | Street LOD 진입 시 |
| 3 | 토큰 파싱 결과 (syntax highlight) | ~200KB | Ground LOD 진입 시 |
| 4 | ExtNode + 엣지 + 댓글 전체 | ~50KB | Ground LOD 안정 후 500ms 지연 |

```typescript
interface DataTierLoader {
  load(fileId: string, tier: 0 | 1 | 2 | 3 | 4): AbortablePromise<TierData>;
  prefetch(fileIds: string[], tier: number): void;
  evict(fileId: string, tierAndAbove: number): void;
}

// LOD 전환 시 트리거
function onLodChange(newLod: LodLevel, visibleFileIds: string[]): void {
  const tierMap: Record<LodLevel, number> = {
    galaxy: 0, city: 1, street: 2, ground: 3,
  };
  const targetTier = tierMap[newLod];

  for (const fileId of visibleFileIds) {
    loader.load(fileId, targetTier as any);
  }

  // 인접 파일 prefetch (사용자가 곧 이동할 가능성)
  const adjacentIds = getAdjacentFileIds(visibleFileIds, layout);
  loader.prefetch(adjacentIds, targetTier);
}

// 뷰포트 밖으로 나간 파일 메모리 해제 (Tier 2 이상만)
function onFilesHidden(hiddenFileIds: string[]): void {
  for (const fileId of hiddenFileIds) {
    loader.evict(fileId, 2);   // Tier 0, 1은 유지 (가볍고 재사용)
  }
}
```

**취소 정책:** LOD가 빠르게 바뀔 때 (빠른 zoom out) 이전 Tier 로드를 즉시 cancel한다. AbortController로 fetch 취소, Worker 메시지 drop.

---

## React 조립 (`MultiFileCanvas.tsx`)

```tsx
export function MultiFileCanvas({ workspace }: { workspace: WorkspaceFacts }) {
  const graph     = useWorkspaceGraph(workspace);
  const layout    = useWorkspaceLayout(graph);          // ElkLayout (Worker)
  const viewState = useViewState(graph, layout);         // ViewState SSOT
  const visible   = useSpatialQuery(graph, layout, viewState.viewport);

  return (
    <div className="workspace-canvas" ref={containerRef}>

      {/* Galaxy / City: PixiJS */}
      {(viewState.lod === "galaxy" || viewState.lod === "city") && (
        <PixiStage
          viewState={viewState}
          visible={visible}
          layout={layout}
          edgeCache={edgeCache}
        />
      )}

      {/* Street / Ground: DOM */}
      {(viewState.lod === "street" || viewState.lod === "ground") && (
        <div style={{ transform: toTransform(viewState.viewport), transformOrigin: "0 0" }}>
          {visible.files.map(f => (
            <FileCard
              key={f.id}
              file={f}
              lod={viewState.lod}
              rect={layout.fileRects.get(f.id)!}
              comments={visible.comments.filter(c => c.fileId === f.id)}
              viewState={viewState}
            />
          ))}
        </div>
      )}

      <Minimap graph={graph} layout={layout} viewState={viewState} />
      <CanvasControls ... />
    </div>
  );
}
```

---

## FileCard LOD 분기

```tsx
export function FileCard({ file, lod, rect, comments, viewState }) {
  const style = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };

  if (lod === "street") {
    return (
      <div className="file-card" style={style}>
        <FileCardHeader file={file} />
        <StreetCard file={file} />
      </div>
    );
  }

  // ground
  return (
    <div className="file-card" style={style}>
      <FileCardHeader file={file} />
      <GroundCard file={file} comments={comments} viewState={viewState} />
    </div>
  );
}
```

`GroundCard`는 현재 `CanvasView` 내용을 그대로 이식한다. 기존 코드 재사용.

---

## 댓글 시스템

```
Ground LOD:  코드 라인 옆 말풍선 (줄 앵커)
Street LOD:  줄 번호 옆 인디케이터 도트
City LOD:    함수 블록당 숫자 배지 (LodAggregateCache.commentsByFunction)
Galaxy LOD:  파일 카드 우상단 숫자 (LodAggregateCache.commentsByFile)
```

LOD 전환 시 댓글 집계 재계산 없음 — `WorkspaceLayout.aggregates`에 사전 계산.

---

## 인터랙션 모델

```
노드 클릭       파일 열기 → Ground LOD로 zoom
엣지 클릭       taint path 하이라이트 (양 파일에 걸쳐)
파일 더블클릭   에디터 탭에서 열기
댓글 클릭       말풍선 expand / resolve
⌘+휠           zoom
Space+drag      pan
⌘+K             파일 검색 → 해당 파일로 focus
⌘+Shift+F       전체 taint path 오버레이
```

---

## 성능 규칙 (불변)

이하 규칙은 구현 단계에서 예외 없이 적용된다.

1. **hover/select는 Overlay layer만 갱신** — Static 전체 redraw 금지
2. **pan/zoom 중 React re-render 없음** — transform은 CSS만 (setState 없음)
3. **엣지 지오메트리는 레이아웃 시 한 번** — viewport 변경 시 재계산 금지
4. **SpatialIndex 없이 전체 파일/엣지 순회 금지** — 항상 O(log n) 쿼리 경유
5. **Ground Tier 4는 500ms 지연 로드** — 진입 직후 코드 라인 먼저, 댓글/엣지 후순위
6. **LOD 전환 시 이전 fetch 즉시 cancel** — 좀비 요청으로 메인 스레드 오염 방지

---

## 구현 단계

### Phase 1 — canvas-engine 패키지 (2주)

- `WorkspaceGraph`, `WorkspaceLayout`, `WorkspaceView`, `ViewState` 타입 정의
- `SpatialIndex` (rbush — 파일 + 엣지)
- `GridLayout` (즉시 배치), `EdgeGeometryCache`
- `LodManager` (히스테리시스 포함)
- 단위 테스트 100%

### Phase 2 — PixiJS Galaxy (2주)

- `PixiStage` React 브릿지
- `GalaxyRenderer` (파일 카드 컬러 블록)
- `EdgeRenderer` (Static + Overlay 2층 구조)
- mock 데이터로 1,000개 파일 + 10,000개 엣지 60fps 검증

### Phase 3 — City LOD (2주)

- `CityRenderer` (함수 블록 + 복잡도 히트맵 + 시그널 배지)
- DataTier 1 로딩 + `LodAggregateCache` 댓글 집계
- 파일 간 엣지 taint-propagation Overlay 강조

### Phase 4 — LOD 전환 + Street (2주)

- `FileCard` LOD 스위치
- `StreetCard` (코드 라인, syntax highlight 없음, 마커 도트)
- scale 0.35 경계 PixiJS ↔ DOM 스왑
- 전환 시 깜빡임 없는지 검증

### Phase 5 — GroundCard 편입 (1주)

- 현재 `CanvasView` → `GroundCard`로 이식
- DataTier 2-4 점진 로딩 + AbortController 취소 정책
- 기존 virtual line rendering, memo, EdgeLayer 재사용

### Phase 6 — ELK 레이아웃 + Minimap (2주)

- `ElkLayout` Worker (GridLayout 씨앗 → ELK 결과 교체 애니메이션)
- pinned 노드 + partial relayout
- `Minimap` 컴포넌트
- taint propagation 파일 간 하이라이트

---

## 레포 연결 지점

새 패키지를 만들기 전에 기존 코드에서 재사용·참조할 것들.

### 패키지 등록

신규 패키지 3개는 `p0-ide-v2/packages/` 아래 생성하고, `tsconfig.app.json`의 `paths`에 alias 추가 필요:

```json
// tsconfig.app.json > compilerOptions > paths 에 추가
"@quanta/canvas-engine":   ["packages/canvas-engine/src"],
"@quanta/canvas-engine/*": ["packages/canvas-engine/src/*"],
"@quanta/canvas-worker":   ["packages/canvas-worker/src"],
"@quanta/canvas-worker/*": ["packages/canvas-worker/src/*"],
"@quanta/canvas-pixi":     ["packages/canvas-pixi/src"],
"@quanta/canvas-pixi/*":   ["packages/canvas-pixi/src/*"],
```

### 설치 필요 deps (현재 없음)

```
rbush       SpatialIndex (canvas-engine)
elkjs       ELK layout worker (canvas-engine)
pixi.js     Galaxy/City 렌더러 (canvas-pixi)
```

> Zustand: 기존 프로젝트는 `useSyncExternalStore` 바닐라 패턴 사용  
> (`packages/app-ide/src/stores/git-workspace/git-workspace-store.ts` 참조)  
> workspace-canvas store도 동일 패턴으로 구현한다. Zustand 설치 불필요.

### 재사용할 기존 코드

#### 1. Viewport 로직 (`use-canvas-viewport.ts`)

`packages/app-ide/src/features/editor-canvas/model/use-canvas-viewport.ts`

anchor-preserving zoom 수식과 fit/focus 계산이 검증되어 있음.  
새 `useCanvasViewport` (store 기반)를 만들 때 reducer 로직 그대로 이식:

```typescript
// 재사용할 핵심 함수들
function clampScale(s: number): number          // 0.25 ~ 3 클램프
function computeFit(...): Viewport              // 그래프 fit to container
function computeFocus(region, containerW, containerH): Viewport  // 특정 영역 포커스

// zoom reducer: anchor point 보정 수식
case "zoom": {
  const newScale = clampScale(state.scale * (1 + action.delta));
  const ratio = newScale / state.scale;
  const x = action.cx - (action.cx - state.x) * ratio;
  const y = action.cy - (action.cy - state.y) * ratio;
  return { x, y, scale: newScale };
}
```

새 버전에서는 `useReducer` → store `setViewport` 액션으로 바꾸되 수식은 동일.

#### 2. Ground 레이아웃 상수 (`layout.ts`)

`packages/app-ide/src/features/editor-canvas/model/layout.ts`

GroundCard를 이식할 때 이 상수들을 공통 상수로 추출해 재사용:

```typescript
export const LINE_H         = 20;   // 코드 라인 높이 (virtual rendering 기준)
export const CODE_PAD_X     = 52;   // 거터 너비 (줄번호 + 마커)
export const CODE_FONT_W    = 7.5;  // 모노스페이스 글자 너비
export const EXT_W          = 210;  // ExtNode 카드 너비
export const COL_GAP        = 140;  // 코드 패인 ↔ ExtNode 갭
export const CANVAS_PAD     = 48;   // 캔버스 외곽 여백
export const FILE_HEADER_H  = 92;   // 파일 헤더 높이
```

#### 3. ExtNode 수직 배치 알고리즘 (`positionExternals`)

같은 파일 → `ExternalFileGroup`으로 묶고, 연결된 코드 라인의 Y 좌표에 정렬하는 로직.  
Ground LOD에서 그대로 사용. 파일 위치만 변수로 받도록 파라미터 조정.

#### 4. 기존 엔티티 타입 매핑

| 기존 타입 | 위치 | 새 시스템에서의 역할 |
|---|---|---|
| `FileFacts` | `@quanta/app-ide/entities/file` | `WorkspaceGraph` 빌드 소스 |
| `CodeFragment` | `@quanta/app-ide/entities/canvas` | GroundCard DataTier 3 |
| `LineMarker` | `@quanta/app-ide/entities/canvas` | GroundCard DataTier 4 |
| `CanvasEdge` | `@quanta/app-ide/entities/canvas` | GroundCard DataTier 4 |
| `ExternalNode` | `@quanta/app-ide/entities/canvas` | GroundCard DataTier 4 |
| `FileGroup` | `@quanta/app-ide/entities/canvas` | `FileNode.signals` 로 흡수 |
| `CanvasGraph` | `@quanta/app-ide/entities/canvas` | GroundCard 내부 단일파일 그래프 |

#### 5. GroundCard = 현재 `CanvasView` 이식

`packages/app-ide/src/features/editor-canvas/ui/CanvasView.tsx` 전체를 GroundCard로 이식.  
변경 최소화: `file: FileFacts` prop은 그대로, `viewState` prop 추가만.

재사용 목록:
- `CodePaneView.tsx` — virtual line rendering, syntax highlight
- `EdgeLayer.tsx` — edge + dot 렌더링
- `ExtNode.tsx`, `ExtFileGroup.tsx` — ExtNode 카드
- `FileGroupBg.tsx` — 파일 헤더 + stat grid
- `buildCanvasGraph()` — 단일파일 그래프 빌더

#### 6. 바닐라 Store 패턴

`packages/app-ide/src/stores/git-workspace/git-workspace-store.ts` 참조.

```typescript
// 이 패턴을 workspaceCanvasStore.ts에 동일하게 적용
const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }

let state: WorkspaceCanvasState = initialState;

export const workspaceCanvasStore = {
  getSnapshot: () => state,
  subscribe: (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); },
  // actions
  setGraph: (graph: WorkspaceGraph) => { state = { ...state, graph }; emit(); },
  setLayout: (layout: WorkspaceLayout) => { state = { ...state, layout }; emit(); },
  // ...
};

// React hook
export function useWorkspaceCanvas<T>(selector: (s: WorkspaceCanvasState) => T): T {
  return useSyncExternalStore(
    workspaceCanvasStore.subscribe,
    () => selector(workspaceCanvasStore.getSnapshot()),
  );
}
```

---

## 채택하지 않은 대안

### A. 순수 DOM (현재 구조 확장)

- 장점: 구현 단순, 기존 코드 재사용
- **기각 이유**: Galaxy 레벨 엣지 10,000개에서 SVG 즉사. 200만 줄 레포 전제 불충족.

### B. 순수 WebGL (Three.js / 직접 구현)

- 장점: 최고 성능
- **기각 이유**: 텍스트 렌더링이 핵심인 코드 뷰어에서 SDF 폰트 직접 구현 = 수개월 작업. Street/Ground 레벨에서 오히려 퇴보.

### C. deck.gl

- 장점: 대규모 데이터 시각화 특화, GPU instancing 내장
- **기각 이유**: React 컴포넌트로 파일 카드 구현 불가. 코드 텍스트 인터랙션 (selection, hover) 구현 불가. 커스터마이징 한계.

### D. Canvas2D (Konva.js)

- 장점: PixiJS보다 단순
- **기각 이유**: Canvas2D는 GPU composite를 활용하지 않음. 엣지 10,000개 성능이 PixiJS WebGL 대비 5-10배 느림.

### E. position을 FileNode에 포함 (이전 설계)

- **기각 이유**: 레이아웃 변경 시 WorkspaceGraph 전체 복사 필요. Graph/Layout/View 분리 불가능 → 테스트, 재사용 어려움.

---

## 미해결 문제

1. **LOD 전환 애니메이션**: PixiJS ↔ DOM 스왑 시 시각적 연속성. 크로스페이드 vs 즉시 전환.

2. **댓글 충돌**: 같은 줄에 댓글 여러 개일 때 Ground LOD에서 겹침 처리.

3. **파일 카드 크기 동적 변화**: Ground LOD에서 댓글/ExtNode가 파일 카드 높이를 바꾸면 WorkspaceLayout 부분 갱신 필요. ELK partial relayout 연동.

4. **엣지 라우팅 품질**: EdgeRenderer는 단순 bezier. 파일 카드를 가로지르는 엣지 obstacle avoidance 미구현.

5. **Ground ↔ 에디터 탭 연동**: 캔버스에서 에디터 탭으로 전환 시 스크롤 위치 동기화.

6. **ELK 품질 보장**: 10,000개 파일에서 ELK 결과 가독성 검증 필요. Layer 그룹별 ELK 분할 배치가 대안.

---

## 성공 기준

### 엔진 지표

| 항목 | 목표 |
|---|---|
| Galaxy: 10,000개 파일 + 50,000개 엣지 | 60fps |
| LOD 전환 지연 | < 100ms |
| 초기 레이아웃 (GridLayout) | < 100ms |
| ELK 배치 (Worker, 10,000개 파일) | < 10초 |
| Ground pan/zoom | 현재 동등 (virtual rendering 유지) |
| `canvas-engine`: React/PixiJS import | 0개 |

### UX 지표

| 항목 | 목표 |
|---|---|
| City LOD 진입 후 함수 블록 표시 | < 200ms |
| Ground LOD 진입 후 코드 라인 표시 (Tier 2) | < 300ms |
| Ground LOD Tier 4 (댓글/엣지) 완전 로드 | < 1000ms |
| 파일 카드 드래그 → relayout 반영 | < 500ms |
| hover → Overlay 갱신 | < 16ms (1프레임 이내) |
