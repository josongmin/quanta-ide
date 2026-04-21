// NeighborhoodView.tsx
// ---------------------------------------------------------------
// Radial hierarchy:
//   Ring 1 (r≈160): package hub nodes — one per directory
//   Ring 2 (r≈320): individual files, fanned in their package's sector
//
// Edges:
//   Tree edges (center→pkg, pkg→file) — thin dashed grey
//   Dependency edges (file↔file)      — colored by severity
//
// Interaction:
//   Wheel     → zoom toward cursor (non-passive, preventDefault)
//   Drag      → pan (>4px moved disables click-to-dismiss)
//   Dbl-click → reset zoom/pan
//   Click pkg hub → re-center on first member file
//   Click file    → re-center diagram on that file
//
// Viewport & LOD:
//   Culling drops nodes/edges outside the visible layout-space rect
//   (+margin) so 100+ file halos don't hairball. LOD tiers collapse
//   the outer ring at low zoom and fade dep edges until zoomed in
//   enough to read individual files.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { buildNeighborhoodLayout } from "../model/build-neighborhood-layout";
import type { NeighborhoodEdge, NeighborhoodLayout, NeighborhoodNode } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { useSelectedSymbol } from "../../../shared/api/selected-symbol";

export interface NeighborhoodViewProps {
  graph: WorkspaceGraph;
  selectedId?: string;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Simulation ────────────────────────────────────────────────────────

interface SimNode {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  targetX: number; targetY: number;
  isCenter: boolean;
}

const SIM_FRAMES = 80;

function useSpringSimulation(nodes: NeighborhoodNode[], simKey: number) {
  const [pos, setPos]         = useState<Map<string, { x: number; y: number }>>(() => new Map());
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!nodes.length) { setPos(new Map()); setSettled(true); return; }
    setSettled(false);

    const sims: SimNode[] = nodes.map(n => ({
      id: n.fileId,
      x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      targetX: n.x, targetY: n.y,
      isCenter: n.hop === 0,
    }));

    let frame = 0, raf = 0;
    function tick() {
      if (frame >= SIM_FRAMES) {
        const m = new Map<string, { x: number; y: number }>();
        for (const s of sims) m.set(s.id, { x: s.targetX, y: s.targetY });
        setPos(m); setSettled(true); return;
      }
      frame++;
      for (let i = 0; i < sims.length; i++) {
        const s = sims[i]!;
        const k = s.isCenter ? 0.22 : 0.13;
        let fx = (s.targetX - s.x) * k;
        let fy = (s.targetY - s.y) * k;
        for (let j = 0; j < sims.length; j++) {
          if (i === j) continue;
          const o = sims[j]!;
          const dx = s.x - o.x, dy = s.y - o.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0 && d < 60) {
            const rep = 30 / d * 0.02 * (s.isCenter ? 0.4 : 1);
            fx += dx / d * rep; fy += dy / d * rep;
          }
        }
        s.vx = (s.vx + fx) * 0.84; s.vy = (s.vy + fy) * 0.84;
        s.x += s.vx; s.y += s.vy;
      }
      const snap = new Map<string, { x: number; y: number }>();
      for (const s of sims) snap.set(s.id, { x: s.x, y: s.y });
      setPos(new Map(snap));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey]);

  return { pos, settled };
}

// ── Zoom / pan ────────────────────────────────────────────────────────
interface ZP { scale: number; tx: number; ty: number }
const ZP_INIT: ZP = { scale: 1, tx: 0, ty: 0 };
function clampScale(s: number): number { return Math.max(0.18, Math.min(5, s)); }

// ── LOD thresholds ────────────────────────────────────────────────────
// Below LOD_FILES: hide file ring entirely — user is reading the sector
// shape, not individual files. Below LOD_DEPS: hide dep edges (they're
// only legible once each endpoint is ~8px on screen, which is roughly
// scale=0.7 given FILE_R_BASE=7). Above LOD_FULL_LABEL: stop truncating
// filenames — there's room to show the real name.
const LOD_FILES      = 0.42;
const LOD_DEPS       = 0.72;
const LOD_FULL_LABEL = 1.35;

