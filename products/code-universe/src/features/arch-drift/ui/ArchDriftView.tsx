// ArchDriftView — SOTA++ DOM table of architecture drift findings.
// --------------------------------------------------------------------
// Renders a sorted table of DriftFinding rows (high → low severity).
// Each row shows a severity badge, file name, drift kind badge,
// human-readable detail, and a before → after layer/degree summary.
//
// Empty states:
//   • No drift findings     → "Architecture is stable ✓"
//   • No graph history      → "No history data"
//
// Entry animation: fade-in 220 ms.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import { buildArchDriftLayout } from "../model/build-arch-drift-layout";
import type { ArchDriftRow, ArchDriftLayout } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface ArchDriftViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 220;

// ── Kind badge config ─────────────────────────────────────────────────

type KindMeta = { icon: string; label: string; bg: string; fg: string };

const KIND_META: Record<ArchDriftRow["kind"], KindMeta> = {
  "layer-escalation": {
    icon: "🔺",
    label: "Layer Escalation",
    bg: "rgba(126,78,214,0.10)",
    fg: "#7e4ed6",
  },
  "fanout-explosion": {
    icon: "💥",
    label: "Fanout Explosion",
    bg: "rgba(249,115,22,0.10)",
    fg: "#ea580c",
  },
  "new-cycle-member": {
    icon: "🔄",
    label: "Cycle Member",
    bg: "rgba(239,68,68,0.10)",
    fg: "#dc2626",
  },
  "ownership-shift": {
    icon: "🔀",
    label: "Ownership Shift",
    bg: "rgba(99,102,241,0.10)",
    fg: "#4f46e5",
  },
};

// ── Severity badge ────────────────────────────────────────────────────

function SeverityBadge({ severity, bg }: { severity: ArchDriftRow["severity"]; bg: string }) {
  const label = severity.toUpperCase();
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `1px ${space[1]}px`,
    borderRadius: radius.xs,
    backgroundColor: `${bg}22`,
    color: bg,
    fontSize: font.size.xxs,
    fontFamily: font.sans,
    fontWeight: font.weight.bold,
    letterSpacing: "0.06em",
    minWidth: 38,
    userSelect: "none",
  };
  return <span style={style}>{label}</span>;
}

// ── Kind badge ────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: ArchDriftRow["kind"] }) {
  const meta = KIND_META[kind];
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: `1px ${space[1]}px`,
    borderRadius: radius.xs,
    backgroundColor: meta.bg,
    color: meta.fg,
    fontSize: font.size.xs,
    fontFamily: font.sans,
    fontWeight: font.weight.medium,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  return (
    <span style={style}>
      <span role="img" aria-hidden="true" style={{ fontSize: 10 }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

// ── Layer/degree cell ─────────────────────────────────────────────────

function LayerDelta({
  beforeLayer,
  afterLayer,
  beforeDegree,
  afterDegree,
}: Pick<ArchDriftRow, "beforeLayer" | "afterLayer" | "beforeDegree" | "afterDegree">) {
  const changed = beforeLayer !== afterLayer;
  const cellStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
    fontSize: font.size.xs,
    fontFamily: font.mono,
    color: color.text2,
  };
  const arrowStyle: CSSProperties = {
    color: color.text3,
    fontSize: font.size.xxs,
  };
  const layerStyle = (_layer: string, isAfter: boolean): CSSProperties => ({
    color: isAfter && changed ? color.danger : color.text1,
    fontWeight: isAfter && changed ? font.weight.semibold : font.weight.regular,
  });
  const degreeStyle = (deg: number, other: number): CSSProperties => ({
    color: deg > other ? color.danger : color.text2,
    fontWeight: deg > other ? font.weight.semibold : font.weight.regular,
  });

  return (
    <div style={cellStyle}>
      <span style={layerStyle(beforeLayer, false)}>{beforeLayer}</span>
      <span style={arrowStyle}>/</span>
      <span style={degreeStyle(beforeDegree, afterDegree)}>{beforeDegree}</span>
      <span style={arrowStyle}>→</span>
      <span style={layerStyle(afterLayer, true)}>{afterLayer}</span>
      <span style={arrowStyle}>/</span>
      <span style={degreeStyle(afterDegree, beforeDegree)}>{afterDegree}</span>
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────

function SummaryBar({
  highCount,
  mediumCount,
  lowCount,
}: Pick<ArchDriftLayout, "highCount" | "mediumCount" | "lowCount">) {
  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    backgroundColor: color.bg2,
  };
  const chipStyle = (bg: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: `1px ${space[2]}px`,
    borderRadius: radius.pill,
    backgroundColor: `${bg}18`,
    color: bg,
    fontSize: font.size.xs,
    fontFamily: font.sans,
    fontWeight: font.weight.semibold,
  });
  const dotStyle = (bg: string): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: bg,
    flexShrink: 0,
  });
  return (
    <div style={containerStyle}>
      <span style={chipStyle("#ef4444")}>
        <span style={dotStyle("#ef4444")} />
        {highCount} high
      </span>
      <span style={chipStyle("#f97316")}>
        <span style={dotStyle("#f97316")} />
        {mediumCount} medium
      </span>
      <span style={chipStyle("#f59e0b")}>
        <span style={dotStyle("#f59e0b")} />
        {lowCount} low
      </span>
    </div>
  );
}

