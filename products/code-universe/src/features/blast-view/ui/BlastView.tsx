// BlastView — SVG renderer for the Blast Radius Ring View.
// --------------------------------------------------------------------
// Paints concentric rings around a center entity, where each ring is
// one degree of impact (blast or fix). Visual structure:
//   1. Transparent backdrop (click-outside → dismiss)
//   2. Ring circles (faint fill + thin stroke)
//   3. Spoke lines from center to ring-1 nodes
//   4. Edge splines from ring-1 nodes to ring-2+ nodes
//   5. Center circle
//   6. Ring nodes (weighted circles)
//   7. Labels
//
// Hover: hovered node highlights; others dim. Tooltip shown inline.
// Click node: onFocusEntity(node.id)
// Entry animation: opacity 0→1, 280ms.

import { memo, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor } from "../../../shared/ui/tokens";
import type { BlastLayout, BlastRing, BlastRingNode } from "../model/types";

export interface BlastViewProps {
  layout: BlastLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
  onToggleDirection?: () => void;
}

const ENTRY_MS = 280;
const CENTER_RADIUS = 26;
const MAX_LABEL_CHARS = 12;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function BlastViewImpl({
  layout,
  width,
  height,
  onFocusEntity,
  onDismiss,
  onToggleDirection,
}: BlastViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fade-in: two rAFs so initial paint has opacity 0.
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

  const cx = width / 2;
  const cy = height / 2;

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      onFocusEntity?.(nodeId);
    },
    [onFocusEntity],
  );

  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    setHoveredNodeId(nodeId);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // Collect all nodes for hover-dim logic
  const allNodes: BlastRingNode[] = layout.rings.flatMap(r => r.nodes);

  // Find ring-1 nodes for spoke rendering
  const ring1 = layout.rings.find(r => r.depth === 1);

  // Build a map: ring-1 node → nearest ring-2+ node (for edge splines)
  // Simplified: for each ring-2+ node, find the ring-1 node with closest angle
  function nearestRing1Node(nodeAngle: number): BlastRingNode | null {
    if (!ring1 || ring1.nodes.length === 0) return null;
    let best: BlastRingNode | null = null;
    let bestDiff = Infinity;
    for (const n of ring1.nodes) {
      const diff = Math.abs(normalizeAngle(n.angle - nodeAngle));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = n;
      }
    }
    return best;
  }

  // Empty state
  if (layout.rings.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent" }}
        role="img"
        aria-label="Blast radius view — no data"
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={handleBackdropClick}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={13}
          fill={tokenColor.text2}
          fontStyle="italic"
          fontFamily="Inter Tight, Inter, sans-serif"
        >
          Select a file to see its blast radius
        </text>
        {onToggleDirection && (
          <foreignObject x={16} y={8} width={220} height={36}>
            <DirectionToggleButton
              direction={layout.direction}
              onToggle={onToggleDirection}
            />
          </foreignObject>
        )}
      </svg>
    );
  }

  const directionLabel =
    layout.direction === "blast"
      ? `Blast from ${layout.centerLabel} — ${layout.totalAffected} affected`
      : `Fix from ${layout.centerLabel} — ${layout.totalAffected} affected`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label={`Blast radius view: ${directionLabel}`}
    >
      {/* Backdrop */}
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
        className="blast-root"
        transform={`translate(${cx}, ${cy})`}
        style={rootStyle}
      >
        {/* Ring background circles */}
        {layout.rings.map((ring: BlastRing) => (
          <circle
            key={`ring-bg-${ring.depth}`}
            cx={0}
            cy={0}
            r={ring.ringRadius}
            fill={ring.ringColor}
            stroke={tokenColor.border}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        ))}

        {/* Depth labels at 3 o'clock */}
        {layout.rings.map((ring: BlastRing) => (
          <text
            key={`ring-label-${ring.depth}`}
            x={ring.ringRadius + 4}
            y={4}
            fontSize={9}
            fill={tokenColor.text2}
            fontFamily="Inter Tight, Inter, sans-serif"
          >
            Depth {ring.depth}
          </text>
        ))}

        {/* Spoke lines from center to ring-1 nodes */}
        {ring1?.nodes.map((node: BlastRingNode) => (
          <line
            key={`spoke-${node.id}`}
            x1={0}
            y1={0}
            x2={node.x}
            y2={node.y}
            stroke={tokenColor.border}
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        ))}

        {/* Edge splines from ring-1 nodes to ring-2+ nodes */}
        {layout.rings
          .filter((r: BlastRing) => r.depth >= 2)
          .flatMap((ring: BlastRing) =>
            ring.nodes.map((node: BlastRingNode) => {
              const r1 = nearestRing1Node(node.angle);
              if (!r1) return null;
              return (
                <line
                  key={`edge-${r1.id}-${node.id}`}
                  x1={r1.x}
                  y1={r1.y}
                  x2={node.x}
                  y2={node.y}
                  stroke={tokenColor.border}
                  strokeOpacity={0.15}
                  strokeWidth={1}
                />
              );
            })
          )}

        {/* Ring nodes */}
        {allNodes.map((node: BlastRingNode) => {
          const isHovered = hoveredNodeId === node.id;
          const isDimmed = hoveredNodeId !== null && !isHovered;
          const opacity = isDimmed ? 0.15 : isHovered ? 1.0 : 0.85;
          return (
            <g
              key={node.id}
              style={{ cursor: "pointer" }}
              onClick={e => handleNodeClick(e, node.id)}
              onMouseEnter={() => handleNodeMouseEnter(node.id)}
              onMouseLeave={handleNodeMouseLeave}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={node.color}
                opacity={opacity}
                stroke={isHovered ? tokenColor.text0 : "none"}
                strokeWidth={isHovered ? 1.5 : 0}
              />
              {/* Node label */}
              <text
                x={node.x}
                y={node.y + node.r + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill={tokenColor.text1}
                opacity={isDimmed ? 0.15 : 1}
                fontFamily="Inter Tight, Inter, sans-serif"
              >
                {truncate(node.label, MAX_LABEL_CHARS)}
              </text>
              {/* Hover tooltip */}
              {isHovered && (
                <title>{`${node.label} (depth ${node.depth}, weight ${node.weight.toFixed(1)})`}</title>
              )}
            </g>
          );
        })}

        {/* Center node — rendered last (on top) */}
        <g style={{ pointerEvents: "none" }}>
          <circle
            cx={0}
            cy={0}
            r={CENTER_RADIUS}
            fill={getCenterColor(layout.centerKind)}
            style={{
              filter: "drop-shadow(0 0 8px currentColor)",
            }}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontWeight={600}
            fill={tokenColor.bg0}
            fontFamily="Inter Tight, Inter, sans-serif"
          >
            {truncate(layout.centerLabel, MAX_LABEL_CHARS)}
          </text>
        </g>
      </g>

      {/* Summary bar */}
      <text
        x={20}
        y={16}
        fontSize={11}
        fill={tokenColor.text1}
        fontFamily="Inter Tight, Inter, sans-serif"
      >
        {directionLabel}
        {layout.overflow > 0 ? ` (+${layout.overflow} hidden)` : ""}
      </text>

      {/* Direction toggle */}
      {onToggleDirection && (
        <foreignObject x={16} y={28} width={240} height={36}>
          <DirectionToggleButton
            direction={layout.direction}
            onToggle={onToggleDirection}
          />
        </foreignObject>
      )}
    </svg>
  );
}

