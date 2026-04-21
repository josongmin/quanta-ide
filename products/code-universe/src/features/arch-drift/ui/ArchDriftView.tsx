// ArchDriftView — SOTA++ two-zone architecture drift panel.
// --------------------------------------------------------------------
// Zone A (top):  HIGH severity findings as warning cards.
// Zone B (below): MEDIUM + LOW as a polished compact table.
//
// Each high-severity card shows:
//   - File name (semibold) + drift kind badge + detail text
//   - Before→after inline bar visualization (80px, 6px height)
//   - Layer pill (color-coded by layer)
//
// Empty state: green shield SVG + "Architecture is stable ✓"
//
// Entry animation: container fadeUp 250ms, cards stagger 40ms.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { buildArchDriftLayout } from "../model/build-arch-drift-layout";
import type { ArchDriftRow, ArchDriftLayout } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface ArchDriftViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const CONTAINER_MS = 250;
const STAGGER_MS   = 40;

// ── Kind badge config ─────────────────────────────────────────────────

type KindMeta = { icon: string; label: string; bg: string; fg: string };

const KIND_META: Record<ArchDriftRow["kind"], KindMeta> = {
  "layer-escalation": {
    icon: "🔺",
    label: "Layer Escalation",
    bg: "rgba(139,92,246,0.12)",
    fg: "#8b5cf6",
  },
  "fanout-explosion": {
    icon: "💥",
    label: "Fanout Explosion",
    bg: "rgba(249,115,22,0.12)",
    fg: "#f97316",
  },
  "new-cycle-member": {
    icon: "🔄",
    label: "Cycle Member",
    bg: "rgba(239,68,68,0.12)",
    fg: "#ef4444",
  },
  "ownership-shift": {
    icon: "🔀",
    label: "Ownership Shift",
    bg: "rgba(99,102,241,0.12)",
    fg: "#6366f1",
  },
};

// ── Layer pill config ─────────────────────────────────────────────────

type LayerPillMeta = { bg: string; fg: string };

const LAYER_META: Record<string, LayerPillMeta> = {
  domain:  { bg: "rgba(99,102,241,0.15)",  fg: "#818cf8" },
  adapter: { bg: "rgba(6,182,212,0.15)",   fg: "#22d3ee" },
  infra:   { bg: "rgba(245,158,11,0.15)",  fg: "#fbbf24" },
  ui:      { bg: "rgba(16,185,129,0.15)",  fg: "#34d399" },
  util:    { bg: "rgba(139,92,246,0.15)",  fg: "#a78bfa" },
  unknown: { bg: color.bg2,                fg: color.text2 },
};

function getLayerMeta(layer: string): LayerPillMeta {
  return LAYER_META[layer] ?? LAYER_META["unknown"]!;
}

// ── Keyframes injection (once) ────────────────────────────────────────

