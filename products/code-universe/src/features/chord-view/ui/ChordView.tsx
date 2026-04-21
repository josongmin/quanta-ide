// ChordView — top-level SVG renderer for the chord + bundled edges mode.
// --------------------------------------------------------------------
// Consumes a `ChordLayout` (origin-centred coords) and paints onto an
// SVG translated to the viewport centre. z-order:
//   1. Full-size transparent backdrop (click-outside → dismiss)
//   2. Bundled edges (painted first so arcs + leaves sit on top)
//   3. Arcs
//   4. Leaves (dot + label)
//
// Interactions:
//   - Hover leaf: incident edges light up (outbound accent, inbound
//     green); non-incident edges dim to near-invisible so the cone of
//     relationships reads cleanly.
//   - Hover arc: leaves under the arc highlight; the arc itself gets a
//     slight weight bump. Edges between this arc and other arcs tint
//     by target-arc colour (future — for now just keeps default look;
//     the simpler "incident leaf" hover is already enough signal).
//   - Click leaf: `onFocusEntity(leafId)` fires — upstream swaps the
//     view to mind-map centered on that entity. The one cross-view
//     lever.
//   - Click backdrop: `onDismiss()`.
//
// Entry animation: the root `<g>` fades opacity 0→1 over 320ms. Per
// spec the nice-to-have beta ease was descoped — the paths still snap
// in at final beta=0.85, which reads as an instant bundle.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor } from "../../../shared/ui/tokens";
import type { ChordLayout } from "../model/types";
import { ChordArc } from "./ChordArc";
import { ChordEdge, type ChordEdgeState } from "./ChordEdge";
import { ChordLeaf, type ChordLeafState } from "./ChordLeaf";

