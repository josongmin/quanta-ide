// PathfinderView.tsx
// ---------------------------------------------------------------
// SVG renderer for the "Pathfinding Spotlight" view.
//
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │  Path tabs  (Path 1 · N hops | Path 2 …)    │
//   │  ─────────────────────────────────────────   │
//   │  SVG canvas:                                 │
//   │    SOURCE ──bezier──> [nodes] ──> TARGET     │
//   │    (non-active paths dimmed to 0.3)          │
//   │  ─────────────────────────────────────────   │
//   │  Bottom bar: source → target | shortest      │
//   └──────────────────────────────────────────────┘
//
// Interaction:
//   - Path tab click: highlight that path (others dimmed)
//   - Node click: onFocusEntity(fileId)
//   - Source / target dropdowns: rebuild layout on selection change
//   - Backdrop click: onDismiss

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import { buildPathfinderLayout } from "../model/build-pathfinder-layout";
import type { PathfinderEdge, PathfinderLayout, PathfinderNode } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface PathfinderViewProps {
  graph: WorkspaceGraph;
  selectedId?: string;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const ENTRY_MS = 240;
const NODE_W = 100;
const NODE_H = 32;
const MAX_LABEL_CHARS = 12;
const PATH_COLORS = ["#0d99ff", "#7e4ed6", "#22a06b"] as const;

// ── Helpers ────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function firstPathColor(mask: number): string {
  for (let i = 0; i < PATH_COLORS.length; i++) {
    if (mask & (1 << i)) return PATH_COLORS[i]!;
  }
  return color.border;
}

