// MindMapView — the SVG renderer for the egocentric mind-map.
// --------------------------------------------------------------------
// Top-level component. Consumes a pre-computed `MindMapGraph` (origin-
// centred coords) and paints it onto an SVG translated to the viewport
// centre. Renders in z-order:
//   1. Full-size transparent backdrop (captures click-outside → dismiss)
//   2. Edges (tapered bezier ribbons, painted first so nodes sit on top)
//   3. Nodes (centre / aggregator / entity)
//
// Animations:
// - Initial mount: each node fades + scales in, staggered by ring
//   (centre 0ms, aggregators ~40ms, entities ~80ms+).
// - Re-centre (graph.centerId changes): React's key-based reconciliation
//   mounts new nodes with a fresh fade, unmounts removed ones, and
//   persisting nodes interpolate `transform: translate(x, y)` via CSS
//   transition set on the node wrapper.
// - Hover: scale + edge-width multiplier (see MindMapNode / MindMapEdge).

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { MindMapGraph } from "../model/types";
import { MindMapEdge } from "./MindMapEdge";
import { MindMapNode } from "./MindMapNode";

export interface MindMapViewProps {
  /** Pre-computed mind-map graph. `null` = feature inactive, render
   *  nothing (the parent's overlay is collapsed). */
  graph: MindMapGraph | null;
  /** SVG viewport dimensions in CSS pixels. The graph's origin maps to
   *  `(width/2, height/2)`. */
  width: number;
  height: number;
  /** Click on an entity node → usually "re-centre the mind-map on this
   *  entity". Aggregators don't fire this; they're virtual. */
  onFocusEntity?: (entityId: string) => void;
  /** Click on the backdrop outside any node → usually "close mind-map". */
  onDismiss?: () => void;
}

// Mount-delay schedule by node kind/ring. Centre lands first so the
// user's eye has an anchor; then the aggregator ring; then the leaf
// entities. Gentle enough that it reads as "drawing the web" not
// "waiting for a list".
const MOUNT_DELAY_CENTER = 0;
const MOUNT_DELAY_AGGREGATOR = 40;
const MOUNT_DELAY_ENTITY_BASE = 90;
const MOUNT_DELAY_ENTITY_STAGGER = 12;

// Re-centre transition duration — how long a persisting node takes to
// glide to its new position when the centre changes.
const RECENTRE_MS = 400;
// Initial mount transition duration for position — 0 so the node
// appears in place without an unwanted slide-from-origin.
const INITIAL_POSITION_MS = 0;

function MindMapViewImpl({
  graph,
  width,
  height,
  onFocusEntity,
  onDismiss,
}: MindMapViewProps) {
  // Track the last centre id we saw so we can tell "first render with
  // this graph" from "re-centred". On first render we skip the position
  // transition; on re-centre we enable it.
  const [lastCenterId, setLastCenterId] = useState<string | null>(null);
  const isInitial = graph ? lastCenterId !== graph.centerId : true;

  // Commit the new centre id in an effect so the *next* render treats
  // position changes as re-centre transitions. Using an effect (not
  // setState-in-render) avoids any chance of an infinite update loop
  // and cleanly scopes the write to graph swaps.
  useEffect(() => {
    if (graph && graph.centerId !== lastCenterId) {
      setLastCenterId(graph.centerId);
    }
  }, [graph, lastCenterId]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const handleHoverChange = useCallback((id: string | null) => {
    setHoveredNodeId(id);
  }, []);

  // Index nodes by id for edge resolution. useMemo keyed on `graph` so
  // this only rebuilds when the graph swaps.
  const nodeIndex = useMemo(() => {
    const map = new Map<string, { x: number; y: number; radius: number }>();
    if (graph) {
      for (const n of graph.nodes) {
        map.set(n.id, { x: n.x, y: n.y, radius: n.radius });
      }
    }
    return map;
  }, [graph]);

  // Pre-compute connected-edge map for hover-widening.
  const edgesByNode = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (graph) {
      for (const e of graph.edges) {
        if (!map.has(e.fromId)) map.set(e.fromId, new Set());
        if (!map.has(e.toId)) map.set(e.toId, new Set());
        map.get(e.fromId)!.add(e.id);
        map.get(e.toId)!.add(e.id);
      }
    }
    return map;
  }, [graph]);

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  if (!graph) return null;

  // Sort edges so higher-weight paints last (on top) — the contract in
  // `MindMapEdge`'s `weight` comment.
  const sortedEdges = [...graph.edges].sort((a, b) => a.weight - b.weight);

  const hoveredEdges = hoveredNodeId ? edgesByNode.get(hoveredNodeId) : undefined;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        userSelect: "none",
        background: "transparent",
      }}
      role="img"
      aria-label="Entity relationship mind-map"
    >
      <defs>
        <filter id="mindmap-glow" x="-50%" y="-50%" width="200%" height="200%">
          {/* Soft glow under the centre node. Uses a double-blur so the
              falloff reads as a halo rather than a hard drop-shadow. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.05  0 0 0 0 0.6  0 0 0 0 1  0 0 0 0.35 0"
            result="tinted"
          />
          <feMerge>
            <feMergeNode in="tinted" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Backdrop — transparent, full-viewport, captures click-outside. */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={handleBackdropClick}
        style={{ cursor: onDismiss ? "default" : "inherit" }}
      />

      <g
        className="mindmap-root"
        transform={`translate(${width / 2}, ${height / 2})`}
      >
        {/* Edges first so nodes paint on top. */}
        {sortedEdges.map((edge) => {
          const from = nodeIndex.get(edge.fromId);
          const to = nodeIndex.get(edge.toId);
          if (!from || !to) return null;
          const hovered = hoveredEdges?.has(edge.id) ?? false;
          return (
            <MindMapEdge
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              hovered={hovered}
            />
          );
        })}

        {/* Nodes — centre first, then aggregators, then entities. The
            sort is for mount-delay purposes; React keys off `node.id`
            so re-centre reconciliation is stable regardless of order. */}
        {graph.nodes.map((node) => {
          let mountDelay = MOUNT_DELAY_ENTITY_BASE;
          if (node.kind === "center") {
            mountDelay = MOUNT_DELAY_CENTER;
          } else if (node.kind === "aggregator") {
            mountDelay = MOUNT_DELAY_AGGREGATOR;
          } else {
            // Entity: stagger by angle so they fan in around the clock.
            // Normalise angle to [0, 2π) and use it as the stagger index.
            const twoPi = Math.PI * 2;
            const norm = ((node.angle % twoPi) + twoPi) % twoPi;
            const bucket = Math.floor((norm / twoPi) * 12);
            mountDelay = MOUNT_DELAY_ENTITY_BASE + bucket * MOUNT_DELAY_ENTITY_STAGGER;
          }

          return (
            <MindMapNode
              key={node.id}
              node={node}
              mountDelayMs={mountDelay}
              positionTransitionMs={isInitial ? INITIAL_POSITION_MS : RECENTRE_MS}
              onFocusEntity={onFocusEntity}
              onHoverChange={handleHoverChange}
            />
          );
        })}
      </g>
    </svg>
  );
}

export const MindMapView = memo(MindMapViewImpl);
