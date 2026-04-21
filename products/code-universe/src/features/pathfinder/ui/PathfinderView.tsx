// PathfinderView.tsx
// ---------------------------------------------------------------
// SVG renderer for the "Pathfinding Spotlight" view — LEGENDARY quality.
//
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │  Header: "Pathfinding Spotlight" + dismiss   │
//   │  Path tabs  (Path 1 · N hops | Path 2 …)    │
//   │  ─────────────────────────────────────────   │
//   │  SVG canvas:                                 │
//   │    SOURCE ──bezier──> [nodes] ──> TARGET     │
//   │    inactive paths at 0.18 opacity, dashed    │
//   │  ─────────────────────────────────────────   │
//   │  Bottom bar: source → target | N hops | cost │
//   └──────────────────────────────────────────────┘
//
// Animation:
//   - Container fadeUp 250ms on mount
//   - Active path draws itself via stroke-dashoffset 800ms ease-out
//   - After 850ms: continuous data-packet traveler on active path
//   - Nodes appear with 40ms per-node stagger
//   - Node ping ripple on simulated packet arrival
//   - Ghost paths get animated dashes (slow reverse scroll)
//
// Interaction:
//   - Path tab click: highlight that path (others ghost)
//   - Node click: onFocusEntity(fileId)
//   - Source / target dropdowns: rebuild layout on selection change
//   - Backdrop click: onDismiss
//   - Source node hover: intensified glow

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
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

const PATH_ANIM_MS = 800;
const ANIM_DONE_DELAY = 850;
const STAGGER_MS = 40;
const NODE_W = 100;
const NODE_H = 32;
const MAX_LABEL_CHARS = 12;
const PATH_COLORS = ["#0d99ff", "#7e4ed6", "#22a06b"] as const;

// ── Keyframe injection ─────────────────────────────────────────────────