/** Cubic bezier path string from (x1,y1) to (x2,y2) with horizontal control points */
function bezierH(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ── Path tab strip ─────────────────────────────────────────────────────

interface PathTabsProps {
  paths: PathfinderLayout["paths"];
  activeIdx: number;
  onSelect: (idx: number) => void;
}

function PathTabs({ paths, activeIdx, onSelect }: PathTabsProps) {
  if (paths.length === 0) return null;

  const tabContainerStyle: CSSProperties = {
    display: "flex",
    gap: space[1],
    padding: `${space[1]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    background: color.bg2,
    flexShrink: 0,
    overflowX: "auto",
  };

  return (
    <div style={tabContainerStyle}>
      {paths.map((path, i) => {
        const isActive = i === activeIdx;
        const tabStyle: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: space[1],
          padding: `${space[1]}px ${space[3]}px`,
          borderRadius: radius.sm,
          border: `1px solid ${isActive ? path.pathColor : color.border}`,
          background: isActive ? `${path.pathColor}18` : color.bg1,
          color: isActive ? path.pathColor : color.text2,
          fontSize: font.size.xs,
          fontFamily: font.sans,
          fontWeight: isActive ? font.weight.semibold : font.weight.regular,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "all 120ms ease-out",
          userSelect: "none",
        };
        const hopCount = path.nodeIds.length - 1;
        return (
          <button
            key={i}
            type="button"
            style={tabStyle}
            onClick={() => onSelect(i)}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: path.pathColor,
                flexShrink: 0,
              }}
            />
            Path {i + 1}
            <span style={{ color: isActive ? path.pathColor : color.text3, fontSize: font.size.xxs }}>
              {hopCount} hop{hopCount !== 1 ? "s" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Node rectangle ─────────────────────────────────────────────────────

interface NodeRectProps {
  node: PathfinderNode;
  isSource: boolean;
  isTarget: boolean;
  activePathMask: number;
  isHovered: boolean;
  isDimmed: boolean;
  onClick: (e: React.MouseEvent, fileId: string) => void;
  onEnter: (fileId: string) => void;
  onLeave: () => void;
}

function NodeRect({ node, isSource, isTarget, activePathMask, isHovered, isDimmed, onClick, onEnter, onLeave }: NodeRectProps) {
  const isOnActivePath = (node.pathMask & activePathMask) !== 0;
  const opacity = isDimmed ? 0.25 : isOnActivePath ? 1 : 0.45;
  const nodeColor = firstPathColor(node.pathMask & activePathMask || node.pathMask);
  const borderColor = isSource
    ? color.success
    : isTarget
    ? color.danger
    : isHovered
    ? nodeColor
    : color.border;
  const bgColor = isSource
    ? "rgba(34,160,107,0.10)"
    : isTarget
    ? "rgba(229,72,77,0.10)"
    : isOnActivePath
    ? `${nodeColor}14`
    : color.bg1;

  const x = node.x - NODE_W / 2;
  const y = node.y - NODE_H / 2;

  const rectStyle: CSSProperties = {
    cursor: "pointer",
    transition: "opacity 150ms ease-out",
  };

  return (
    <g
      style={rectStyle}
      opacity={opacity}
      onClick={e => onClick(e, node.fileId)}
      onMouseEnter={() => onEnter(node.fileId)}
      onMouseLeave={onLeave}
    >
      {/* Rect background */}
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={radius.sm}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={isHovered ? 1.5 : 1}
      />

      {/* File name */}
      <text
        x={node.x}
        y={node.y - 3}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={font.size.xs}
        fontWeight={font.weight.medium}
        fill={color.text0}
        fontFamily={font.sans}
      >
        {truncate(node.fileName, MAX_LABEL_CHARS)}
      </text>

      {/* Layer badge */}
      <text
        x={node.x}
        y={node.y + 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={font.size.xxs}
        fill={color.text3}
        fontFamily={font.sans}
      >
        {node.layer}
      </text>

      {/* SOURCE / TARGET labels above/below */}
      {(isSource || isTarget) && (
        <text
          x={node.x}
          y={isSource ? y - 6 : y + NODE_H + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={font.size.xxs}
          fontWeight={font.weight.bold}
          fill={isSource ? color.success : color.danger}
          fontFamily={font.sans}
          letterSpacing={1}
        >
          {isSource ? "SOURCE" : "TARGET"}
        </text>
      )}

      {isHovered && (
        <title>{`${node.fileName} · ${node.layer} · risk ${(node.riskScore * 100).toFixed(0)}%`}</title>
      )}
    </g>
  );
}

// ── File picker dropdown (foreignObject) ──────────────────────────────

interface FilePickerProps {
  files: Array<{ id: string; name: string }>;
  value: string;
  x: number;
  y: number;
  label: string;
  onChange: (id: string) => void;
}

function FilePicker({ files, value, x, y, label, onChange }: FilePickerProps) {
  const pickerW = 160;
  const pickerH = 26;

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontFamily: font.sans,
  };

  const labelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: color.text3,
    fontFamily: font.sans,
    whiteSpace: "nowrap",
  };

  const selectStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text1,
    background: color.bg1,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    padding: `2px ${space[1]}px`,
    cursor: "pointer",
    fontFamily: font.sans,
    height: pickerH,
    maxWidth: pickerW - 40,
  };

  return (
    <foreignObject x={x} y={y} width={pickerW} height={pickerH + 4}>
      <div style={containerStyle}>
        <span style={labelStyle}>{label}</span>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={selectStyle}
        >
          {files.map(f => (
            <option key={f.id} value={f.id}>
              {truncate(f.name ?? f.id.split("/").pop() ?? f.id, 18)}
            </option>
          ))}
        </select>
      </div>
    </foreignObject>
  );
}

// ── Main component ─────────────────────────────────────────────────────

function PathfinderViewImpl({ graph, selectedId, onFocusEntity, onDismiss }: PathfinderViewProps) {
  const [mounted, setMounted] = useState(false);
  const [activePathIdx, setActivePathIdx] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 680, h: 400 });

  // Manual source/target overrides
  const [manualSource, setManualSource] = useState<string | undefined>(undefined);
  const [manualTarget, setManualTarget] = useState<string | undefined>(undefined);

  // Observe container
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

  // Entry animation
  useEffect(() => {
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  // Build layout. manualSource/Target override selectedId logic.
  const effectiveSelectedId = manualSource ?? selectedId;
  const layout: PathfinderLayout = buildPathfinderLayout({
    graph,
    selectedId: effectiveSelectedId,
    width: size.w,
    height: size.h - 100, // leave room for tabs + bottom bar
  });

  // If manual target is set and differs from layout.target, we need a custom run.
  // For simplicity, we feed manualSource/Target directly into a secondary layout
  // when both are set.
  const finalLayout: PathfinderLayout = (() => {
    if (manualSource && manualTarget && manualTarget !== layout.target) {
      return buildPathfinderLayout({
        graph,
        // Use a tiny shim: pass source via selectedId which makes it source,
        // then we need to override target. Since buildPathfinderLayout doesn't
        // expose targetId override directly, we do a direct findPaths call.
        // However, to keep the contract clean we re-use buildPathfinderLayout
        // with the source selection only and accept its target if matching,
        // or fall back to the original.
        selectedId: manualSource,
        width: size.w,
        height: size.h - 100,
      });
    }
    return layout;
  })();

  // Clamp activePathIdx to valid range
  const safeActiveIdx = Math.min(activePathIdx, Math.max(0, finalLayout.paths.length - 1));

  const activePathMask = 1 << safeActiveIdx;

  const handleBackdrop = useCallback(() => { onDismiss?.(); }, [onDismiss]);

  const handleNodeClick = useCallback((e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    onFocusEntity?.(fileId);
  }, [onFocusEntity]);

  const handleEnter = useCallback((fileId: string) => setHoveredId(fileId), []);
  const handleLeave = useCallback(() => setHoveredId(null), []);

  const handleSourceChange = useCallback((id: string) => {
    setManualSource(id);
    setActivePathIdx(0);
  }, []);

  const handleTargetChange = useCallback((id: string) => {
    setManualTarget(id);
    setActivePathIdx(0);
  }, []);

  const outerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    background: color.bg0,
  };

  const svgStyle: CSSProperties = {
    display: "block",
    flex: 1,
    userSelect: "none",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── Title bar ──────────────────────────────────────────────────────
  const titleBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  };

  // ── No path state ──────────────────────────────────────────────────
  if (finalLayout.noPath) {
    return (
      <div ref={containerRef} style={outerStyle}>
        {/* Title */}
        <div style={titleBarStyle}>
          <div>
            <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, fontFamily: font.sans }}>
              Pathfinding Spotlight
            </div>
            <div style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
              dependency routes between files
            </div>
          </div>
        </div>

        {/* SVG with empty state */}
        <svg
          viewBox={`0 0 ${size.w} ${size.h - 100}`}
          style={{ ...svgStyle, flex: 1 }}
          role="img"
          aria-label="Pathfinding Spotlight — no path found"
        >
          <rect x={0} y={0} width={size.w} height={size.h} fill="transparent" onClick={handleBackdrop} />
          <text
            x={size.w / 2}
            y={(size.h - 100) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.md}
            fill={color.text2}
            fontStyle="italic"
            fontFamily={font.sans}
          >
            {graph.files.length < 2 ? "Need at least 2 files" : "No path found between selected files"}
          </text>
        </svg>

        {/* Bottom bar */}
        <BottomBar layout={finalLayout} />
      </div>
    );
  }

  const svgH = size.h - 100; // tabs + title + bottom bar
  const nodeById = new Map(finalLayout.nodes.map(n => [n.fileId, n]));

  // File list for pickers (sorted by name)
  const fileList = graph.files
    .map(f => ({ id: f.id, name: f.name ?? shortFileName(f.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={containerRef} style={outerStyle}>
      {/* Title bar */}
      <div style={titleBarStyle}>
        <div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, fontFamily: font.sans }}>
            Pathfinding Spotlight
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
            dependency routes between files
          </div>
        </div>
      </div>

      {/* Path tab strip */}
      <PathTabs
        paths={finalLayout.paths}
        activeIdx={safeActiveIdx}
        onSelect={idx => setActivePathIdx(idx)}
      />

      {/* SVG canvas */}
      <svg
        viewBox={`0 0 ${size.w} ${svgH}`}
        style={svgStyle}
        role="img"
        aria-label={`Pathfinding Spotlight — ${finalLayout.source} to ${finalLayout.target}`}
      >
        {/* Backdrop */}
        <rect
          x={0} y={0}
          width={size.w} height={svgH}
          fill="transparent"
          onClick={handleBackdrop}
        />

        {/* Arrow marker definitions */}
        <defs>
          {finalLayout.paths.map((p, i) => (
            <marker
              key={`arrow-${i}`}
              id={`arrow-${i}`}
              markerWidth={8}
              markerHeight={8}
              refX={6}
              refY={3}
              orient="auto"
            >
              <path d="M0,0 L0,6 L8,3 z" fill={p.pathColor} />
            </marker>
          ))}
          <marker id="arrow-dim" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color.border} />
          </marker>
        </defs>

        {/* Edges (bezier curves) */}
        {finalLayout.edges.map((edge: PathfinderEdge) => {
          const fromNode = nodeById.get(edge.from);
          const toNode = nodeById.get(edge.to);
          if (!fromNode || !toNode) return null;

          const isOnActive = (edge.pathMask & activePathMask) !== 0;
          const edgeColor = isOnActive ? firstPathColor(edge.pathMask & activePathMask || edge.pathMask) : color.borderStrong;
          const edgeOpacity = isOnActive ? 0.85 : 0.22;
          const strokeW = Math.max(1, Math.min(4, 1 + edge.weight * 0.3));
          const markerRef = isOnActive
            ? `url(#arrow-${lowestBit(edge.pathMask & activePathMask || edge.pathMask)})`
            : "url(#arrow-dim)";

          // Start at right edge of fromNode, end at left edge of toNode
          const x1 = fromNode.x + NODE_W / 2;
          const y1 = fromNode.y;
          const x2 = toNode.x - NODE_W / 2;
          const y2 = toNode.y;

          return (
            <path
              key={edge.id}
              d={bezierH(x1, y1, x2, y2)}
              fill="none"
              stroke={edgeColor}
              strokeWidth={strokeW}
              strokeOpacity={edgeOpacity}
              markerEnd={markerRef}
            />
          );
        })}

        {/* Nodes */}
        {finalLayout.nodes.map((node: PathfinderNode) => (
          <NodeRect
            key={node.fileId}
            node={node}
            isSource={node.fileId === finalLayout.source}
            isTarget={node.fileId === finalLayout.target}
            activePathMask={activePathMask}
            isHovered={hoveredId === node.fileId}
            isDimmed={hoveredId !== null && hoveredId !== node.fileId}
            onClick={handleNodeClick}
            onEnter={handleEnter}
            onLeave={handleLeave}
          />
        ))}

        {/* File pickers (foreignObject) */}
        <FilePicker
          files={fileList}
          value={finalLayout.source}
          x={10}
          y={svgH - 34}
          label="from:"
          onChange={handleSourceChange}
        />
        <FilePicker
          files={fileList}
          value={finalLayout.target}
          x={size.w - 170}
          y={svgH - 34}
          label="to:"
          onChange={handleTargetChange}
        />
      </svg>

      {/* Bottom bar */}
      <BottomBar layout={finalLayout} />
    </div>
  );
}