// Extra margin (px, layout-space) when testing node visibility so a
// node's label stays painted when its centre is just past the edge.
const CULL_MARGIN = 36;

// ── Helpers ────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Readonly<Record<string, string>> = {
  critical: "#e5484d", high: "#e09321", medium: "#0d99ff", low: "#22a06b",
};

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function depStroke(severity: string | undefined): string {
  return severity ? (SEVERITY_COLOR[severity] ?? color.border) : color.border;
}

function riskFill(r: number): string {
  return `hsl(${120 - r * 120}deg, 65%, 50%)`;
}

// ── Package hub glyph ─────────────────────────────────────────────────

function PackageHub({ node, isHovered, isDimmed, sx, sy, settled, onClick, onEnter, onLeave, fullLabel }: {
  node: NeighborhoodNode;
  isHovered: boolean; isDimmed: boolean;
  sx: number; sy: number; settled: boolean;
  onClick: (e: React.MouseEvent, id: string) => void;
  onEnter: (id: string) => void; onLeave: () => void;
  fullLabel: boolean;
}) {
  const r    = node.radius;
  const fill = riskFill(node.riskScore);

  const style: CSSProperties = {
    cursor: "pointer",
    transform: `translate(${sx}px, ${sy}px)`,
    opacity: isDimmed ? 0.18 : isHovered ? 1 : 0.88,
    transition: settled ? "transform 0ms, opacity 150ms" : undefined,
  };

  return (
    <g style={style}
      onClick={e => onClick(e, node.fileId)}
      onMouseEnter={() => onEnter(node.fileId)}
      onMouseLeave={onLeave}
    >
      {isHovered && (
        <circle cx={0} cy={0} r={r + 6} fill="none"
          stroke={fill} strokeWidth={1.5} strokeOpacity={0.35}
          style={{ animation: "nh-pulse 1.6s ease-out infinite" }}
        />
      )}
      {/* Hexagon-ish: circle with dashed ring to signal "group" */}
      <circle cx={0} cy={0} r={r}
        fill={fill} fillOpacity={isHovered ? 0.22 : 0.12}
        stroke={fill} strokeWidth={isHovered ? 2.5 : 2}
      />
      {/* Inner solid fill ring */}
      <circle cx={0} cy={0} r={r * 0.55}
        fill={fill} fillOpacity={isHovered ? 0.55 : 0.35}
        stroke="none"
      />
      {/* ⬡ icon */}
      <text x={0} y={0}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fill="white" fontFamily={font.sans}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >⬡</text>
      {/* Package name below */}
      <text x={0} y={r + 9}
        textAnchor="middle" dominantBaseline="hanging"
        fontSize={font.size.xs} fontWeight={isHovered ? font.weight.semibold : font.weight.medium}
        fill={isHovered ? color.text0 : color.text1}
        fontFamily={font.sans}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >{fullLabel ? node.fileName : truncate(node.fileName, 12)}</text>
      {/* File count badge */}
      <text x={0} y={r + 20}
        textAnchor="middle" dominantBaseline="hanging"
        fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >{node.memberCount}개 파일</text>
    </g>
  );
}

// ── File node glyph ───────────────────────────────────────────────────

