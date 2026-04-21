// NeighborhoodView.tsx
// ---------------------------------------------------------------
// SVG renderer for the "Neighborhood Halo" view.
//
// Layout:
//   1. Full-fill SVG with transparent backdrop (click → dismiss)
//   2. Dashed concentric guide rings at radii 120, 240
//   3. Edge lines (thin, severity-colored or border-colored)
//   4. Node circles (risk-colored; center = accent with glow)
//   5. Node labels (xs font)
//   6. Hover tooltip + pulse animation on hovered node
//   7. Bottom status bar (foreign-object)
//
// Interaction:
//   - Hover: pulse animation + tooltip
//   - Click node: onFocusEntity(fileId) — re-centers the view
//   - Backdrop click: onDismiss()
//
// Entry animation: 0→1 opacity over 260ms.

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, space } from "../../../shared/ui/tokens";
import { buildNeighborhoodLayout } from "../model/build-neighborhood-layout";
import type { NeighborhoodEdge, NeighborhoodLayout, NeighborhoodNode } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface NeighborhoodViewProps {
  graph: WorkspaceGraph;
  selectedId?: string;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const ENTRY_MS = 260;
const GUIDE_RADII = [120, 240] as const;
const MAX_LABEL_CHARS = 14;

// Severity → stroke color mapping
const SEVERITY_COLOR: Readonly<Record<string, string>> = {
  critical: "#e5484d",
  high: "#e09321",
  medium: "#0d99ff",
  low: "#22a06b",
};

// ── Helpers ────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function severityStroke(severity: string | undefined): string {
  return severity ? (SEVERITY_COLOR[severity] ?? color.border) : color.border;
}

// ── Sub-component: single node ─────────────────────────────────────────

interface NodeGlyphProps {
  node: NeighborhoodNode;
  isCenter: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onClick: (e: React.MouseEvent, fileId: string) => void;
  onEnter: (fileId: string) => void;
  onLeave: () => void;
}

function NodeGlyph({ node, isCenter, isHovered, isDimmed, onClick, onEnter, onLeave }: NodeGlyphProps) {
  const opacity = isDimmed ? 0.18 : isHovered ? 1 : 0.88;
  const strokeColor = isHovered ? color.text0 : isCenter ? color.accent : "none";
  const strokeWidth = isHovered ? 2 : isCenter ? 1.5 : 0;
  const r = isHovered ? node.radius + 2 : node.radius;

  const glyphStyle: CSSProperties = {
    cursor: "pointer",
    transition: "opacity 120ms ease-out",
  };

  // Label position: below for non-center nodes, inside for center
  const labelY = isCenter ? node.y + 1 : node.y + node.radius + 10;
  const labelBaseline = isCenter ? "middle" : "hanging";

  return (
    <g
      style={glyphStyle}
      opacity={opacity}
      onClick={e => onClick(e, node.fileId)}
      onMouseEnter={() => onEnter(node.fileId)}
      onMouseLeave={onLeave}
    >
      {/* Pulse ring for hover */}
      {isHovered && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius + 6}
          fill="none"
          stroke={node.color}
          strokeWidth={1.5}
          strokeOpacity={0.4}
          style={{ animation: "nh-pulse 900ms ease-out infinite" }}
        />
      )}

      {/* Glow for center node */}
      {isCenter && (
        <circle
          cx={node.x}
          cy={node.y}
          r={node.radius + 8}
          fill={color.accentSoft}
          stroke={color.accentBorder}
          strokeWidth={1}
        />
      )}

      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={node.color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={isCenter ? { filter: "drop-shadow(0 0 6px rgba(13,153,255,0.5))" } : undefined}
      />

      {/* Center node: file name + "center" badge */}
      {isCenter && (
        <>
          <text
            x={node.x}
            y={node.y - 3}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.xs}
            fontWeight={font.weight.semibold}
            fill={color.bg0}
            fontFamily={font.sans}
          >
            {truncate(node.fileName, 10)}
          </text>
          <text
            x={node.x}
            y={node.y + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.xxs}
            fill="rgba(255,255,255,0.75)"
            fontFamily={font.sans}
          >
            center
          </text>
        </>
      )}

      {/* Non-center label below node */}
      {!isCenter && (
        <text
          x={node.x}
          y={labelY}
          textAnchor="middle"
          dominantBaseline={labelBaseline}
          fontSize={font.size.xs}
          fill={color.text1}
          fontFamily={font.sans}
        >
          {truncate(node.fileName, MAX_LABEL_CHARS)}
        </text>
      )}

      {/* Hover tooltip */}
      {isHovered && (
        <title>{`${node.fileName} · hop ${node.hop} · risk ${(node.riskScore * 100).toFixed(0)}%`}</title>
      )}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────