let _pfStylesInjected = false;
function injectPfStyles(): void {
  if (_pfStylesInjected || typeof document === "undefined") return;
  _pfStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pf-ping {
      0%   { r: var(--ping-r0); opacity: 0.8; }
      100% { r: var(--ping-r1); opacity: 0; }
    }
    @keyframes pf-ghostDash {
      to { stroke-dashoffset: -32; }
    }
  `;
  document.head.appendChild(style);
}

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

function lowestBit(mask: number): number {
  if (mask === 0) return 0;
  for (let i = 0; i < 32; i++) {
    if (mask & (1 << i)) return i;
  }
  return 0;
}

function shortFileName(filePath: string): string {
  const last = filePath.split("/").pop() ?? filePath;
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

/** Cubic bezier path string from (x1,y1) to (x2,y2) with horizontal control points */
function bezierH(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ── Path animation hook ────────────────────────────────────────────────

interface AnimatedPathProps {
  d: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  markerEnd: string;
  isActive: boolean;
  isGhost: boolean;
  svgId?: string;
}

function AnimatedPath({ d, stroke, strokeWidth, strokeOpacity, markerEnd, isActive, isGhost, svgId }: AnimatedPathProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [dashState, setDashState] = useState<{ array: string; offset: number } | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDashState(null);
      return;
    }
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    // Start with full offset (hidden), then animate to 0
    setDashState({ array: `${len}`, offset: len });
    let start: number | null = null;
    let rafId = 0;
    const animate = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / PATH_ANIM_MS, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDashState({ array: `${len}`, offset: len * (1 - eased) });
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, d]);

  const dashArray = isGhost ? "6 10" : (dashState?.array ?? "none");
  const dashOffset = isGhost ? undefined : (dashState?.offset ?? 0);

  const ghostAnimStyle: CSSProperties | undefined = isGhost ? {
    animation: "pf-ghostDash 3s linear infinite",
  } : undefined;

  return (
    <path
      ref={pathRef}
      id={svgId}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeDasharray={dashArray}
      strokeDashoffset={dashOffset}
      markerEnd={isGhost ? undefined : markerEnd}
      style={ghostAnimStyle}
    />
  );
}

// ── Data packet traveler ───────────────────────────────────────────────

interface PacketTravelerProps {
  pathId: string;
  pathColor: string;
  durationS: number;
  animDone: boolean;
  packetIndex: number;
}

function PacketTraveler({ pathId, pathColor, durationS, animDone, packetIndex }: PacketTravelerProps) {
  // Stagger multiple packets slightly
  const offset = (packetIndex * 0.4) % 1;
  const beginStr = animDone ? `${(offset * durationS).toFixed(2)}s` : "indefinite";

  return (
    <circle
      r={5}
      fill={pathColor}
      style={{ filter: `drop-shadow(0 0 4px ${pathColor})` }}
    >
      <animateMotion
        dur={`${durationS.toFixed(2)}s`}
        repeatCount="indefinite"
        begin={beginStr}
        rotate="auto"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

// ── Node ping ripple ───────────────────────────────────────────────────

interface PingRippleProps {
  cx: number;
  cy: number;
  pingKey: number;
  pathColor: string;
}

function PingRipple({ cx, cy, pingKey, pathColor }: PingRippleProps) {
  const r0 = NODE_W / 2;

  return (
    <circle
      key={pingKey}
      cx={cx}
      cy={cy}
      r={r0}
      fill="none"
      stroke={pathColor}
      strokeWidth={2}
      style={{
        animation: "pf-ping 600ms ease-out both",
        animationDuration: "600ms",
        animationFillMode: "both",
        // Use transform scale from origin for the expanding ring effect
        transformOrigin: `${cx}px ${cy}px`,
      }}
    />
  );
}

// ── Hop badge on edges ─────────────────────────────────────────────────

interface HopBadgeProps {
  x: number;
  y: number;
  hop: number;
}

function HopBadge({ x, y, hop }: HopBadgeProps) {
  const r = 8;
  return (
    <g>
      <circle
        cx={x} cy={y} r={r}
        fill={color.bg2}
        stroke={color.border}
        strokeWidth={1}
      />
      <text
        x={x} y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={font.size.xxs}
        fill={color.text2}
        fontFamily={font.sans}
      >
        {hop}
      </text>
    </g>
  );
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
        const pathColor = PATH_COLORS[i] ?? color.border;
        const tabStyle: CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: space[1],
          padding: `${space[1]}px ${space[3]}px`,
          borderRadius: `${radius.sm}px ${radius.sm}px 0 0`,
          border: `1px solid ${isActive ? pathColor : color.border}`,
          borderBottom: isActive ? `2px solid ${pathColor}` : `1px solid ${color.border}`,
          background: isActive ? `${pathColor}1a` : color.bg1,
          color: isActive ? pathColor : color.text2,
          fontSize: font.size.xs,
          fontFamily: font.sans,
          fontWeight: isActive ? font.weight.semibold : font.weight.regular,
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: `all ${transition.fast}`,
          userSelect: "none",
          outline: "none",
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
                background: pathColor,
                flexShrink: 0,
              }}
            />
            Path {i + 1}
            <span style={{ color: isActive ? pathColor : color.text3, fontSize: font.size.xxs }}>
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
  staggerIdx: number;
  mounted: boolean;
  onClick: (e: React.MouseEvent, fileId: string) => void;
  onEnter: (fileId: string) => void;
  onLeave: () => void;
  hoveredId: string | null;
}

function NodeRect({
  node, isSource, isTarget, activePathMask, isHovered, isDimmed,
  staggerIdx, mounted, onClick, onEnter, onLeave, hoveredId,
}: NodeRectProps) {
  const isOnActivePath = (node.pathMask & activePathMask) !== 0;

  // Staggered entry: nodes appear with a delay based on their position
  const staggerDelay = staggerIdx * STAGGER_MS;
  const nodeOpacityBase = isDimmed ? 0.25 : isOnActivePath ? 1 : 0.45;
  const opacity = mounted ? nodeOpacityBase : 0;

  const nodeColor = firstPathColor(node.pathMask & activePathMask || node.pathMask);

  const borderColor = isSource
    ? "#0d99ff"
    : isTarget
    ? "#ef4444"
    : isHovered
    ? nodeColor
    : color.border;

  const bgColor = isSource
    ? "rgba(13,153,255,0.15)"
    : isTarget
    ? "rgba(239,68,68,0.15)"
    : isOnActivePath
    ? `${nodeColor}14`
    : color.bg1;

  const strokeWidth = isSource || isTarget ? 2.5 : isHovered ? 1.5 : 1;

  // Source node gets intensified glow on hover
  const normalSourceGlow = "drop-shadow(0 0 6px rgba(13,153,255,0.55))";
  const intensifiedSourceGlow = "drop-shadow(0 0 12px rgba(13,153,255,0.8))";
  const glowFilter = isSource
    ? (hoveredId === node.fileId ? intensifiedSourceGlow : normalSourceGlow)
    : isTarget
    ? "drop-shadow(0 0 6px rgba(239,68,68,0.55))"
    : undefined;

  const x = node.x - NODE_W / 2;
  const y = node.y - NODE_H / 2;

  const gStyle: CSSProperties = {
    cursor: "pointer",
    opacity,
    transition: `opacity ${STAGGER_MS * 2}ms ease-out ${staggerDelay}ms`,
    filter: glowFilter,
  };

  return (
    <g
      style={gStyle}
      onClick={e => onClick(e, node.fileId)}
      onMouseEnter={() => onEnter(node.fileId)}
      onMouseLeave={onLeave}
    >
      {/* SOURCE / TARGET label above the rect */}
      {isSource && (
        <text
          x={node.x}
          y={y - 8}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={font.size.xs}
          fontWeight={font.weight.semibold}
          fill="#0d99ff"
          fontFamily={font.sans}
          letterSpacing={0.5}
        >
          SOURCE
        </text>
      )}
      {isTarget && (
        <text
          x={node.x}
          y={y - 8}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={font.size.xs}
          fontWeight={font.weight.semibold}
          fill="#ef4444"
          fontFamily={font.sans}
          letterSpacing={0.5}
        >
          TARGET
        </text>
      )}

      {/* Rect background */}
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={radius.sm}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={strokeWidth}
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
  const pickerW = 170;
  const pickerH = 26;

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontFamily: font.sans,
  };

  const labelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: color.text2,
    fontFamily: font.sans,
    whiteSpace: "nowrap",
    fontWeight: font.weight.medium,
  };

  const selectStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text0,
    background: color.bg2,
    border: `1px solid ${color.border}`,
    borderRadius: `${radius.sm}px`,
    padding: `2px ${space[1]}px`,
    cursor: "pointer",
    fontFamily: font.sans,
    height: pickerH,
    maxWidth: pickerW - 40,
    outline: "none",
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

// ── No-path empty state ────────────────────────────────────────────────

function NoPathEmptyState({ svgW, svgH }: { svgW: number; svgH: number }) {
  const cx = svgW / 2;
  const cy = svgH / 2;
  return (
    <g>
      {/* Broken link icon — two chain segments separated */}
      <g transform={`translate(${cx - 30}, ${cy - 60})`}>
        {/* Left link */}
        <rect x={0} y={8} width={20} height={8} rx={4} fill="none" stroke={color.text3} strokeWidth={2} />
        <line x1={20} y1={12} x2={24} y2={12} stroke={color.text3} strokeWidth={2} strokeDasharray="2 2" />
        {/* Right link */}
        <rect x={36} y={8} width={20} height={8} rx={4} fill="none" stroke={color.text3} strokeWidth={2} />
        <line x1={36} y1={12} x2={32} y2={12} stroke={color.text3} strokeWidth={2} strokeDasharray="2 2" />
        {/* Break marks */}
        <line x1={27} y1={6} x2={29} y2={18} stroke={color.text3} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={31} y1={6} x2={33} y2={18} stroke={color.text3} strokeWidth={1.5} strokeLinecap="round" />
      </g>
      <text
        x={cx} y={cy - 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={font.size.md}
        fontWeight={font.weight.semibold}
        fill={color.text1}
        fontFamily={font.sans}
      >
        No path found
      </text>
      <text
        x={cx} y={cy + 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={font.size.xs}
        fill={color.text2}
        fontFamily={font.sans}
      >
        Select different source / target files
      </text>
    </g>
  );
}

// ── Bottom bar helper ──────────────────────────────────────────────────

function BottomBar({ layout, activeIdx }: { layout: PathfinderLayout; activeIdx: number }) {
  const activePath = layout.paths[activeIdx];
  const hops = activePath ? activePath.nodeIds.length - 1 : 0;
  const cost = activePath ? activePath.cost : 0;

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

  const boldStyle: CSSProperties = {
    ...textStyle,
    color: color.text1,
    fontWeight: font.weight.medium,
  };

  const monoStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text1,
    fontFamily: font.mono,
    fontWeight: font.weight.medium,
  };

  const sepStyle: CSSProperties = {
    color: color.border,
    fontSize: font.size.xs,
  };

  return (
    <div style={barStyle}>
      <span style={boldStyle}>{sourceShort}</span>
      <span style={textStyle}>→</span>
      <span style={boldStyle}>{targetShort}</span>
      {layout.paths.length > 0 && (
        <>
          <span style={sepStyle}>|</span>
          <span style={textStyle}>
            <span style={monoStyle}>{hops}</span>
            {" "}hop{hops !== 1 ? "s" : ""}
          </span>
          <span style={sepStyle}>|</span>
          <span style={textStyle}>
            cost:{" "}
            <span style={monoStyle}>{cost.toFixed(1)}</span>
          </span>
        </>
      )}
      {layout.truncated && (
        <>
          <span style={sepStyle}>|</span>
          <span style={{ ...textStyle, color: color.warn }}>search truncated</span>
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

function PathfinderViewImpl({ graph, selectedId, onFocusEntity, onDismiss }: PathfinderViewProps) {
  const [mounted, setMounted] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [activePathIdx, setActivePathIdx] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pingState, setPingState] = useState<{ nodeId: string; key: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 680, h: 460 });

  // Manual source/target overrides
  const [manualSource, setManualSource] = useState<string | undefined>(undefined);
  const [manualTarget, setManualTarget] = useState<string | undefined>(undefined);

  // Inject CSS keyframes once
  useEffect(() => {
    injectPfStyles();
  }, []);

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

  // Entry animation — fadeUp: first frame opacity 0 translate Y+8, second frame animate to final
  useEffect(() => {
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  // animDone fires 850ms after mount — enables packet travelers
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setAnimDone(true), ANIM_DONE_DELAY);
    return () => clearTimeout(t);
  }, [mounted]);

  // Reset animDone when active path changes (re-trigger after new draw animation)
  useEffect(() => {
    setAnimDone(false);
    const t = setTimeout(() => setAnimDone(true), ANIM_DONE_DELAY);
    return () => clearTimeout(t);
  }, [activePathIdx]);

  // Build layout
  const effectiveSelectedId = manualSource ?? selectedId;
  const layout: PathfinderLayout = buildPathfinderLayout({
    graph,
    selectedId: effectiveSelectedId,
    width: size.w,
    height: size.h - 110,
  });

  const finalLayout: PathfinderLayout = (() => {
    if (manualSource && manualTarget && manualTarget !== layout.target) {
      return buildPathfinderLayout({
        graph,
        selectedId: manualSource,
        width: size.w,
        height: size.h - 110,
      });
    }
    return layout;
  })();

  // Clamp activePathIdx to valid range
  const safeActiveIdx = Math.min(activePathIdx, Math.max(0, finalLayout.paths.length - 1));
  const activePathMask = 1 << safeActiveIdx;
  const activePath = finalLayout.paths[safeActiveIdx];

  // Node ping interval — cycle through active path nodes
  useEffect(() => {
    if (!animDone || !activePath) return;
    const nodeCount = activePath.nodeIds.length;
    if (nodeCount < 2) return;

    const hops = nodeCount - 1;
    const durationMs = (1.5 + hops * 0.4) * 1000;
    const intervalMs = durationMs / nodeCount;

    let pingIdx = 0;
    let pingKey = 0;
    const nodeIds = activePath.nodeIds;

    const tick = () => {
      const nodeId = nodeIds[pingIdx];
      if (nodeId) {
        setPingState({ nodeId, key: pingKey++ });
      }
      pingIdx = (pingIdx + 1) % nodeCount;
    };

    tick(); // fire immediately
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [animDone, activePath, safeActiveIdx]);

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

  // Container: fadeUp on mount
  const outerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    background: color.bg0,
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 250ms ease-out, transform 250ms ease-out",
  };

  const svgStyle: CSSProperties = {
    display: "block",
    flex: 1,
    userSelect: "none",
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

  const dismissBtnStyle: CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: `${space[1]}px`,
    color: color.text2,
    fontSize: font.size.md,
    fontFamily: font.sans,
    lineHeight: 1,
    borderRadius: `${radius.sm}px`,
    transition: `color ${transition.fast}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const TitleBar = (
    <div style={titleBarStyle}>
      <div>
        <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, fontFamily: font.sans }}>
          Pathfinding Spotlight
        </div>
        <div style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
          dependency routes between files
        </div>
      </div>
      {onDismiss && (
        <button type="button" style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );

  // ── No path state ──────────────────────────────────────────────────
  if (finalLayout.noPath) {
    const svgH = size.h - 110;
    return (
      <div ref={containerRef} style={outerStyle}>
        {TitleBar}
        <svg
          viewBox={`0 0 ${size.w} ${svgH}`}
          style={svgStyle}
          role="img"
          aria-label="Pathfinding Spotlight — no path found"
        >
          <rect x={0} y={0} width={size.w} height={svgH} fill="transparent" onClick={handleBackdrop} />
          <NoPathEmptyState svgW={size.w} svgH={svgH} />
        </svg>
        <BottomBar layout={finalLayout} activeIdx={0} />
      </div>
    );
  }

  const svgH = size.h - 110;
  const nodeById = new Map(finalLayout.nodes.map(n => [n.fileId, n]));

  // File list for pickers (sorted by name)
  const fileList = graph.files
    .map(f => ({ id: f.id, name: f.name ?? shortFileName(f.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Sorted nodes for stagger: source first, then by x position
  const sortedNodeIds = [...finalLayout.nodes]
    .sort((a, b) => a.x - b.x)
    .map(n => n.fileId);

  // Determine packet paths: build combined path strings for active path edges
  // We use per-path active path IDs for animateMotion
  const activePacketPathIds: Array<{ pathId: string; pathColor: string; durationS: number }> = [];
  if (activePath) {
    const hops = activePath.nodeIds.length - 1;
    const durationS = 1.5 + hops * 0.4;
    activePacketPathIds.push({
      pathId: `active-path-0`,
      pathColor: PATH_COLORS[safeActiveIdx] ?? "#0d99ff",
      durationS,
    });
  }

  return (
    <div ref={containerRef} style={outerStyle}>
      {/* Title bar */}
      {TitleBar}

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
        <rect x={0} y={0} width={size.w} height={svgH} fill="transparent" onClick={handleBackdrop} />

        {/* Arrow marker definitions — one per active path */}
        <defs>
          {finalLayout.paths.map((_, i) => {
            const markerColor = PATH_COLORS[i] ?? color.border;
            return (
              <marker
                key={`arrow-${i}`}
                id={`arrow-${i}`}
                markerWidth={8}
                markerHeight={8}
                refX={6}
                refY={3}
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill={markerColor} />
              </marker>
            );
          })}
        </defs>

        {/* Edges */}
        {finalLayout.edges.map((edge: PathfinderEdge, edgeRenderIdx: number) => {
          const fromNode = nodeById.get(edge.from);
          const toNode = nodeById.get(edge.to);
          if (!fromNode || !toNode) return null;

          const isOnActive = (edge.pathMask & activePathMask) !== 0;
          const edgeColor = isOnActive
            ? firstPathColor(edge.pathMask & activePathMask || edge.pathMask)
            : color.borderStrong;
          const strokeW = isOnActive ? Math.max(1, Math.min(3.5, 1.2 + edge.weight * 0.25)) : 1;
          const markerRef = isOnActive
            ? `url(#arrow-${lowestBit(edge.pathMask & activePathMask || edge.pathMask)})`
            : "none";

          // Edge endpoints: right edge of fromNode → left edge of toNode
          const x1 = fromNode.x + NODE_W / 2;
          const y1 = fromNode.y;
          const x2 = toNode.x - NODE_W / 2;
          const y2 = toNode.y;
          const pathD = bezierH(x1, y1, x2, y2);

          // Hop badge at midpoint
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          // Determine hop index for this edge in the active path
          let hopNum: number | null = null;
          if (isOnActive && activePath) {
            const edgeIdx = activePath.edgeIds.indexOf(edge.id);
            if (edgeIdx >= 0) hopNum = edgeIdx + 1;
          }

          // Assign a unique SVG id to the first active path edge for animateMotion
          // We use the concatenated bezier of all active-path edges for the packet
          // For simplicity: assign id to first active edge segment only
          const isFirstActiveEdge = isOnActive && activePath && activePath.edgeIds[0] === edge.id;
          const svgPathId = isFirstActiveEdge ? `active-path-0` : undefined;

          return (
            <g key={`${edge.id}-${edgeRenderIdx}`}>
              <AnimatedPath
                d={pathD}
                stroke={edgeColor}
                strokeWidth={strokeW}
                strokeOpacity={isOnActive ? 0.85 : 0.18}
                markerEnd={markerRef}
                isActive={isOnActive}
                isGhost={!isOnActive}
                svgId={svgPathId}
              />
              {isOnActive && hopNum !== null && (
                <HopBadge x={midX} y={midY} hop={hopNum} />
              )}
            </g>
          );
        })}

        {/* Packet travelers (rendered after edges so they appear on top) */}
        {activePacketPathIds.map(({ pathId, pathColor, durationS }, idx) => (
          <PacketTraveler
            key={`packet-${idx}-${safeActiveIdx}`}
            pathId={pathId}
            pathColor={pathColor}
            durationS={durationS}
            animDone={animDone}
            packetIndex={idx}
          />
        ))}

        {/* Node ping ripple */}
        {pingState && (() => {
          const pingedNode = nodeById.get(pingState.nodeId);
          if (!pingedNode) return null;
          const pathColor = PATH_COLORS[safeActiveIdx] ?? "#0d99ff";
          return (
            <PingRipple
              key={`ping-${pingState.key}`}
              cx={pingedNode.x}
              cy={pingedNode.y}
              pingKey={pingState.key}
              pathColor={pathColor}
            />
          );
        })()}

        {/* Nodes with stagger animation */}
        {finalLayout.nodes.map((node: PathfinderNode) => {
          const staggerIdx = sortedNodeIds.indexOf(node.fileId);
          return (
            <NodeRect
              key={node.fileId}
              node={node}
              isSource={node.fileId === finalLayout.source}
              isTarget={node.fileId === finalLayout.target}
              activePathMask={activePathMask}
              isHovered={hoveredId === node.fileId}
              isDimmed={hoveredId !== null && hoveredId !== node.fileId}
              staggerIdx={staggerIdx}
              mounted={mounted}
              onClick={handleNodeClick}
              onEnter={handleEnter}
              onLeave={handleLeave}
              hoveredId={hoveredId}
            />
          );
        })}

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
          x={size.w - 178}
          y={svgH - 34}
          label="to:"
          onChange={handleTargetChange}
        />
      </svg>

      {/* Bottom bar */}
      <BottomBar layout={finalLayout} activeIdx={safeActiveIdx} />
    </div>
  );
}

export const PathfinderView = memo(PathfinderViewImpl);
