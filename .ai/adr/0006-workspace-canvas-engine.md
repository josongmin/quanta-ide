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
WorkspaceFacts → WorkspaceGraph → MultiFileCanvas (파일 N개)
```

```
zoom 5%   Galaxy  파일 = 위험도 색상 사각형 + 숫자 배지
zoom 25%  City    함수/클래스 블록 + 시그널 배지
zoom 55%  Street  코드 라인 + 심볼 마커 도트
zoom 80%+ Ground  풀 코드 + ExtNode + EdgeLayer + 댓글
```

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
| City | 0.15 – 0.35 | PixiJS (WebGL) | 함수 블록 + 번들 엣지 |
| Street | 0.35 – 0.75 | DOM | 코드 라인 시작, 텍스트 중요 |
| Ground | ≥ 0.75 | DOM | 풀 코드, 인터랙션, 현재 시스템 |

Scale 0.35를 경계로 PixiJS ↔ DOM이 스왑된다.  
텍스트/인터랙션은 DOM, 선/도형 수만 개는 WebGL — 각자 잘하는 것을 한다.

### 도메인 격리: 별도 패키지

`canvas-engine`을 React, PixiJS와 완전히 독립된 순수 TypeScript 패키지로 격리한다.  
렌더링 기술이 바뀌어도 도메인 로직은 변경되지 않는다.

---

## 패키지 구조

```
packages/
│
├── canvas-engine/                  ← 신규 (프레임워크 의존성 0)
│   ├── src/
│   │   ├── scene/
│   │   │   ├── types.ts            WorkspaceGraph, FileNode, SceneEdge, Comment
│   │   │   ├── WorkspaceGraph.ts   그래프 생성/변경 불변 API
│   │   │   └── SpatialIndex.ts     rbush R-tree, viewport 쿼리
│   │   │
│   │   ├── layout/
│   │   │   ├── ElkLayout.ts        ELK.js 레이어드 그래프 배치 (Worker)
│   │   │   └── GridLayout.ts       단순 그리드 (fallback / 빠른 초기 배치)
│   │   │
│   │   ├── lod/
│   │   │   └── LodManager.ts       scale → LodLevel 결정, 히스테리시스 포함
│   │   │
│   │   └── index.ts                public API
│   │
│   └── package.json                deps: rbush, elkjs only
│
├── canvas-pixi/                    ← 신규 (WebGL 렌더러)
│   ├── src/
│   │   ├── GalaxyRenderer.ts       파일 카드 스프라이트
│   │   ├── CityRenderer.ts         함수 블록
│   │   ├── EdgeRenderer.ts         파일 간 엣지 (단일 draw call)
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
                ├── GlobalEdgeLayer.tsx     파일 간 엣지 (DOM, City 이하)
                └── Minimap.tsx             전체 레이아웃 오버뷰
```

### 의존성 방향

```
canvas-engine   ← 순수 TS, 의존성 없음
canvas-pixi     ← canvas-engine + pixi.js
app-ide         ← canvas-engine + canvas-pixi + shell-contract
```

---

## 도메인 타입 (`canvas-engine/src/scene/types.ts`)

```typescript
// 전체 워크스페이스 그래프 (불변)
interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];       // import / dependency 관계
  comments: WorkspaceComment[];
}

// 2D 캔버스 위 파일 노드
interface FileNode {
  id: string;                  // 파일 경로
  name: string;
  layer: ArchLayer;            // "domain" | "adapter" | "infra" | ...
  position: Rect;              // { x, y, w, h } — layout이 결정
  riskScore: number;
  signals: SignalSummary;      // { taintCount, blastCritical, deadCount, ... }
  functions: FunctionBlock[];  // City LOD용
  // Ground LOD용 데이터는 lazy load
}

interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  signalCount: number;
}

// 파일 간 엣지
interface FileEdge {
  id: string;
  from: string;                // FileNode.id
  to: string;
  kind: "import" | "taint-propagation" | "blast";
  weight: number;              // import 수 → 선 굵기
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

// Spatial Index 쿼리 결과
interface VisibleSet {
  files: FileNode[];
  edges: FileEdge[];
  comments: WorkspaceComment[];
}
```

---

## Spatial Index (`SpatialIndex.ts`)

```typescript
import RBush from 'rbush';

interface BBoxItem {
  minX: number; minY: number;
  maxX: number; maxY: number;
  ref: FileNode;
}

class SpatialIndex {
  private tree = new RBush<BBoxItem>();

  load(files: FileNode[]): void {
    this.tree.load(files.map(f => ({
      minX: f.position.x,     minY: f.position.y,
      maxX: f.position.x + f.position.w,
      maxY: f.position.y + f.position.h,
      ref: f,
    })));
  }