let _injected = false;
function injectKeyframes(): void {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes _adv-fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes adv-rowIn {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes adv-confetti {
      0%   { opacity: 1; r: 0; }
      60%  { opacity: 1; }
      100% { opacity: 0; r: 40; }
    }
  `;
  document.head.appendChild(style);
}

// ── KindBadge ─────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: ArchDriftRow["kind"] }) {
  const meta = KIND_META[kind];
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: `2px ${space[2]}px`,
    borderRadius: radius.pill,
    backgroundColor: meta.bg,
    color: meta.fg,
    fontSize: font.size.xs,
    fontFamily: font.sans,
    fontWeight: font.weight.semibold,
    whiteSpace: "nowrap",
    userSelect: "none",
    letterSpacing: "0.01em",
  };
  return (
    <span style={style}>
      <span role="img" aria-hidden="true" style={{ fontSize: 9, lineHeight: 1 }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

// ── LayerPill ─────────────────────────────────────────────────────────

function LayerPill({ layer }: { layer: string }) {
  const meta = getLayerMeta(layer);
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: `1px ${space[2]}px`,
    borderRadius: radius.pill,
    backgroundColor: meta.bg,
    color: meta.fg,
    fontSize: font.size.xs,
    fontFamily: font.mono,
    fontWeight: font.weight.medium,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  return <span style={style}>{layer}</span>;
}

// ── SeverityBadge (table zone) ────────────────────────────────────────

function SeverityBadge({ severity }: { severity: ArchDriftRow["severity"] }) {
  const cfg: Record<string, { bg: string; fg: string }> = {
    high:   { bg: "rgba(239,68,68,0.12)",   fg: "#ef4444" },
    medium: { bg: "rgba(245,158,11,0.12)",  fg: "#f59e0b" },
    low:    { bg: "rgba(113,113,122,0.12)", fg: "#71717a" },
  };
  const c = cfg[severity] ?? cfg["low"]!;
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `1px ${space[1]}px`,
    borderRadius: radius.xs,
    backgroundColor: c.bg,
    color: c.fg,
    fontSize: font.size.xxs,
    fontFamily: font.sans,
    fontWeight: font.weight.bold,
    letterSpacing: "0.06em",
    minWidth: 36,
    userSelect: "none",
  };
  return <span style={style}>{severity.toUpperCase()}</span>;
}

// ── DegreeMiniBar — before→after visualization ────────────────────────

function DegreeMiniBar({
  beforeDegree,
  afterDegree,
  mounted,
}: Pick<ArchDriftRow, "beforeDegree" | "afterDegree"> & { mounted: boolean }) {
  const max  = Math.max(beforeDegree, afterDegree, 1);
  const TOTAL_W = 80;
  const H = 6;

  const beforeW = Math.round((beforeDegree / max) * TOTAL_W);
  const afterW  = Math.round((afterDegree  / max) * TOTAL_W);
  const increased = afterDegree > beforeDegree;
  const barColor  = increased ? "#ef4444" : "#22a06b";

  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  };
  const labelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontFamily: font.mono,
    color: color.text2,
    whiteSpace: "nowrap",
  };
  const trackStyle: CSSProperties = {
    position: "relative",
    width: TOTAL_W,
    height: H,
    borderRadius: 3,
    backgroundColor: color.bg3,
    overflow: "hidden",
  };
  // before bar — ghost gray
  const beforeBarStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: mounted ? beforeW : 0,
    height: H,
    borderRadius: 3,
    backgroundColor: color.border,
    transition: "width 500ms ease-out 100ms",
  };
  // after bar — semantic color
  const afterBarStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: mounted ? afterW : 0,
    height: H,
    borderRadius: 3,
    backgroundColor: barColor,
    opacity: 0.85,
    transition: "width 600ms ease-out 200ms",
  };

  return (
    <div style={wrapStyle}>
      <div style={trackStyle}>
        <div style={beforeBarStyle} />
        <div style={afterBarStyle} />
      </div>
      <span style={labelStyle}>
        {beforeDegree} → {afterDegree} edges
      </span>
    </div>
  );
}

// ── HighSeverityCard ──────────────────────────────────────────────────

function HighSeverityCard({
  row,
  index,
  mounted,
  onFocusEntity,
}: {
  row: ArchDriftRow;
  index: number;
  mounted: boolean;
  onFocusEntity?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const delayMs = index * STAGGER_MS;

  const cardStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: space[2],
    padding: space[3],
    backgroundColor: color.bg0,
    borderLeft: `3px solid #ef4444`,
    borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
    boxShadow: hovered
      ? "0 2px 12px rgba(239,68,68,0.10)"
      : "0 1px 4px rgba(0,0,0,0.04)",
    cursor: onFocusEntity ? "pointer" : "default",
    transition: `box-shadow ${transition.fast}, background-color ${transition.fast}`,
    animation: `_adv-fadeUp ${CONTAINER_MS}ms ease-out ${delayMs}ms both`,
  };

  const topRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    flexWrap: "wrap",
  };

  const fileNameStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontFamily: font.mono,
    fontWeight: font.weight.semibold,
    color: color.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  };

  const detailStyle: CSSProperties = {
    fontSize: font.size.xs,
    fontFamily: font.sans,
    color: color.text2,
    lineHeight: 1.4,
  };

  const bottomRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space[3],
    flexWrap: "wrap",
  };

  const layerRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    fontSize: font.size.xs,
    fontFamily: font.sans,
    color: color.text2,
  };

  return (
    <div
      style={cardStyle}
      onClick={() => onFocusEntity?.(row.fileId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="article"
      aria-label={`High severity: ${row.fileName}`}
    >
      <div style={topRowStyle}>
        <span style={fileNameStyle} title={row.fileName}>{row.fileName}</span>
        <KindBadge kind={row.kind} />
      </div>

      <span style={detailStyle}>{row.detail}</span>

      <div style={bottomRowStyle}>
        <div style={layerRowStyle}>
          <LayerPill layer={row.beforeLayer} />
          <span style={{ color: color.text3, fontSize: font.size.xxs }}>→</span>
          <LayerPill layer={row.afterLayer} />
        </div>
        <DegreeMiniBar
          beforeDegree={row.beforeDegree}
          afterDegree={row.afterDegree}
          mounted={mounted}
        />
      </div>
    </div>
  );
}

// ── Summary chips ─────────────────────────────────────────────────────

interface SummaryChipsProps extends Pick<ArchDriftLayout, "highCount" | "mediumCount" | "lowCount"> {
  countedHigh: number;
  countedMedium: number;
  countedLow: number;
}

function SummaryChips({
  countedHigh,
  countedMedium,
  countedLow,
}: SummaryChipsProps) {
  const wrapStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
  };

  const chipStyle = (bg: string, fg: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: `2px ${space[2]}px`,
    borderRadius: radius.pill,
    backgroundColor: bg,
    color: fg,
    fontSize: font.size.xs,
    fontFamily: font.sans,
    fontWeight: font.weight.semibold,
    userSelect: "none",
    fontVariantNumeric: "tabular-nums",
  });

  const dotStyle = (bg: string): CSSProperties => ({
    width: 5,
    height: 5,
    borderRadius: "50%",
    backgroundColor: bg,
    flexShrink: 0,
  });

  return (
    <div style={wrapStyle}>
      <span style={chipStyle("rgba(239,68,68,0.12)", "#ef4444")}>
        <span style={dotStyle("#ef4444")} />
        {Math.round(countedHigh)} high
      </span>
      <span style={chipStyle("rgba(245,158,11,0.12)", "#f59e0b")}>
        <span style={dotStyle("#f59e0b")} />
        {Math.round(countedMedium)} medium
      </span>
      <span style={chipStyle("rgba(113,113,122,0.10)", "#71717a")}>
        <span style={dotStyle("#71717a")} />
        {Math.round(countedLow)} low
      </span>
    </div>
  );
}