// ── Table header ──────────────────────────────────────────────────────

const COL_STYLES: CSSProperties[] = [
  { width: 52, flexShrink: 0 },                           // severity
  { flex: 1, minWidth: 120, overflow: "hidden" },          // file name
  { width: 152, flexShrink: 0 },                           // kind
  { flex: 1, minWidth: 100, overflow: "hidden" },          // detail
  { width: 190, flexShrink: 0 },                           // before→after
];

function TableHeader() {
  const LABELS = ["SEV", "FILE", "DRIFT KIND", "DETAIL", "LAYER / DEGREE"];
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[1]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    backgroundColor: color.bg3,
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

// ── Table row ─────────────────────────────────────────────────────────

function TableRow({
  row,
  onFocusEntity,
  isHovered,
  onMouseEnter,
  onMouseLeave,
}: {
  row: ArchDriftRow;
  onFocusEntity?: (id: string) => void;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.borderSoft}`,
    backgroundColor: isHovered ? color.hover : "transparent",
    cursor: onFocusEntity ? "pointer" : "default",
    transition: "background-color 100ms ease",
  };

  const handleClick = useCallback(() => {
    onFocusEntity?.(row.fileId);
  }, [onFocusEntity, row.fileId]);

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

  return (
    <div
      role="row"
      style={rowStyle}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div role="cell" style={COL_STYLES[0]}>
        <SeverityBadge severity={row.severity} bg={row.severityColor} />
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
      <div role="cell" style={COL_STYLES[4]}>
        <LayerDelta
          beforeLayer={row.beforeLayer}
          afterLayer={row.afterLayer}
          beforeDegree={row.beforeDegree}
          afterDegree={row.afterDegree}
        />
      </div>
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────

function EmptyState({ message, icon }: { message: string; icon: string }) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: `${space[7]}px ${space[4]}px`,
    color: color.text2,
    fontFamily: font.sans,
    fontSize: font.size.md,
    fontStyle: "italic",
  };
  const iconStyle: CSSProperties = {
    fontSize: 28,
    lineHeight: 1,
  };
  return (
    <div style={style}>
      <span style={iconStyle} role="img" aria-hidden="true">{icon}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function ArchDriftViewImpl({ graph, onFocusEntity, onDismiss }: ArchDriftViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fade-in on mount.
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

  // Dismiss on Escape.
  useEffect(() => {
    if (!onDismiss) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  const layout = useMemo(
    () => buildArchDriftLayout({ graph }),
    [graph],
  );

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: color.bg1,
    borderRadius: radius.md,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
  };

  // ── Header ────────────────────────────────────────────────────────

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${color.border}`,
    gap: space[3],
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: color.text0,
    fontFamily: font.sans,
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
  };

  return (
    <div ref={containerRef} style={rootStyle} role="region" aria-label="Architecture Drift">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>Architecture Drift</span>
          <span style={subtitleStyle}>baseline (6mo ago) vs. HEAD</span>
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
      {!layout.hasHistory && (
        <EmptyState message="No history data" icon="🕐" />
      )}

      {/* Has history — summary + table */}
      {layout.hasHistory && (
        <>
          <SummaryBar
            highCount={layout.highCount}
            mediumCount={layout.mediumCount}
            lowCount={layout.lowCount}
          />

          {layout.totalCount === 0 ? (
            <EmptyState message="Architecture is stable ✓" icon="✅" />
          ) : (
            <div
              style={{ flex: 1, overflow: "auto" }}
              role="table"
              aria-label={`${layout.totalCount} drift findings`}
            >
              <TableHeader />
              {layout.rows.map(row => (
                <TableRow
                  key={row.fileId + row.kind}
                  row={row}
                  onFocusEntity={onFocusEntity}
                  isHovered={hoveredId === row.fileId + row.kind}
                  onMouseEnter={() => setHoveredId(row.fileId + row.kind)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export const ArchDriftView = memo(ArchDriftViewImpl);