function FileNode({ node, isCenter, isHovered, isDimmed, sx, sy, settled, onClick, onEnter, onLeave, pulsing, fullLabel }: {
  node: NeighborhoodNode;
  isCenter: boolean; isHovered: boolean; isDimmed: boolean;
  sx: number; sy: number; settled: boolean;
  onClick: (e: React.MouseEvent, id: string) => void;
  onEnter: (id: string) => void; onLeave: () => void;
  pulsing: boolean;
  fullLabel: boolean;
}) {
  const r    = node.radius;
  const fill = isCenter ? "#0d99ff" : riskFill(node.riskScore);

  const style: CSSProperties = {
    cursor: "pointer",
    transform: `translate(${sx}px, ${sy}px)`,
    opacity: isDimmed ? 0.14 : isHovered ? 1 : 0.88,
    transition: settled ? "transform 0ms, opacity 150ms" : undefined,
  };

  return (
    <g style={style}
      onClick={e => onClick(e, node.fileId)}
      onMouseEnter={() => onEnter(node.fileId)}
      onMouseLeave={onLeave}
    >
      {(isCenter || isHovered) && (
        <circle cx={0} cy={0} r={r + 4} fill="none"
          stroke={isCenter ? "#0d99ff" : fill}
          strokeWidth={2} strokeOpacity={isCenter ? 0.5 : 0.35}
          style={{ animation: "nh-pulse 1.4s ease-out infinite" }}
        />
      )}
      {isCenter && (
        <circle cx={0} cy={0} r={r + 10} fill={color.accentSoft} stroke={color.accentBorder} strokeWidth={1} />
      )}
      <circle cx={0} cy={0} r={isHovered ? r + 2 : r} fill={fill}
        stroke={isHovered ? color.text0 : isCenter ? color.accent : "none"}
        strokeWidth={isHovered ? 1.5 : isCenter ? 1.5 : 0}
        style={isCenter ? { animation: "nh-breathe 2s ease-in-out infinite", filter: "drop-shadow(0 0 7px rgba(13,153,255,0.55))" } : undefined}
      />
      {isCenter ? (
        <>
          <text x={0} y={-3} textAnchor="middle" dominantBaseline="middle"
            fontSize={font.size.xs} fontWeight={font.weight.semibold} fill={color.bg0} fontFamily={font.sans}
            style={{ userSelect: "none" }}>{fullLabel ? node.fileName : truncate(node.fileName, 10)}</text>
          <text x={0} y={8} textAnchor="middle" dominantBaseline="middle"
            fontSize={font.size.xxs} fill="rgba(255,255,255,0.72)" fontFamily={font.sans}
            style={{ userSelect: "none" }}>center</text>
        </>
      ) : (
        <>
          <text x={0} y={r + 8} textAnchor="middle" dominantBaseline="hanging"
            fontSize={font.size.xs} fill={isHovered ? color.text0 : color.text1} fontFamily={font.sans}
            style={{ userSelect: "none" }}>{fullLabel ? node.fileName : truncate(node.fileName, 12)}</text>
          {node.fileHop !== undefined && (
            <text x={r * 0.7} y={-r * 0.7} textAnchor="middle" dominantBaseline="middle"
              fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}
              style={{ userSelect: "none" }}>{node.fileHop}h</text>
          )}
        </>
      )}
      {pulsing && !isCenter && (
        <circle cx={0} cy={0} r={r + 8} fill="none" stroke={fill} strokeWidth={1.5}
          style={{ animation: "nh-edgePulse 600ms ease-in-out infinite" }}
        />
      )}
    </g>
  );
}

// ── Tooltip ────────────────────────────────────────────────────────────

