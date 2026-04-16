import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { CanvasSelection } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";
import { useCanvasGraph } from "../model/use-canvas-graph";
import { useCanvasViewport } from "../model/use-canvas-viewport";
import { selectNode } from "../lib/flow-slice";
import { CodePaneView } from "./CodePaneView";
import { ExtNode } from "./ExtNode";
import { ExtFileGroup } from "./ExtFileGroup";
import { FileGroupBg } from "./FileGroupBg";
import { EdgeLayer } from "./EdgeLayer";
import { CanvasControls } from "./CanvasControls";
import "./canvas-view.css";

export function CanvasView({ file }: { file: FileFacts }) {
  const graph = useCanvasGraph(file);

  // ── Container sizing via ResizeObserver ──────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Viewport (pan / zoom / fit) ─────────────────────────────────
  const { viewport, transform, pan, zoom, fit, zoomIn, zoomOut } =
    useCanvasViewport(graph.width, graph.height, containerSize.w, containerSize.h);

  // ── Selection state ─────────────────────────────────────────────
  const [selection, setSelection] = useState<CanvasSelection | null>(null);

  const activeLines = useMemo(
    () => (selection ? new Set(selection.activeLines) : undefined),
    [selection],
  );
  const activeNodes = useMemo(
    () => (selection ? new Set(selection.flowNodes) : undefined),
    [selection],
  );
  const activeEdges = useMemo(
    () => (selection ? new Set(selection.flowPath) : undefined),
    [selection],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelection((prev) => (prev?.nodeId === nodeId ? null : selectNode(graph, nodeId)));
    },
    [graph],
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      setSelection((prev) =>
        prev?.nodeId === edge.extNodeId ? null : selectNode(graph, edge.extNodeId),
      );
    },
    [graph],
  );

  // Clear selection when graph changes
  useEffect(() => setSelection(null), [graph]);

  // ── Mouse interaction: pan via drag ─────────────────────────────
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select, .ext-node, .terminal-node")) return;
    e.preventDefault();
    setSelection(null);
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      pan(dx, dy);
    },
    [pan],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      zoom(e.deltaY * -0.001, cx, cy);
    },
    [zoom],
  );

  return (
    <div
      className={cn("canvas-view", selection && "canvas-view--has-selection")}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragging.current ? "grabbing" : "grab" }}
    >
      <div
        className="canvas-view__grid"
        style={{ transform, transformOrigin: "0 0" }}
      />

      <div
        className="canvas-view__nodes"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px)`,
          zoom: viewport.scale,
        }}
      >
        <FileGroupBg group={graph.fileGroup} />
        <CodePaneView
          codePane={graph.codePane}
          markers={graph.lineMarkers}
          activeLines={activeLines}
        />
        {graph.externalFileGroups.map((g) => (
          <ExtFileGroup key={g.id} group={g} />
        ))}
        {graph.externalNodes.map((n) => (
          <ExtNode
            key={n.id}
            node={n}
            active={activeNodes?.has(n.id)}
            onNodeClick={handleNodeClick}
          />
        ))}
        <EdgeLayer graph={graph} activeEdges={activeEdges} onEdgeClick={handleEdgeClick} />
      </div>

      <CanvasControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />
    </div>
  );
}
