import { useCallback, useEffect, useRef, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { useCanvasGraph } from "../model/use-canvas-graph";
import { useCanvasViewport } from "../model/use-canvas-viewport";
import { FnNode } from "./FnNode";
import { ClassNode } from "./ClassNode";
import { ExtNode } from "./ExtNode";
import { ExtFileGroup } from "./ExtFileGroup";
import { FileGroupBg } from "./FileGroupBg";
import { FlowEdge } from "./FlowEdge";
import { TaintChainTrack } from "./TaintChainTrack";
import { CanvasControls } from "./CanvasControls";
import "./canvas-view.css";

interface Props {
  file: FileFacts;
}

export function CanvasView({ file }: Props) {
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

  // ── Mouse interaction: pan via drag ─────────────────────────────
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      e.target !== e.currentTarget &&
      !(e.target as HTMLElement).classList.contains("canvas-view__grid")
    ) {
      return;
    }
    e.preventDefault();
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

  // ── Wheel -> zoom ──────────────────────────────────────────────
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

  // ── Node state ──────────────────────────────────────────────────
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const handleNodeClick = useCallback((id: string) => {
    setActiveNodeId((prev) => (prev === id ? null : id));
  }, []);

  const handleNodeDoubleClick = useCallback((_id: string) => {
    // Future: switch to code view + jumpTo(fn.line)
  }, []);

  // ── Build node lookup for edge rendering ────────────────────────
  // Methods inside classGroups have relative positions; compute absolute for edges.
  const allRects = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const cg of graph.classGroups) {
    for (const m of cg.methods) {
      allRects.set(m.id, { x: m.x + cg.x, y: m.y + cg.y, w: m.w, h: m.h });
    }
  }
  for (const n of graph.nodes) {
    allRects.set(n.id, n);
  }
  for (const n of graph.externalNodes) {
    allRects.set(n.id, n);
  }
  // Taint chain nodes — for edges connecting chain endpoints to external nodes
  for (const chain of graph.taintChains) {
    for (const cn of chain.nodes) {
      allRects.set(cn.id, cn);
    }
  }

  // SVG transform string (no "px" units for SVG <g>)
  const svgTransform = `translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`;

  return (
    <div
      className="canvas-view"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: dragging.current ? "grabbing" : "grab" }}
    >
      {/* Dot grid background — pans/zooms with content */}
      <div
        className="canvas-view__grid"
        style={{ transform, transformOrigin: "0 0" }}
      />

      {/* SVG edge layer */}
      <svg className="canvas-view__svg">
        <defs className="canvas-view__defs">
          {/* Call arrow — gray */}
          <marker
            id="arrow-call"
            viewBox="0 0 8 8"
            refX="8"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--border-strong)" />
          </marker>
          {/* Taint arrow — red */}
          <marker
            id="arrow-taint"
            viewBox="0 0 8 8"
            refX="8"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--danger)" />
          </marker>
          {/* Dep arrow — subtle gray */}
          <marker
            id="arrow-dep"
            viewBox="0 0 8 8"
            refX="8"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--fg-subtle)" />
          </marker>
          {/* External arrow — accent-tinted */}
          <marker
            id="arrow-external"
            viewBox="0 0 8 8"
            refX="8"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--border-strong)" />
          </marker>
        </defs>

        <g transform={svgTransform}>
          {graph.edges.map((e) => {
            const fromRect = allRects.get(e.from);
            const toRect = allRects.get(e.to);
            if (!fromRect || !toRect) return null;
            return (
              <FlowEdge
                key={e.id}
                edge={e}
                fromRect={fromRect}
                toRect={toRect}
              />
            );
          })}

          {/* Taint chain dashed arrows */}
          {graph.taintChains.map((chain) =>
            chain.nodes.map((node, i) => {
              if (i >= chain.nodes.length - 1) return null;
              const next = chain.nodes[i + 1];
              const x1 = node.x + node.w;
              const y1 = node.y + node.h / 2;
              const x2 = next.x;
              const y2 = next.y + next.h / 2;
              const dx = x2 - x1;
              const cp = Math.max(dx * 0.3, 20);
              return (
                <path
                  key={`chain-${chain.id}-${i}`}
                  className="taint-chain__edge"
                  d={`M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`}
                  markerEnd="url(#arrow-taint)"
                />
              );
            }),
          )}
        </g>
      </svg>

      {/* HTML nodes layer — same transform as SVG */}
      <div className="canvas-view__nodes" style={{ transform }}>
        {/* File group background container */}
        <FileGroupBg group={graph.fileGroup} />

        {/* Class group containers with their method nodes */}
        {graph.classGroups.map((cg) => (
          <ClassNode
            key={cg.id}
            group={cg}
            activeNodeId={activeNodeId}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
          />
        ))}

        {/* Standalone function nodes (not in a class) */}
        {graph.nodes.map((n) => (
          <FnNode
            key={n.id}
            node={n}
            active={n.id === activeNodeId}
            onClick={handleNodeClick}
            onDoubleClick={handleNodeDoubleClick}
          />
        ))}

        {/* External file group containers */}
        {graph.externalFileGroups.map((g) => (
          <ExtFileGroup key={g.id} group={g} />
        ))}

        {/* External caller/callee nodes */}
        {graph.externalNodes.map((n) => (
          <ExtNode key={n.id} node={n} />
        ))}

        {/* Taint chain tracks */}
        {graph.taintChains.map((chain) => (
          <TaintChainTrack key={chain.id} chain={chain} />
        ))}
      </div>

      {/* Floating zoom controls */}
      <CanvasControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={fit} />
    </div>
  );
}
