// GodFileView — ranked list of oversized / multi-responsibility files.
// --------------------------------------------------------------------
// Each row shows:
//   • #rank + filename + LoC bar + "책임 추정 N개" pill
//   • Split-suggestion arrow → N synthesized proposed sub-files
//   • Expand: sub-cluster groups (named "Responsibility A / B / C")
//
// Candidate filter: LoC > 500 (fallback to `complexity(entity)` when
// LoC missing). Responsibility counts are seeded RNG (2..5) per file.
//
// Entrance: 500ms fade+scale + per-row stagger 20ms.
// Pure DOM, inline styles, light theme.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color as tokenColor,
  font,
  radius,
  space,
  transition,
} from "../../../shared/ui/tokens";
import {
  complexity,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface GodFileViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────

const STYLE_ID = "god-file-view-styles";
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes gfv-enter {
      from { opacity: 0; transform: scale(0.985); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes gfv-rowIn {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Model ─────────────────────────────────────────────────────────────

interface Responsibility {
  name: string;
  symbolCount: number;
  locShare: number; // 0..1 share of parent file LoC
}

interface GodRow {
  id: string;
  name: string;
  path: string;
  loc: number;
  responsibilityCount: number;
  responsibilities: Responsibility[];
  suggestedSplits: string[]; // proposed sub-file names
}

const LOC_THRESHOLD = 500;
const RESP_NAMES = [
  "Rendering",
  "State",
  "Data Fetching",
  "Validation",
  "Formatting",
  "I/O",
  "Events",
  "Parsing",
  "Caching",
  "Routing",
  "Auth",
  "Serialization",
];

function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

function buildRows(tree: EntityTree): GodRow[] {
  const out: GodRow[] = [];
  // Precompute max LoC for bar scaling.
  let maxLoc = LOC_THRESHOLD;
  const candidates: Entity[] = [];
  for (const entity of tree.byId.values()) {
    if (entity.kind !== "building") continue;
    const loc = entity.metrics?.loc ?? 0;
    if (loc > LOC_THRESHOLD) {
      candidates.push(entity);
      if (loc > maxLoc) maxLoc = loc;
      continue;
    }
    // Fallback: complexity signal for files without LoC metadata.
    if (loc === 0) {
      const cx = complexity(entity);
      if (cx > 0.75) {
        candidates.push(entity);
        // Synthesize a pseudo-LoC for bar display.
        const pseudoLoc = Math.floor(500 + cx * 2500);
        if (pseudoLoc > maxLoc) maxLoc = pseudoLoc;
      }
    }
  }

  for (const entity of candidates) {
    let loc = entity.metrics?.loc ?? 0;
    if (loc === 0) {
      loc = Math.floor(500 + complexity(entity) * 2500);
    }
    const rng = seeded(entity.id, "god");
    const respCount = 2 + Math.floor(rng() * 4); // 2..5
    const resp: Responsibility[] = [];
    const picks = new Set<string>();
    while (picks.size < respCount) {
      const name = RESP_NAMES[Math.floor(rng() * RESP_NAMES.length)] ?? "Core";
      picks.add(name);
    }
    // Share distribution: dirichlet-lite via normalized weights.
    const weights = Array.from({ length: respCount }, () => 0.3 + rng());
    const total = weights.reduce((a, b) => a + b, 0);
    const names = Array.from(picks);
    for (let i = 0; i < respCount; i++) {
      const wName = names[i] ?? "Core";
      const w = weights[i] ?? 1;
      resp.push({
        name: wName,
        symbolCount: 3 + Math.floor(rng() * 18),
        locShare: w / total,
      });
    }
    resp.sort((a, b) => b.locShare - a.locShare);

    const base = stripExt(entity.name);
    const ext = extOf(entity.name);
    const suggestedSplits = resp.map(r => `${base}.${r.name.toLowerCase().replace(/\s+/g, "-")}${ext}`);

    out.push({
      id: entity.id,
      name: entity.name,
      path: entity.path,
      loc,
      responsibilityCount: respCount,
      responsibilities: resp,
      suggestedSplits,
    });
  }

  out.sort((a, b) => b.loc - a.loc);
  return out;
}

function computeMaxLoc(rows: GodRow[]): number {
  let m = LOC_THRESHOLD;
  for (const r of rows) if (r.loc > m) m = r.loc;
  return m;
}

// ── LoC bar ───────────────────────────────────────────────────────────

function LocBar({ loc, max, mounted, delayMs }: { loc: number; max: number; mounted: boolean; delayMs: number }) {
  const pct = Math.min(1, loc / max);
  return (
    <div
      style={{
        width: 120,
        height: 6,
        borderRadius: radius.pill,
        background: tokenColor.bg3,
        overflow: "hidden",
        flexShrink: 0,
      }}
      title={`${loc.toLocaleString()} LoC`}
    >
      <div
        style={{
          height: "100%",
          width: mounted ? `${pct * 100}%` : "0%",
          borderRadius: radius.pill,
          background: tokenColor.text1,
          transition: `width 600ms ease-out ${delayMs}ms`,
        }}
      />
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────

interface RowProps {
  row: GodRow;
  rank: number;
  staggerMs: number;
  maxLoc: number;
  mounted: boolean;
  onFocus?: () => void;
}

function GodRowView({ row, rank, staggerMs, maxLoc, mounted, onFocus }: RowProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const wrapStyle: CSSProperties = {
    borderBottom: `1px solid ${tokenColor.borderSoft}`,
    animation: `gfv-rowIn 380ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    animationDelay: `${staggerMs}ms`,
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    background: hovered || expanded ? tokenColor.bg3 : "transparent",
    cursor: "pointer",
    transition: `background ${transition.base}`,
  };

  const rankStyle: CSSProperties = {
    width: 28,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: tokenColor.text3,
    flexShrink: 0,
    textAlign: "right",
  };

  const nameStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
  };

  const locLabelStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    width: 64,
    textAlign: "right",
  };

  const respPillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    border: `1px solid ${tokenColor.border}`,
    color: tokenColor.text1,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };

  const arrowStyle: CSSProperties = {
    fontSize: font.size.sm,
    color: tokenColor.text3,
    flexShrink: 0,
    userSelect: "none",
  };

  const splitCountStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };

  const caretStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    transition: `transform ${transition.base}`,
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    flexShrink: 0,
    marginLeft: "auto",
  };

  const expandBodyStyle: CSSProperties = {
    padding: `${space[2]}px ${space[6]}px ${space[3]}px 60px`,
    background: tokenColor.bg2,
    fontSize: font.size.xs,
    color: tokenColor.text1,
    display: "flex",
    flexDirection: "column",
    gap: space[2],
  };

  return (
    <div style={wrapStyle}>
      <div
        style={rowStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setExpanded(v => !v)}
        onDoubleClick={() => onFocus?.()}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(v => !v);
          }
        }}
      >
        <span style={rankStyle}>#{rank}</span>
        <span style={nameStyle} title={row.path}>
          {row.name}
        </span>
        <LocBar loc={row.loc} max={maxLoc} mounted={mounted} delayMs={staggerMs} />
        <span style={locLabelStyle}>{row.loc.toLocaleString()} LoC</span>
        <span style={respPillStyle}>책임 추정 {row.responsibilityCount}개</span>
        <span style={arrowStyle} aria-hidden>
          →
        </span>
        <span style={splitCountStyle}>{row.suggestedSplits.length}개 파일</span>
        <span style={caretStyle} aria-hidden>
          ▼
        </span>
      </div>
      {expanded && (
        <div style={expandBodyStyle}>
          <div
            style={{
              fontSize: font.size.xxs,
              fontWeight: font.weight.semibold,
              color: tokenColor.text3,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Sub-cluster groups
          </div>
          {row.responsibilities.map((r, i) => (
            <ResponsibilityLine
              key={r.name}
              resp={r}
              suggestedName={row.suggestedSplits[i] ?? r.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResponsibilityLine({
  resp,
  suggestedName,
}: {
  resp: Responsibility;
  suggestedName: string;
}) {
  const barStyle: CSSProperties = {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    overflow: "hidden",
    minWidth: 48,
  };
  const fillStyle: CSSProperties = {
    height: "100%",
    width: `${Math.round(resp.locShare * 100)}%`,
    borderRadius: radius.pill,
    background: tokenColor.text2,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
      <span
        style={{
          fontWeight: font.weight.semibold,
          color: tokenColor.text0,
          minWidth: 90,
          flexShrink: 0,
        }}
      >
        {resp.name}
      </span>
      <span style={{ color: tokenColor.text2, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {resp.symbolCount} symbols
      </span>
      <div style={barStyle}>
        <div style={fillStyle} />
      </div>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: tokenColor.text2,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 220,
        }}
        title={suggestedName}
      >
        → {suggestedName}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────

function GodFileViewImpl({ tree, onFocusEntity, onDismiss }: GodFileViewProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);
  const rows = useMemo(() => buildRows(tree), [tree]);
  const maxLoc = useMemo(() => computeMaxLoc(rows), [rows]);

  useEffect(() => {
    injectStyles();
    const r = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    fontFamily: font.sans,
    animation: mounted
      ? `gfv-enter 500ms cubic-bezier(0.22, 1, 0.28, 1) both`
      : undefined,
    opacity: mounted ? 1 : 0,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    padding: `${space[3]}px ${space[6]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    lineHeight: 1.2,
  };
  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    lineHeight: 1,
  };
  const dismissStyle: CSSProperties = {
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: dismissHovered ? tokenColor.text0 : tokenColor.text2,
    background: dismissHovered ? tokenColor.hover : "transparent",
    fontSize: font.size.md,
    borderRadius: radius.sm,
    border: `1px solid ${dismissHovered ? tokenColor.borderStrong : "transparent"}`,
    padding: 0,
    lineHeight: 1,
    transition: `background ${transition.base}, color ${transition.base}, border-color ${transition.base}`,
  };
  const countChipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    border: `1px solid ${tokenColor.border}`,
    fontSize: font.size.xxs,
    color: tokenColor.text1,
    fontWeight: font.weight.medium,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  };
  const scrollStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
  };
  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    color: tokenColor.text2,
    padding: space[4],
    textAlign: "center",
    fontSize: font.size.sm,
  };

  return (
    <div style={rootStyle} role="region" aria-label="God files">
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>God Files</span>
          <span style={subtitleStyle}>신(神)급 파일 — 너무 많은 책임</span>
        </div>
        <span style={countChipStyle}>
          {rows.length.toLocaleString()}개 파일
        </span>
        {onDismiss !== undefined && (
          <button
            style={dismissStyle}
            aria-label="Dismiss"
            title="Dismiss"
            onClick={onDismiss}
            onMouseEnter={() => setDismissHovered(true)}
            onMouseLeave={() => setDismissHovered(false)}
          >
            ×
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={emptyStyle}>
          <span>너무 커진 파일이 없어요.</span>
          <span style={{ fontSize: font.size.xs, color: tokenColor.text3 }}>
            모든 파일이 {LOC_THRESHOLD} LoC 이하입니다.
          </span>
        </div>
      ) : (
        <div style={scrollStyle}>
          {rows.map((row, i) => (
            <GodRowView
              key={row.id}
              row={row}
              rank={i + 1}
              staggerMs={Math.min(i, 24) * 20}
              maxLoc={maxLoc}
              mounted={mounted}
              onFocus={onFocusEntity ? () => onFocusEntity(row.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const GodFileView = memo(GodFileViewImpl);