export interface ChordViewProps {
  layout: ChordLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const DEFAULT_BETA = 0.85;
const ENTRY_MS = 320;

function ChordViewImpl({ layout, width, height, onFocusEntity, onDismiss }: ChordViewProps) {
  const [hoveredLeafId, setHoveredLeafId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fade-in on mount. Two-rAF so the initial paint has opacity 0 before
  // the CSS transition kicks in.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Index leaves by id for edge endpoint lookup.
  const leafById = useMemo(() => {
    const map = new Map<string, (typeof layout.leaves)[number]>();
    for (const l of layout.leaves) map.set(l.id, l);
    return map;
  }, [layout.leaves]);

  // Precompute incidence: for each leaf id, which edges are incident
  // (and in which direction). Accelerates hover re-render when the
  // graph is big.
  const incidentEdges = useMemo(() => {
    const map = new Map<string, { outbound: Set<string>; inbound: Set<string> }>();
    for (const e of layout.edges) {
      if (!map.has(e.fromId)) map.set(e.fromId, { outbound: new Set(), inbound: new Set() });
      if (!map.has(e.toId)) map.set(e.toId, { outbound: new Set(), inbound: new Set() });
      map.get(e.fromId)!.outbound.add(e.id);
      map.get(e.toId)!.inbound.add(e.id);
    }
    return map;
  }, [layout.edges]);

  // Group leaf-id membership for fast "is leaf under hovered group?" tests.
  const leafIdsByGroup = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of layout.groups) map.set(g.id, new Set(g.leafIds));
    return map;
  }, [layout.groups]);

  const groupColorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of layout.groups) map.set(g.id, g.color);
    return map;
  }, [layout.groups]);

  const onLeafHover = useCallback((id: string | null) => setHoveredLeafId(id), []);
  const onGroupHover = useCallback((id: string | null) => setHoveredGroupId(id), []);
  const onLeafFocus = useCallback(
    (id: string) => onFocusEntity?.(id),
    [onFocusEntity],
  );

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Derive per-edge state from hover.
  const edgeStateFor = useCallback(
    (edgeId: string, fromId: string, toId: string): ChordEdgeState => {
      if (hoveredLeafId) {
        if (fromId === hoveredLeafId) return "outbound";
        if (toId === hoveredLeafId) return "inbound";
        return "dimmed";
      }
      if (hoveredGroupId) {
        const members = leafIdsByGroup.get(hoveredGroupId);
        const fromIn = members?.has(fromId) ?? false;
        const toIn = members?.has(toId) ?? false;
        if (fromIn && !toIn) return "outbound";
        if (toIn && !fromIn) return "inbound";
        if (fromIn && toIn) return "default";
        return "dimmed";
      }
      // No hover — ambient density signal.
      void edgeId;
      return "default";
    },
    [hoveredLeafId, hoveredGroupId, leafIdsByGroup],
  );

  const leafStateFor = useCallback(
    (id: string, groupId: string): ChordLeafState => {
      if (hoveredLeafId) {
        if (id === hoveredLeafId) return "highlight";
        // Highlight neighbours — leaves touched by an incident edge.
        const inc = incidentEdges.get(hoveredLeafId);
        if (inc) {
          for (const e of layout.edges) {
            if ((inc.outbound.has(e.id) && e.toId === id) || (inc.inbound.has(e.id) && e.fromId === id)) {
              return "highlight";
            }
          }
        }
        return "dimmed";
      }
      if (hoveredGroupId) {
        return groupId === hoveredGroupId ? "highlight" : "dimmed";
      }
      return "default";
    },
    [hoveredLeafId, hoveredGroupId, incidentEdges, layout.edges],
  );

  const arcStateFor = useCallback(
    (groupId: string): { hovered: boolean; dimmed: boolean } => {
      if (hoveredGroupId) {
        return { hovered: hoveredGroupId === groupId, dimmed: hoveredGroupId !== groupId };
      }
      if (hoveredLeafId) {
        const leaf = leafById.get(hoveredLeafId);
        if (leaf) {
          return { hovered: leaf.groupId === groupId, dimmed: leaf.groupId !== groupId };
        }
      }
      return { hovered: false, dimmed: false };
    },
    [hoveredGroupId, hoveredLeafId, leafById],
  );

  // Sort edges so incident ones paint last (on top) — otherwise the
  // hover highlight is visually buried under the ambient grey mass.
  const orderedEdges = useMemo(() => {
    return [...layout.edges].sort((a, b) => {
      const sa = edgeStateFor(a.id, a.fromId, a.toId);
      const sb = edgeStateFor(b.id, b.fromId, b.toId);
      const score = (s: ChordEdgeState): number => {
        if (s === "outbound" || s === "inbound") return 2;
        if (s === "default") return 1;
        return 0; // dimmed paints first (deepest)
      };
      return score(sa) - score(sb);
    });
  }, [layout.edges, edgeStateFor]);

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

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
      aria-label="Chord + hierarchical edge bundling view"
    >
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
        className="chord-root"
        transform={`translate(${width / 2}, ${height / 2})`}
        style={rootStyle}
      >
        {/* Bundled edges first. */}
        {orderedEdges.map(edge => {
          const fromLeaf = leafById.get(edge.fromId);
          const toLeaf = leafById.get(edge.toId);
          if (!fromLeaf || !toLeaf) return null;
          return (
            <ChordEdge
              key={edge.id}
              edge={edge}
              fromLeaf={fromLeaf}
              toLeaf={toLeaf}
              beta={DEFAULT_BETA}
              state={edgeStateFor(edge.id, edge.fromId, edge.toId)}
            />
          );
        })}

        {/* Arcs. */}
        {layout.groups.map(group => {
          const s = arcStateFor(group.id);
          return (
            <ChordArc
              key={group.id}
              group={group}
              innerRadius={layout.innerRadius}
              hovered={s.hovered}
              dimmed={s.dimmed}
              onHoverChange={onGroupHover}
            />
          );
        })}

        {/* Leaves — dots + labels on the ring. */}
        {layout.leaves.map(leaf => {
          const state = leafStateFor(leaf.id, leaf.groupId);
          const color = groupColorById.get(leaf.groupId) ?? tokenColor.text2;
          return (
            <ChordLeaf
              key={leaf.id}
              leaf={leaf}
              innerRadius={layout.innerRadius}
              color={color}
              state={state}
              onHoverChange={onLeafHover}
              onFocus={onLeafFocus}
            />
          );
        })}
      </g>
    </svg>
  );
}

export const ChordView = memo(ChordViewImpl);