// ── Table (Medium + Low) ──────────────────────────────────────────────

const COL_STYLES: CSSProperties[] = [
  { width: 52,  flexShrink: 0 },
  { flex: 1,    minWidth: 110, overflow: "hidden" },
  { width: 148, flexShrink: 0 },
  { flex: 1,    minWidth: 90,  overflow: "hidden" },
  { width: 188, flexShrink: 0 },
];

function CompactTableHeader() {
  const LABELS = ["SEV", "FILE", "DRIFT KIND", "DETAIL", "LAYER / DEGREE"];
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[1]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    backgroundColor: color.bg2,
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
  const thStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontFamily: font.sans,
    fontWeight: font.weight.semibold,
    color: color.text2,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    userSelect: "none",
  };
  return (
    <div role="row" style={rowStyle}>
      {LABELS.map((label, i) => (
        <div key={label} role="columnheader" style={{ ...COL_STYLES[i], ...thStyle }}>
          {label}
        </div>
      ))}
    </div>
  );
}

function CompactTableRow({
  row,
  index,
  mounted,
  onFocusEntity,
}: {
  row: ArchDriftRow;
  index: number;
  mounted: boolean;
  onFocusEntity?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.borderSoft}`,
    borderLeft: hovered ? `2px solid ${color.accent}` : "2px solid transparent",
    paddingLeft: hovered ? space[4] - 2 : space[4],
    backgroundColor: hovered ? color.bg1 : "transparent",
    cursor: onFocusEntity ? "pointer" : "default",
    transition: `background-color ${transition.fast}, border-left-color ${transition.fast}`,
    animation: mounted ? `adv-rowIn 200ms ease-out both` : undefined,
    animationDelay: mounted ? `${index * 25}ms` : undefined,
  };

  const fileNameStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontFamily: font.mono,
    color: color.text0,
    fontWeight: font.weight.medium,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const detailStyle: CSSProperties = {
    fontSize: font.size.xs,
    fontFamily: font.sans,
    color: color.text2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const layerDeltaStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
  };

  return (
    <div
      role="row"
      style={rowStyle}
      onClick={() => onFocusEntity?.(row.fileId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div role="cell" style={COL_STYLES[0]}>
        <SeverityBadge severity={row.severity} />
      </div>
      <div role="cell" style={{ ...COL_STYLES[1], ...fileNameStyle }}>
        {row.fileName}
      </div>
      <div role="cell" style={COL_STYLES[2]}>
        <KindBadge kind={row.kind} />
      </div>
      <div role="cell" style={{ ...COL_STYLES[3], ...detailStyle }}>
        {row.detail}
      </div>
      <div role="cell" style={{ ...COL_STYLES[4] }}>
        <div style={layerDeltaStyle}>
          <LayerPill layer={row.beforeLayer} />
          <span style={{ color: color.text3, fontSize: font.size.xxs }}>→</span>
          <LayerPill layer={row.afterLayer} />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────

function StableEmptyState() {
  const [confettiMounted, setConfettiMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setConfettiMounted(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
    padding: `${space[7]}px ${space[4]}px`,
    flex: 1,
  };
  const titleStyle: CSSProperties = {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: color.text0,
    fontFamily: font.sans,
  };
  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text2,
    fontFamily: font.sans,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 1.5,
  };

  // 8 confetti pieces: colors cycling through accent/success/warn
  const confettiColors = ["#22c55e", "#0d99ff", "#f59e0b", "#8b5cf6", "#22c55e", "#ef4444", "#14b8a6", "#f97316"];
  const cx = 20;
  const cy = 20;

  return (
    <div style={wrapStyle}>
      {/* Green shield SVG with confetti */}
      <svg width={40} height={40} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ overflow: "visible" }}>
        <path
          d="M20 4L6 9.5V20c0 8 6.2 14.9 14 16 7.8-1.1 14-8 14-16V9.5L20 4z"
          fill="rgba(34,160,107,0.12)"
          stroke="#22a06b"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="M14 20l4 4 8-8"
          stroke="#22a06b"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {confettiMounted && confettiColors.map((fill, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const dist = 28;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          return (
            <rect
              key={i}
              x={x - 3}
              y={y - 3}
              width={6}
              height={6}
              rx={1}
              fill={fill}
              style={{
                animation: `adv-confetti 800ms ease-out ${i * 60}ms both`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            />
          );
        })}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <span style={titleStyle}>Architecture is stable ✓</span>
        <span style={subtitleStyle}>
          No drift detected between baseline and HEAD
        </span>
      </div>
    </div>
  );
}

function NoHistoryState() {
  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: `${space[7]}px ${space[4]}px`,
    flex: 1,
    color: color.text2,
    fontFamily: font.sans,
    fontSize: font.size.md,
    fontStyle: "italic",
  };
  return (
    <div style={wrapStyle}>
      <span style={{ fontSize: 26 }} role="img" aria-hidden="true">🕐</span>
      <span>No history data</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function ArchDriftViewImpl({ graph, onFocusEntity, onDismiss }: ArchDriftViewProps) {
  const [mounted, setMounted] = useState(false);
  const [countedHigh, setCountedHigh] = useState(0);
  const [countedMedium, setCountedMedium] = useState(0);
  const [countedLow, setCountedLow] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafHighRef = useRef<number>(0);
  const rafMediumRef = useRef<number>(0);
  const rafLowRef = useRef<number>(0);

  injectKeyframes();

  useEffect(() => {
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  useEffect(() => {
    if (!onDismiss) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  const layout = useMemo(() => buildArchDriftLayout({ graph }), [graph]);

  const highRows   = useMemo(() => layout.rows.filter(r => r.severity === "high"),   [layout]);
  const lowerRows  = useMemo(() => layout.rows.filter(r => r.severity !== "high"),   [layout]);

  // Severity chip count-up animation
  useEffect(() => {
    if (!mounted) return;
    const duration = 600;

    const animate = (
      target: number,
      setFn: (v: number) => void,
      rafRef: React.MutableRefObject<number>,
      delayMs: number,
    ) => {
      const timer = setTimeout(() => {
        const startTime = performance.now();
        const tick = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setFn(eased * target);
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }, delayMs);
      return timer;
    };

    const t1 = animate(layout.highCount,   setCountedHigh,   rafHighRef,   0);
    const t2 = animate(layout.mediumCount, setCountedMedium, rafMediumRef, 100);
    const t3 = animate(layout.lowCount,    setCountedLow,    rafLowRef,    200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      cancelAnimationFrame(rafHighRef.current);
      cancelAnimationFrame(rafMediumRef.current);
      cancelAnimationFrame(rafLowRef.current);
    };
  }, [mounted, layout.highCount, layout.mediumCount, layout.lowCount]);

  // ── Styles ────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: color.bg1,
    borderRadius: radius.md,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "none" : "translateY(8px)",
    transition: `opacity ${CONTAINER_MS}ms ease-out, transform ${CONTAINER_MS}ms ease-out`,
    fontFamily: font.sans,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    gap: space[3],
    flexShrink: 0,
  };

  const headerLeftStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: color.text0,
    fontFamily: font.sans,
    lineHeight: 1,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: color.text2,
    fontFamily: font.sans,
  };

  const dismissBtnStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    border: "none",
    backgroundColor: "transparent",
    color: color.text2,
    fontSize: font.size.md,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `color ${transition.fast}, background-color ${transition.fast}`,
  };

  const summaryBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    backgroundColor: color.bg2,
    flexShrink: 0,
  };

  return (
    <div ref={containerRef} style={rootStyle} role="region" aria-label="Architecture Drift">
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <span style={titleStyle}>Architecture Drift</span>
          <span style={subtitleStyle}>baseline vs. HEAD comparison</span>
        </div>
        {onDismiss && (
          <button
            style={dismissBtnStyle}
            onClick={onDismiss}
            aria-label="Close Architecture Drift"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* No history */}
      {!layout.hasHistory && <NoHistoryState />}

      {/* Has history */}
      {layout.hasHistory && (
        <>
          {/* Summary strip */}
          <div style={summaryBarStyle}>
            <SummaryChips
              highCount={layout.highCount}
              mediumCount={layout.mediumCount}
              lowCount={layout.lowCount}
              countedHigh={countedHigh}
              countedMedium={countedMedium}
              countedLow={countedLow}
            />
          </div>

          {layout.totalCount === 0 ? (
            <StableEmptyState />
          ) : (
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {/* Zone A — HIGH cards */}
              {highRows.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: space[2],
                    padding: space[3],
                    backgroundColor: "rgba(239,68,68,0.03)",
                    borderBottom: `1px solid ${color.border}`,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: font.size.xs,
                      fontWeight: font.weight.semibold,
                      color: "#ef4444",
                      fontFamily: font.sans,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    High Severity — {highRows.length} {highRows.length === 1 ? "finding" : "findings"}
                  </span>
                  {highRows.map((row, i) => (
                    <HighSeverityCard
                      key={row.fileId + row.kind}
                      row={row}
                      index={i}
                      mounted={mounted}
                      onFocusEntity={onFocusEntity}
                    />
                  ))}
                </div>
              )}

              {/* Zone B — MEDIUM + LOW table */}
              {lowerRows.length > 0 && (
                <div
                  role="table"
                  aria-label={`${lowerRows.length} medium and low severity findings`}
                  style={{ flexShrink: 0 }}
                >
                  {highRows.length > 0 && (
                    <div
                      style={{
                        padding: `${space[2]}px ${space[4]}px ${space[1]}px`,
                        fontSize: font.size.xs,
                        fontWeight: font.weight.semibold,
                        color: color.text2,
                        fontFamily: font.sans,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        backgroundColor: color.bg2,
                      }}
                    >
                      Medium &amp; Low — {lowerRows.length} {lowerRows.length === 1 ? "finding" : "findings"}
                    </div>
                  )}
                  <CompactTableHeader />
                  {lowerRows.map((row, i) => (
                    <CompactTableRow
                      key={row.fileId + row.kind}
                      row={row}
                      index={i}
                      mounted={mounted}
                      onFocusEntity={onFocusEntity}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const ArchDriftView = memo(ArchDriftViewImpl);