  query(viewport: Rect): FileNode[] {
    return this.tree.search({
      minX: viewport.x,     minY: viewport.y,
      maxX: viewport.x + viewport.w,
      maxY: viewport.y + viewport.h,
    }).map(item => item.ref);
  }
}
// 파일 10,000개 → O(log n) 쿼리
```

---

## Layout (`ElkLayout.ts`)

ELK.js를 Web Worker에서 실행. 메인 스레드 블로킹 없음.

```typescript
// 레이어별 배치 전략
// import 방향이 왼→오른으로 흐름
const elkGraph = {
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.layered.spacing.nodeNodeBetweenLayers": "200",
    "elk.spacing.nodeNode": "60",
  },
  children: files.map(f => ({
    id: f.id,
    width: FILE_CARD_W,
    height: FILE_CARD_H,
  })),
  edges: fileEdges.map(e => ({
    id: e.id,
    sources: [e.from],
    targets: [e.to],
  })),
};

const result = await elk.layout(elkGraph);
// → 각 파일의 { x, y } 좌표
```

초기 배치는 GridLayout (즉각), 백그라운드에서 ElkLayout 계산 후 교체.

---

## LOD Manager

```typescript
type LodLevel = "galaxy" | "city" | "street" | "ground";

// 히스테리시스: 전환 경계에서 깜빡임 방지
//   확대할 때: 낮은 임계값
//   축소할 때: 높은 임계값 (0.03 gap)
const THRESHOLDS = {
  galaxy_to_city:  { up: 0.15, down: 0.12 },
  city_to_street:  { up: 0.35, down: 0.32 },
  street_to_ground:{ up: 0.75, down: 0.72 },
} as const;

class LodManager {
  private current: LodLevel = "galaxy";

  update(scale: number): LodLevel {
    // 현재 레벨에서 임계값 체크
    // 히스테리시스로 경계 진동 방지
    ...
    return this.current;
  }
}
```

---

## PixiJS EdgeRenderer

엣지 수만 개를 단일 draw call로.

```typescript
class EdgeRenderer {
  private gfx: PIXI.Graphics;

  redraw(edges: FileEdge[], positions: Map<string, Rect>, lod: LodLevel) {
    this.gfx.clear();

    for (const edge of edges) {
      const from = positions.get(edge.from);
      const to   = positions.get(edge.to);
      if (!from || !to) continue;

      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x;
      const y2 = to.y + to.h / 2;
      const cp = Math.abs(x2 - x1) * 0.4;

      const alpha = edge.kind === "taint-propagation" ? 0.6 : 0.25;
      const color = edge.kind === "taint-propagation" ? 0xe53e3e : 0xaaaaaa;
      const width = lod === "galaxy" ? edge.weight * 0.3 : 0.8;

      this.gfx
        .moveTo(x1, y1)
        .bezierCurveTo(x1 + cp, y1, x2 - cp, y2, x2, y2)
        .stroke({ width, color, alpha });
    }
    // 엣지 10,000개 → draw call 1개
  }
}
```

---

## React 조립 (`MultiFileCanvas.tsx`)

```tsx
export function MultiFileCanvas({ workspace }: { workspace: WorkspaceFacts }) {
  const graph      = useWorkspaceGraph(workspace);   // canvas-engine
  const layout     = useWorkspaceLayout(graph);      // ElkLayout (Worker)
  const { viewport, transform, pan, zoom } = useCanvasViewport(...);
  const lod        = useLodLevel(viewport.scale);    // LodManager
  const viewRect   = useViewportRect(viewport, containerSize);
  const visible    = useSpatialQuery(graph, layout, viewRect); // SpatialIndex

  return (
    <div className="workspace-canvas" ref={containerRef}>

      {/* Galaxy / City: PixiJS가 담당 */}
      {(lod === "galaxy" || lod === "city") && (
        <PixiStage
          viewport={viewport}
          files={visible.files}
          edges={visible.edges}
          layout={layout}
          lod={lod}
        />
      )}

      {/* Street / Ground: DOM FileCard */}
      {(lod === "street" || lod === "ground") && (
        <div style={{ transform, transformOrigin: "0 0" }}>
          {visible.files.map(f => (
            <FileCard
              key={f.id}
              file={f}
              lod={lod}
              position={layout[f.id]}
              comments={visible.comments.filter(c => c.fileId === f.id)}
            />
          ))}
        </div>
      )}

      <Minimap graph={graph} layout={layout} viewport={viewport} />
      <CanvasControls ... />
    </div>
  );
}
```

---

## FileCard LOD 분기

```tsx
export function FileCard({ file, lod, position, comments }) {
  const style = { left: position.x, top: position.y,
                  width: position.w, height: position.h };

  if (lod === "street") {
    return (
      <div className="file-card" style={style}>
        <FileCardHeader file={file} />
        <StreetCard file={file} />        {/* 코드 라인, 마커 도트만 */}
      </div>
    );
  }

  // ground
  return (
    <div className="file-card" style={style}>
      <FileCardHeader file={file} />
      <GroundCard file={file} comments={comments} />  {/* 현재 CanvasView */}
    </div>
  );
}
```

`GroundCard`는 현재 `CanvasView` 내용을 그대로 이식한다. 기존 코드 재사용.

---

## 댓글 시스템

```
Ground LOD:  코드 라인 옆 말풍선 (줄 앵커)
Street LOD:  줄 번호 옆 작은 인디케이터 도트
City LOD:    함수 블록 옆 숫자 배지
Galaxy LOD:  파일 카드 우상단 숫자
```

```typescript
// 댓글은 canvas-engine 도메인 타입 (라인 앵커)
interface WorkspaceComment {
  fileId: string;
  line: number;       // 특정 줄에 앵커링
  body: string;
  resolved: boolean;
}