// Tooltip renders inside the scaled graph group, so coords are in
// layout-space. We counter-scale (1/scale) so the chip stays at a
// constant on-screen size regardless of zoom — a tooltip that grows
// to banner size at 3× zoom is nobody's friend.
function Tooltip({ node, sp, scale }: { node: NeighborhoodNode; sp: { x: number; y: number }; scale: number }) {
  const r = node.radius;
  const w = node.isPackageGroup ? 190 : 160, h = 34;
  const offsetY = r + 22 / scale;
  const text = node.isPackageGroup
    ? `${node.fileName}/ — ${node.memberCount}개 파일, 평균 위험도 ${(node.riskScore * 100).toFixed(0)}%`
    : `${node.fileName} | ${node.fileHop ?? node.hop}h | 위험도 ${(node.riskScore * 100).toFixed(0)}%`;
  return (
    <g style={{ pointerEvents: "none" }} transform={`translate(${sp.x},${sp.y + offsetY}) scale(${1 / scale})`}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={radius.sm}
        fill={color.bg3} stroke={color.border} strokeWidth={1}
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.08))" }}
      />
      <text x={0} y={-h / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={font.size.xs} fill={color.text1} fontFamily={font.sans}
      >{truncate(text, 34)}</text>
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────

function NeighborhoodViewImpl({ graph, selectedId, onFocusEntity, onDismiss }: NeighborhoodViewProps) {
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [centerId, setCenterId]       = useState<string | undefined>(selectedId);
  const [simKey, setSimKey]           = useState(0);
  const [size, setSize]               = useState({ w: 700, h: 520 });
  const svgRef                        = useRef<SVGSVGElement>(null);
  const selectedSymbolId              = useSelectedSymbol();

  useEffect(() => { setCenterId(selectedId); }, [selectedId]);

  // Symbol selection re-seeds the layout so the halo animates to the new
  // center (otherwise the spring sim keeps lerping the prior positions).
  useEffect(() => { setSimKey(k => k + 1); }, [selectedSymbolId]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new ResizeObserver(es => {
      const e = es[0]; if (!e) return;
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setMounted(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const handleReCenter = useCallback((fileId: string) => {
    setCenterId(fileId);
    onFocusEntity?.(fileId);
    setSimKey(k => k + 1);
  }, [onFocusEntity]);

  const handleNodeClick = useCallback((e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (fileId.startsWith("pkg:")) return; // package hubs don't re-center
    handleReCenter(fileId);
  }, [handleReCenter]);

  const handleEnter  = useCallback((id: string) => setHoveredId(id), []);
  const handleLeave  = useCallback(() => setHoveredId(null), []);

  // ── Zoom / pan state ───────────────────────────────────────────────
  // Re-centring resets zp so the new halo starts in view — otherwise
  // the old pan/zoom can leave the new centre off-screen.
  const [zp, setZp] = useState<ZP>(ZP_INIT);
  const [isPanning, setIsPanning] = useState(false);
  const drag = useRef({ active: false, moved: false, x0: 0, y0: 0, tx0: 0, ty0: 0 });

  useEffect(() => { setZp(ZP_INIT); }, [centerId, selectedSymbolId]);

  const handleBackdrop = useCallback(() => {
    if (drag.current.moved) return;
    onDismiss?.();
  }, [onDismiss]);

  const layout: NeighborhoodLayout = buildNeighborhoodLayout({
    graph,
    selectedId: centerId,
    selectedSymbolId,
  });

  const cx = size.w / 2;
  const cy = (size.h - 36) / 2;

  // Wheel → zoom toward cursor. Non-passive so preventDefault stops the
  // page (or the surrounding overlay) from scrolling while the user
  // zooms into the halo.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const mag   = Math.min(Math.abs(e.deltaY), 50) / 50;
      const step  = 0.04 + mag * 0.04;                       // 4%..8%
      const factor = e.deltaY < 0 ? 1 + step : 1 / (1 + step);
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setZp(prev => {
        const ns = clampScale(prev.scale * factor);
        const f  = ns / prev.scale;
        const ccx = size.w / 2;
        const ccy = (size.h - 36) / 2;
        return {
          scale: ns,
          tx: px - ccx - (px - ccx - prev.tx) * f,
          ty: py - ccy - (py - ccy - prev.ty) * f,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [size.w, size.h]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { active: true, moved: false, x0: e.clientX, y0: e.clientY, tx0: zp.tx, ty0: zp.ty };
    setIsPanning(true);
  }, [zp.tx, zp.ty]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) setZp(prev => ({ ...prev, tx: d.tx0 + dx, ty: d.ty0 + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    drag.current.active = false;
    setIsPanning(false);
  }, []);

  const handleDblClick = useCallback(() => setZp(ZP_INIT), []);

  const { pos, settled } = useSpringSimulation(layout.nodes, simKey);

  const nodeById   = new Map(layout.nodes.map(n => [n.fileId, n]));
  const centerNode = layout.nodes.find(n => n.hop === 0);
  const pkgNodes   = layout.nodes.filter(n => n.hop === 1);
  const fileNodes  = layout.nodes.filter(n => n.hop === 2);
  const centerName = centerNode?.fileName ?? layout.center;

  const hovEdgeIds = new Set<string>();
  if (hoveredId) {
    for (const e of layout.edges) {
      if (e.from === hoveredId || e.to === hoveredId) hovEdgeIds.add(e.id);
    }
  }

  function sp(fileId: string, fx: number, fy: number) {
    return pos.get(fileId) ?? { x: fx, y: fy };
  }

  // ── Viewport bounds (layout-space) ──────────────────────────────────
  // Screen pt (sx, sy) maps to layout pt ((sx - cx - tx)/scale, ...).
  // Cache the inverse-mapped visible rect so every node/edge test is a
  // cheap aabb-overlap instead of re-deriving per call.
  const viewRect = useMemo(() => {
    const s   = Math.max(zp.scale, 1e-6);
    const vw  = size.w;
    const vh  = size.h - 36;
    const x0  = (0  - cx - zp.tx) / s - CULL_MARGIN;
    const y0  = (0  - cy - zp.ty) / s - CULL_MARGIN;
    const x1  = (vw - cx - zp.tx) / s + CULL_MARGIN;
    const y1  = (vh - cy - zp.ty) / s + CULL_MARGIN;
    return { x0, y0, x1, y1 };
  }, [zp, size.w, size.h, cx, cy]);

  const pointVisible = useCallback((x: number, y: number, r = 0): boolean => {
    return x + r >= viewRect.x0 && x - r <= viewRect.x1
        && y + r >= viewRect.y0 && y - r <= viewRect.y1;
  }, [viewRect]);

  const segmentVisible = useCallback((
    ax: number, ay: number, bx: number, by: number,
  ): boolean => {
    // Either endpoint inside → visible.
    if (pointVisible(ax, ay) || pointVisible(bx, by)) return true;
    // Both endpoints outside the same side → cannot intersect the rect.
    const { x0, y0, x1, y1 } = viewRect;
    if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1)) return false;
    if ((ay < y0 && by < y0) || (ay > y1 && by > y1)) return false;
    return true; // conservative — edge bbox overlaps rect
  }, [pointVisible, viewRect]);

  // ── LOD flags ──────────────────────────────────────────────────────
  const showFiles    = zp.scale >= LOD_FILES;
  const showDepEdges = zp.scale >= LOD_DEPS;
  const fullLabels   = zp.scale >= LOD_FULL_LABEL;

  // Visible counts for the footer indicator — cheap loop, no memo.
  let visibleFiles = 0, visiblePkgs = 0, visibleDeps = 0;
  if (showFiles) {
    for (const n of fileNodes) {
      const p = sp(n.fileId, n.x, n.y);
      if (pointVisible(p.x, p.y, n.radius)) visibleFiles++;
    }
  }
  for (const n of pkgNodes) {
    const p = sp(n.fileId, n.x, n.y);
    if (pointVisible(p.x, p.y, n.radius)) visiblePkgs++;
  }
  if (showDepEdges) {
    for (const e of layout.edges) {
      if (e.isTreeEdge) continue;
      const fn = nodeById.get(e.from), tn = nodeById.get(e.to);
      if (!fn || !tn) continue;
      const fp = sp(fn.fileId, fn.x, fn.y), tp = sp(tn.fileId, tn.x, tn.y);
      if (segmentVisible(fp.x, fp.y, tp.x, tp.y)) visibleDeps++;
    }
  }

  const outerStyle: CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", flexDirection: "column",
    background: color.bg0,
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(8px)",
    transition: "opacity 250ms ease-out, transform 250ms ease-out",
  };

  const titleBarStyle: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`, flexShrink: 0,
  };

  const dismissBtnStyle: CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    padding: `${space[1]}px`, color: color.text2,
    fontSize: font.size.md, lineHeight: 1,
    borderRadius: `${radius.sm}px`, transition: `color ${transition.fast}`,
  };

  const centerR = centerNode?.radius ?? 20;
  const pkgCount  = pkgNodes.length;

  return (
    <div style={outerStyle}>
      <style>{`
        @keyframes nh-pulse   { 0%,100% { opacity:.5; } 50% { opacity:0; } }
        @keyframes nh-breathe { 0%,100% { r:${centerR}; } 50% { r:${centerR+2}; } }
        @keyframes nh-edgePulse { 0%,100% { stroke-opacity:.3; } 50% { stroke-opacity:.85; } }
      `}</style>

      {/* Header */}
      <div style={titleBarStyle}>
        <div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text0, fontFamily: font.sans }}>
            Neighborhood Halo
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
            {pkgCount}개 패키지 · {layout.totalNodes}개 파일 · 2-hop 반경
          </div>
        </div>
        {onDismiss && <button type="button" style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">×</button>}
      </div>

      {/* SVG */}
      <svg ref={svgRef}
        viewBox={`0 0 ${size.w} ${size.h - 36}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDblClick}
        style={{
          display: "block", width: "100%", flex: 1, userSelect: "none", overflow: "hidden",
          cursor: isPanning ? "grabbing" : "grab",
        }}
      >
        <defs>
          <pattern id="nh-dot" width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={1} fill={color.border} opacity={0.25} />
          </pattern>
        </defs>

        <rect x={0} y={0} width={size.w} height={size.h - 36} fill="url(#nh-dot)" style={{ pointerEvents: "none" }} />
        <rect x={0} y={0} width={size.w} height={size.h - 36} fill="transparent" onClick={handleBackdrop} />

        <g transform={`translate(${cx + zp.tx},${cy + zp.ty}) scale(${zp.scale})`}>

          {/* Guide rings */}
          {([
            { r: 160, label: "패키지" },
            { r: 320, label: "파일" },
          ] as const).map(({ r, label }) => (
            <g key={r}>
              <circle cx={0} cy={0} r={r} fill="none"
                stroke={color.border} strokeWidth={1}
                strokeDasharray="4 7" strokeOpacity={0.4}
              />
              <text x={r + 6} y={0} fontSize={font.size.xs} fill={color.text2} fontFamily={font.sans}
                dominantBaseline="middle" style={{ userSelect: "none" }}>{label}</text>
            </g>
          ))}

          {/* Tree edges (center→pkg, pkg→file) — thin dashed grey */}
          {layout.edges.filter(e => e.isTreeEdge).map((edge: NeighborhoodEdge) => {
            const fn = nodeById.get(edge.from), tn = nodeById.get(edge.to);
            if (!fn || !tn) return null;
            if (!showFiles && tn.hop === 2) return null; // LOD: pkg→file edges collapse
            const fp = sp(fn.fileId, fn.x, fn.y), tp = sp(tn.fileId, tn.x, tn.y);
            if (!segmentVisible(fp.x, fp.y, tp.x, tp.y)) return null;
            const isHovAdj = hoveredId === edge.from || hoveredId === edge.to;
            return (
              <line key={edge.id}
                x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                stroke={color.border}
                strokeWidth={1}
                strokeDasharray={tn.hop === 2 ? "3 4" : "none"}
                strokeOpacity={hoveredId ? (isHovAdj ? 0.6 : 0.08) : 0.35}
              />
            );
          })}

          {/* Dependency edges (file↔file) — colored. Hidden at low zoom. */}
          {showDepEdges && layout.edges.filter(e => !e.isTreeEdge).map((edge: NeighborhoodEdge) => {
            const fn = nodeById.get(edge.from), tn = nodeById.get(edge.to);
            if (!fn || !tn) return null;
            const fp = sp(fn.fileId, fn.x, fn.y), tp = sp(tn.fileId, tn.x, tn.y);
            if (!segmentVisible(fp.x, fp.y, tp.x, tp.y)) return null;
            const isHovAdj = hoveredId === edge.from || hoveredId === edge.to;
            const isPulsing = hovEdgeIds.has(edge.id);
            const sc = edge.isHighlighted ? depStroke(edge.severity) : color.border;
            const so = hoveredId ? (isHovAdj ? 0.85 : 0.05) : (edge.isHighlighted ? 0.6 : 0.25);
            return (
              <line key={edge.id}
                x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y}
                stroke={sc} strokeWidth={edge.isHighlighted ? 1.5 : 1}
                strokeOpacity={so}
                style={isPulsing ? { animation: "nh-edgePulse 600ms ease-in-out infinite" } : undefined}
              />
            );
          })}

          {/* File nodes (outer ring) — hidden at low zoom. */}
          {showFiles && fileNodes.map(n => {
            const p = sp(n.fileId, n.x, n.y);
            if (!pointVisible(p.x, p.y, n.radius + 12)) return null;
            const pulsing = hoveredId !== null && layout.edges.some(
              e => !e.isTreeEdge && (e.from === hoveredId || e.to === hoveredId) && (e.from === n.fileId || e.to === n.fileId),
            );
            return (
              <FileNode key={n.fileId} node={n}
                isCenter={false}
                isHovered={hoveredId === n.fileId}
                isDimmed={hoveredId !== null && hoveredId !== n.fileId}
                sx={p.x} sy={p.y} settled={settled}
                onClick={handleNodeClick} onEnter={handleEnter} onLeave={handleLeave}
                pulsing={pulsing}
                fullLabel={fullLabels}
              />
            );
          })}

          {/* Package hub nodes (inner ring) */}
          {pkgNodes.map(n => {
            const p = sp(n.fileId, n.x, n.y);
            if (!pointVisible(p.x, p.y, n.radius + 24)) return null;
            return (
              <PackageHub key={n.fileId} node={n}
                isHovered={hoveredId === n.fileId}
                isDimmed={hoveredId !== null && hoveredId !== n.fileId}
                sx={p.x} sy={p.y} settled={settled}
                onClick={handleNodeClick} onEnter={handleEnter} onLeave={handleLeave}
                fullLabel={fullLabels}
              />
            );
          })}

          {/* Center node (always on top, never culled) */}
          {centerNode && (() => {
            const p = sp(centerNode.fileId, 0, 0);
            return (
              <FileNode key="center" node={centerNode}
                isCenter
                isHovered={hoveredId === centerNode.fileId}
                isDimmed={false}
                sx={p.x} sy={p.y} settled={settled}
                onClick={handleNodeClick} onEnter={handleEnter} onLeave={handleLeave}
                pulsing={false}
                fullLabel={fullLabels}
              />
            );
          })()}

          {/* Tooltip — only if the hovered node is still in view. */}
          {hoveredId && nodeById.get(hoveredId) && (() => {
            const n = nodeById.get(hoveredId)!;
            const p = sp(n.fileId, n.x, n.y);
            if (!pointVisible(p.x, p.y, n.radius)) return null;
            return <Tooltip node={n} sp={p} scale={zp.scale} />;
          })()}
        </g>
      </svg>

      {/* Bottom bar */}
      <div style={{
        flexShrink: 0, padding: `${space[1]}px ${space[4]}px`,
        borderTop: `1px solid ${color.border}`,
        display: "flex", alignItems: "center", gap: space[2],
        background: color.bg1, height: 36,
      }}>
        <span style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>center:</span>
        <span style={{ fontSize: font.size.xs, color: color.text1, fontWeight: font.weight.medium, fontFamily: font.sans }}>{centerName}</span>
        <span style={{ color: color.border }}>|</span>
        <span style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
          시야 {visiblePkgs}/{pkgCount}개 패키지
        </span>
        <span style={{ color: color.border }}>|</span>
        <span style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
          {showFiles ? `${visibleFiles}/${layout.totalNodes}개 파일` : `${layout.totalNodes}개 파일 (축소됨)`}
        </span>
        <span style={{ color: color.border }}>|</span>
        <span style={{ fontSize: font.size.xs, color: color.text2, fontFamily: font.sans }}>
          {showDepEdges ? `${visibleDeps}개 의존 엣지` : "의존 엣지 숨김"}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: space[2] }}>
          {!settled && (
            <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.sans, opacity: 0.6 }}>
              시뮬레이션 중…
            </span>
          )}
          <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.sans, fontVariantNumeric: "tabular-nums" }}>
            zoom {(zp.scale * 100).toFixed(0)}%
          </span>
          <button type="button"
            onClick={() => setZp(ZP_INIT)}
            disabled={zp.scale === 1 && zp.tx === 0 && zp.ty === 0}
            style={{
              background: "none", border: `1px solid ${color.border}`, borderRadius: radius.sm,
              padding: `2px ${space[2]}px`, cursor: "pointer",
              fontSize: font.size.xxs, color: color.text2, fontFamily: font.sans,
              opacity: (zp.scale === 1 && zp.tx === 0 && zp.ty === 0) ? 0.4 : 1,
            }}
          >리셋</button>
        </span>
      </div>
    </div>
  );
}

export const NeighborhoodView = memo(NeighborhoodViewImpl);