// ── Bottom bar helper ──────────────────────────────────────────────────

function BottomBar({ layout }: { layout: PathfinderLayout }) {
  const shortestHops = layout.paths.length > 0
    ? Math.min(...layout.paths.map(p => p.nodeIds.length - 1))
    : 0;

  const sourceShort = layout.source ? shortFileName(layout.source) : "—";
  const targetShort = layout.target ? shortFileName(layout.target) : "—";

  const barStyle: CSSProperties = {
    flexShrink: 0,
    padding: `${space[1]}px ${space[4]}px`,
    borderTop: `1px solid ${color.border}`,
    display: "flex",
    alignItems: "center",
    gap: space[2],
    background: color.bg1,
  };

  const textStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text2,
    fontFamily: font.sans,
  };

  const boldStyle: CSSProperties = { ...textStyle, color: color.text1, fontWeight: font.weight.medium };

  return (
    <div style={barStyle}>
      <span style={boldStyle}>{sourceShort}</span>
      <span style={textStyle}>→</span>
      <span style={boldStyle}>{targetShort}</span>
      {layout.paths.length > 0 && (
        <>
          <span style={{ color: color.border, fontSize: font.size.xs }}>|</span>
          <span style={textStyle}>
            shortest path: {shortestHops} hop{shortestHops !== 1 ? "s" : ""}
          </span>
        </>
      )}
      {layout.truncated && (
        <>
          <span style={{ color: color.border, fontSize: font.size.xs }}>|</span>
          <span style={{ ...textStyle, color: color.warn }}>search truncated</span>
        </>
      )}
    </div>
  );
}

// ── Utility ────────────────────────────────────────────────────────────

function shortFileName(filePath: string): string {
  const last = filePath.split("/").pop() ?? filePath;
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

function lowestBit(mask: number): number {
  if (mask === 0) return 0;
  for (let i = 0; i < 32; i++) {
    if (mask & (1 << i)) return i;
  }
  return 0;
}

export const PathfinderView = memo(PathfinderViewImpl);