// Ground 렌더: 코드 라인과 같은 Y 좌표
function CommentBubble({ comment, lineY }) {
  return (
    <div
      className="comment-bubble"
      style={{ top: lineY(comment.line), right: -240 }}
    >
      {comment.body}
    </div>
  );
}
```

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

## 구현 단계

### Phase 1 — canvas-engine 패키지 (2주)

- `WorkspaceGraph`, `FileNode`, `FileEdge`, `Comment` 타입 정의
- `SpatialIndex` (rbush)
- `GridLayout` (즉시 배치)
- `LodManager` (히스테리시스 포함)
- 단위 테스트 100%

### Phase 2 — PixiJS Galaxy (2주)

- `PixiStage` React 브릿지
- `GalaxyRenderer` (파일 카드 컬러 블록)
- `EdgeRenderer` (엣지 배칭)
- mock 데이터로 1,000개 파일 + 10,000개 엣지 렌더 검증

### Phase 3 — LOD 전환 + Street (2주)

- `FileCard` LOD 스위치
- `StreetCard` (코드 라인, syntax highlight 없음, 마커 도트)
- scale 0.35 경계 PixiJS ↔ DOM 스왑
- 전환 시 깜빡임 없는지 검증

### Phase 4 — GroundCard 편입 (1주)

- 현재 `CanvasView` → `GroundCard`로 이식
- 기존 virtual line rendering, memo, EdgeLayer 그대로 재사용

### Phase 5 — City + 댓글 + ELK 레이아웃 (2주)

- `CityRenderer` (PixiJS 함수 블록)
- 댓글 시스템 (라인 앵커, LOD별 표현)
- `ElkLayout` Worker 교체 (GridLayout 대체)

### Phase 6 — Minimap + 파일 간 엣지 인터랙션 (1주)

- `Minimap` 컴포넌트
- taint propagation 파일 간 하이라이트
- 파일 더블클릭 → 에디터 탭 연동

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
- **기각 이유**: React 컴포넌트로 파일 카드를 만들기 어려움. 코드 텍스트 인터랙션 (selection, hover) 구현 불가. 커스터마이징 한계.

### D. Canvas2D (Konva.js)

- 장점: PixiJS보다 단순
- **기각 이유**: Canvas2D는 GPU composite를 활용하지 않음. 엣지 10,000개 성능이 PixiJS WebGL 대비 5-10배 느림.

---

## 미해결 문제

1. **ELK 레이아웃 수렴 시간**: 10,000개 파일 그래프에서 ELK.js 계산이 수 초 걸릴 수 있음. GridLayout fallback + 점진적 교체 전략 필요.

2. **LOD 전환 애니메이션**: PixiJS ↔ DOM 스왑 시 시각적 연속성 유지 방법. 크로스페이드 vs 즉시 전환.

3. **댓글 충돌**: 같은 줄에 댓글이 여러 개일 때 Ground LOD에서 겹침 처리.

4. **파일 카드 크기 통일**: ELK 배치는 고정 크기를 가정. 댓글/ExtNode가 파일 카드 높이를 바꾸면 레이아웃 재계산 필요.

5. **엣지 라우팅 품질**: PixiJS EdgeRenderer는 단순 bezier. 파일 카드를 가로지르는 엣지 회피 (obstacle avoidance) 미구현.

6. **Ground ↔ 에디터 탭 연동**: 파일을 Ground에서 보다가 에디터 탭으로 전환할 때 스크롤 위치 동기화.

---

## 성공 기준

- [ ] 10,000개 파일, 50,000개 엣지를 Galaxy 레벨에서 60fps 렌더
- [ ] LOD 전환 지연 < 100ms
- [ ] 200만 줄 레포 초기 레이아웃 계산 < 5초 (Worker)
- [ ] Ground 레벨 pan/zoom: 현재 동등 (virtual rendering 유지)
- [ ] `canvas-engine` 패키지: React/PixiJS import 0개