// ── Direction toggle button ───────────────────────────────────────────

interface DirectionToggleButtonProps {
  direction: "blast" | "fix";
  onToggle: () => void;
}

function DirectionToggleButton({ direction, onToggle }: DirectionToggleButtonProps) {
  const label =
    direction === "blast"
      ? "Blast (what breaks)"
      : "Fix (what stabilizes)";

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        fontSize: 10,
        padding: "3px 8px",
        borderRadius: 4,
        border: `1px solid ${tokenColor.border}`,
        background: tokenColor.bg1,
        color: tokenColor.text1,
        cursor: "pointer",
        fontFamily: "Inter Tight, Inter, sans-serif",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function getCenterColor(kind: BlastLayout["centerKind"]): string {
  const colors: Record<BlastLayout["centerKind"], string> = {
    universe: "#7e4ed6",
    galaxy: "#0d99ff",
    street: "#22a06b",
    building: "#3d3d3d",
    floor: "#e09321",
    room: "#e5484d",
  };
  return colors[kind];
}

function normalizeAngle(a: number): number {
  let n = a % (2 * Math.PI);
  if (n > Math.PI) n -= 2 * Math.PI;
  if (n < -Math.PI) n += 2 * Math.PI;
  return n;
}

export const BlastView = memo(BlastViewImpl);