function NeighborhoodViewImpl({ graph, selectedId, onFocusEntity, onDismiss }: NeighborhoodViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: 480 });

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const e = entries[0];
      if (!e) return;
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fade-in
  useEffect(() => {
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const layout: NeighborhoodLayout = buildNeighborhoodLayout({ graph, selectedId });

  const cx = size.w / 2;
  const cy = size.h / 2;

  const handleBackdrop = useCallback(() => { onDismiss?.(); }, [onDismiss]);

  const handleNodeClick = useCallback((e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    onFocusEntity?.(fileId);
  }, [onFocusEntity]);

  const handleEnter = useCallback((fileId: string) => setHoveredId(fileId), []);
  const handleLeave = useCallback(() => setHoveredId(null), []);

  const svgStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    userSelect: "none",
    background: "transparent",
  };

  const groupStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // Empty state
  if (layout.nodes.length === 0) {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        <svg
          ref={containerRef}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={svgStyle}
          role="img"
          aria-label="Neighborhood Halo — no data"
        >
          <rect x={0} y={0} width={size.w} height={size.h} fill="transparent" onClick={handleBackdrop} />
          <text
            x={size.w / 2}
            y={size.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.md}
            fill={color.text2}
            fontStyle="italic"
            fontFamily={font.sans}
          >
            No files in graph
          </text>
        </svg>
      </div>
    );
  }

  const centerNode = layout.nodes.find(n => n.hop === 0);
  const nonCenterNodes = layout.nodes.filter(n => n.hop !== 0);
  const centerFileName = centerNode?.fileName ?? layout.center;

  // Node lookup for edge rendering
  const nodeById = new Map(layout.nodes.map(n => [n.fileId, n]));

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      {/* Keyframe injection */}
      <style>{`
        @keyframes nh-pulse {
          0%   { r: ${(centerNode?.radius ?? 18) + 6}; opacity: 0.5; }
          100% { r: ${(centerNode?.radius ?? 18) + 18}; opacity: 0; }
        }
      `}</style>

      <svg
        ref={containerRef}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ ...svgStyle, flex: 1 }}
        role="img"
        aria-label={`Neighborhood Halo — ${layout.totalNodes} nodes around ${centerFileName}`}
      >
        {/* Backdrop */}
        <rect
          x={0} y={0}
          width={size.w} height={size.h}
          fill="transparent"
          onClick={handleBackdrop}
          style={{ cursor: onDismiss ? "default" : "inherit" }}
        />

        <g transform={`translate(${cx}, ${cy})`} style={groupStyle}>
          {/* Guide rings — dashed, subtle */}
          {GUIDE_RADII.map(r => (
            <circle
              key={`guide-${r}`}
              cx={0} cy={0} r={r}
              fill="none"
              stroke={color.border}
              strokeWidth={1}
              strokeDasharray="4 6"
              strokeOpacity={0.55}
            />
          ))}

          {/* Guide ring labels at 3 o'clock */}
          {GUIDE_RADII.map((r, i) => (
            <text
              key={`guide-label-${r}`}
              x={r + 4}
              y={-4}
              fontSize={font.size.xxs}
              fill={color.text3}
              fontFamily={font.sans}
            >
              {i === 0 ? "1-hop" : "2-hop"}
            </text>
          ))}

          {/* Edges */}
          {layout.edges.map((edge: NeighborhoodEdge) => {
            const fromNode = nodeById.get(edge.from);
            const toNode = nodeById.get(edge.to);
            if (!fromNode || !toNode) return null;
            const isHovAdj =
              hoveredId === edge.from || hoveredId === edge.to;
            const edgeOpacity = hoveredId ? (isHovAdj ? 0.8 : 0.08) : 0.22;
            const edgeColor = edge.isHighlighted
              ? severityStroke(edge.severity)
              : color.border;
            const strokeW = edge.isHighlighted ? 1.5 : 1;
            return (
              <line
                key={edge.id}
                x1={fromNode.x} y1={fromNode.y}
                x2={toNode.x} y2={toNode.y}
                stroke={edgeColor}
                strokeWidth={strokeW}
                strokeOpacity={edgeOpacity}
              />
            );
          })}

          {/* Non-center nodes (rendered below center) */}
          {nonCenterNodes.map((node: NeighborhoodNode) => (
            <NodeGlyph
              key={node.fileId}
              node={node}
              isCenter={false}
              isHovered={hoveredId === node.fileId}
              isDimmed={hoveredId !== null && hoveredId !== node.fileId}
              onClick={handleNodeClick}
              onEnter={handleEnter}
              onLeave={handleLeave}
            />
          ))}

          {/* Center node — always on top */}
          {centerNode && (
            <NodeGlyph
              key={centerNode.fileId}
              node={centerNode}
              isCenter={true}
              isHovered={hoveredId === centerNode.fileId}
              isDimmed={false}
              onClick={handleNodeClick}
              onEnter={handleEnter}
              onLeave={handleLeave}
            />
          )}
        </g>

        {/* Title */}
        <text
          x={space[4]}
          y={space[4]}
          fontSize={font.size.sm}
          fontWeight={font.weight.semibold}
          fill={color.text0}
          fontFamily={font.sans}
          dominantBaseline="hanging"
        >
          Neighborhood Halo
        </text>
      </svg>

      {/* Bottom bar */}
      <div
        style={{
          flexShrink: 0,
          padding: `${space[1]}px ${space[4]}px`,
          borderTop: `1px solid ${color.border}`,
          display: "flex",
          alignItems: "center",
          gap: space[2],
          background: color.bg1,
        }}
      >
        <span
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            fontFamily: font.sans,
          }}
        >
          {layout.totalNodes} node{layout.totalNodes !== 1 ? "s" : ""} in {layout.maxHops}-hop neighborhood
        </span>
        <span style={{ color: color.border, fontSize: font.size.xs }}>·</span>
        <span
          style={{
            fontSize: font.size.xs,
            color: color.text1,
            fontFamily: font.sans,
            fontWeight: font.weight.medium,
          }}
        >
          {centerFileName}
        </span>
      </div>
    </div>
  );
}

export const NeighborhoodView = memo(NeighborhoodViewImpl);
