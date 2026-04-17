import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { CanvasSelection } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";
import { useCanvasGraph } from "../model/use-canvas-graph";
import { useCanvasViewport } from "../model/use-canvas-viewport";
import { selectNode, expandFlow } from "../lib/flow-slice";
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
  const { viewport, transform, pan, zoom, fit, focusRegion, zoomIn, zoomOut } =
    useCanvasViewport(graph.width, graph.height, containerSize.w, containerSize.h);

  // ── Expanded graph (grows as user expands flow hops) ────────────
  const [expandedGraph, setExpandedGraph] = useState(graph);
  useEffect(() => setExpandedGraph(graph), [graph]);

  // ── Auto-focus: center on external nodes region (flow diagram) ───
  const hasFocused = useRef(false);
  useEffect(() => {
    if (hasFocused.current || containerSize.w === 0) return;

    if (graph.externalNodes.length > 0) {
      // Focus on the area where external nodes live — shows full flow
      const ys = graph.externalNodes.map((n) => n.y);
      const minY = Math.min(...ys) - 120;
      const maxY = Math.max(...graph.externalNodes.map((n) => n.y + n.h)) + 120;
      focusRegion({ x: 0, y: minY, w: graph.width, h: maxY - minY });
    } else {
      // Fallback: fit entire graph
      focusRegion({ x: 0, y: 0, w: graph.width, h: graph.height });
    }
    hasFocused.current = true;
  }, [graph, containerSize, focusRegion]);

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
      setSelection((prev) =>
        prev?.nodeId === nodeId ? null : selectNode(expandedGraph, nodeId, file.nextHops),
      );
    },
    [expandedGraph, file.nextHops],
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      const edge = expandedGraph.edges.find((e) => e.id === edgeId);
      if (!edge) return;
      setSelection((prev) =>
        prev?.nodeId === edge.extNodeId ? null : selectNode(expandedGraph, edge.extNodeId, file.nextHops),
      );
    },
    [expandedGraph, file.nextHops],
  );

  const handleExpandFlow = useCallback(
    (nodeId: string) => {
      // Expand ALL reachable hops at once — trace to terminal
      let g = expandedGraph;
      const visited = new Set<string>();
      const queue = [nodeId];

      while (queue.length > 0) {
        const nid = queue.shift()!;
        if (visited.has(nid)) continue;
        visited.add(nid);

        const targets = file.nextHops?.[nid];
        if (!targets || targets.length === 0) continue;

        g = expandFlow(g, nid, targets);

        // Queue newly added nodes for further expansion
        for (const t of targets) {
          const expandedId = `ext:expanded:${t.name}`;
          if (!visited.has(expandedId)) queue.push(expandedId);
        }
      }

      setExpandedGraph(g);
      setSelection(selectNode(g, nodeId, file.nextHops));
    },
    [expandedGraph, file.nextHops],
  );

  // Clear selection when base graph changes
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

  // Use native wheel event to safely call preventDefault (non-passive)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        zoom(e.deltaY * -0.004, cx, cy);
      } else {
        pan(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, pan]);

  return (
    <div
      className={cn("canvas-view", selection && "canvas-view--has-selection")}
      ref={containerRef}
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
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        <FileGroupBg group={expandedGraph.fileGroup} />
        <CodePaneView
          codePane={expandedGraph.codePane}
          markers={expandedGraph.lineMarkers}
          activeLines={activeLines}
        />
        {expandedGraph.externalFileGroups.map((g) => (
          <ExtFileGroup key={g.id} group={g} />
        ))}
        {expandedGraph.externalNodes.map((n) => (
          <ExtNode
            key={n.id}
            node={n}
            active={activeNodes?.has(n.id)}
            expandable={selection?.expandableNodeIds?.includes(n.id)}
            onNodeClick={handleNodeClick}
            onExpand={handleExpandFlow}
          />
        ))}
        <EdgeLayer graph={expandedGraph} activeEdges={activeEdges} onEdgeClick={handleEdgeClick} />
      </div>

      <CanvasControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />
    </div>
  );
}
