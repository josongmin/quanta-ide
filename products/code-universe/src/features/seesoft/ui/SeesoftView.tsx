// SeesoftView — line-strip atlas for every file.
// --------------------------------------------------------------------
// Each file becomes a thin vertical "strip" of 1-px-tall horizontal
// bars, one bar per line of code. The bar's color encodes whichever
// metric the user picked (age / complexity / author / churn). Strips
// are laid out left-to-right, wrapping to new rows when viewport
// width runs out.
//
// Reference: Eick, Steffen, Sumner.
// "SeeSoft — A Tool for Visualizing Line-Oriented Software Statistics",
// IEEE TSE 1992.
//
// Why HTML/CSS not SVG:
//   - O(files × lines) can cross 50k elements on a big repo; DOM nodes
//     are cheap per-row when rendered as CSS linear-gradients (one div
//     per strip, gradient stops per line). 50 files × 300 lines ends
//     up being ~50 gradients, not 15 000 rects.
//
// Animation: strips fade/scale in row-by-row so the atlas reads as a
// sweep rather than a single flash.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  authorHue,
  hashId,
  primaryAuthor,
  seeded,
} from "../../../shared/analytics/synth-metrics";

type Metric = "age" | "complexity" | "author" | "churn";

const METRICS: ReadonlyArray<{ id: Metric; label: string; hint: string }> = [
  { id: "age",        label: "age",        hint: "line age — old → dark" },
  { id: "complexity", label: "complexity", hint: "cyclomatic spike rows" },
  { id: "author",     label: "author",     hint: "per-line author hue" },
  { id: "churn",      label: "churn",      hint: "edits last 90d" },
];

const STRIP_W = 5;           // px — one strip = one file
const STRIP_GAP = 1;         // px between strips
const GROUP_GAP = 12;        // px between wrap rows
const MAX_LINES = 300;
const MIN_LINES = 30;

interface Strip {
  id: string;
  name: string;
  path: string;
  lineColors: string[];      // per-line CSS color, top→bottom
  loc: number;
}

const KEYFRAMES = `
@keyframes seesoftEnter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes seesoftRow {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes seesoftStrip {
  0%   { opacity: 0; transform: scaleY(0.2); }
  100% { opacity: 1; transform: scaleY(1); }
}
`;

export interface SeesoftViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
  selectedId: string | null;
}

function SeesoftViewImpl({ tree, onFocusEntity, selectedId }: SeesoftViewProps): ReactElement {
  const [metric, setMetric] = useState<Metric>("age");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.seesoftKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const strips = useMemo<Strip[]>(() => {
    const files = Array.from(tree.byId.values())
      .filter(e => e.kind === "building")
      .sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0));
    return files.map(f => buildStrip(f, metric));
  }, [tree, metric]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Seesoft</div>
          <div style={subtitleStyle}>
            line-oriented statistics · Eick, Steffen, Sumner TSE 1992
          </div>
        </div>

        <div style={metricChipsStyle} role="tablist" aria-label="metric">
          {METRICS.map(m => {
            const active = metric === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(m.id)}
                title={m.hint}
                style={{
                  ...chipStyle,
                  ...(active ? chipActiveStyle : null),
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </header>

      <div style={atlasWrapStyle}>
        {strips.length === 0 ? (
          <div style={emptyStyle}>데이터가 아직 없어요</div>
        ) : (
          <div style={atlasStyle}>
            {strips.map((s, i) => {
              const stripBg = stripGradient(s.lineColors);
              const isHovered = hoveredId === s.id;
              const isSelected = selectedId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onFocusEntity?.(s.id)}
                  title={`${s.path} · ${s.loc} LoC`}
                  style={{
                    width: STRIP_W,
                    flex: `0 0 ${STRIP_W}px`,
                    marginRight: STRIP_GAP,
                    marginBottom: GROUP_GAP,
                    padding: 0,
                    border: "none",
                    borderRadius: 1,
                    height: 260,
                    background: stripBg,
                    cursor: "pointer",
                    position: "relative",
                    transformOrigin: "center top",
                    transform:
                      isHovered || isSelected ? "scaleX(2.2)" : "scaleX(1)",
                    transition:
                      "transform 180ms cubic-bezier(0.22, 1, 0.28, 1), filter 180ms ease-out",
                    filter: isSelected
                      ? `drop-shadow(0 0 0 1px ${color.accent}) drop-shadow(0 2px 4px rgba(13,153,255,0.35))`
                      : "none",
                    animation: `seesoftStrip 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${Math.min(i * 14, 1200)}ms`,
                    outline: isSelected ? `1px solid ${color.accent}` : "none",
                  }}
                />
              );
            })}
          </div>
        )}

        {hoveredId && (
          <HoverCard
            strip={strips.find(s => s.id === hoveredId)}
            metric={metric}
          />
        )}
      </div>

      <Legend metric={metric} />
    </div>
  );
}

// ── Hover card ────────────────────────────────────────────────────────
function HoverCard({
  strip,
  metric,
}: {
  strip: Strip | undefined;
  metric: Metric;
}) {
  if (!strip) return null;
  return (
    <div style={hoverCardStyle}>
      <div style={{ fontWeight: font.weight.semibold, fontSize: font.size.sm }}>
        {strip.name}
      </div>
      <div style={{ color: color.text2, fontSize: font.size.xxs, marginTop: 2 }}>
        {strip.path}
      </div>
      <div
        style={{
          display: "flex",
          gap: space[3],
          marginTop: space[2],
          fontSize: font.size.xxs,
          color: color.text1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{strip.loc} LoC</span>
        <span style={{ color: color.text3 }}>· metric: {metric}</span>
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────
function Legend({ metric }: { metric: Metric }) {
  const swatches: { c: string; label: string }[] =
    metric === "age"
      ? [
          { c: color.bg3,          label: "new" },
          { c: "#8b8f97",          label: "…" },
          { c: color.kindBuilding, label: "old" },
        ]
      : metric === "complexity"
      ? [
          { c: color.bg3, label: "flat" },
          { c: "#f1a557", label: "…" },
          { c: color.danger, label: "spike" },
        ]
      : metric === "churn"
      ? [
          { c: color.bg2, label: "calm" },
          { c: "#9ecdff", label: "…" },
          { c: color.accent, label: "hot" },
        ]
      : [
          { c: hslFor(20),  label: "jo" },
          { c: hslFor(140), label: "kim" },
          { c: hslFor(220), label: "lee" },
          { c: hslFor(290), label: "park" },
        ];
  return (
    <div style={legendRowStyle}>
      {swatches.map((s, i) => (
        <span key={i} style={legendItemStyle}>
          <span
            style={{
              width: 10,
              height: 10,
              background: s.c,
              borderRadius: 2,
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          />
          <span>{s.label}</span>
        </span>
      ))}
    </div>
  );
}

// ── Data / colour helpers ─────────────────────────────────────────────
function buildStrip(entity: Entity, metric: Metric): Strip {
  const loc = Math.max(
    MIN_LINES,
    Math.min(MAX_LINES, entity.metrics?.loc ?? 60),
  );
  const lineColors: string[] = [];
  for (let i = 0; i < loc; i++) {
    const v = seeded(entity.id, `line-${i}`)();
    lineColors.push(colorFor(entity, metric, v, i));
  }
  return {
    id: entity.id,
    name: entity.name,
    path: entity.path,
    lineColors,
    loc,
  };
}

function colorFor(entity: Entity, metric: Metric, v: number, i: number): string {
  switch (metric) {
    case "age":
      // v is a seeded 0..1. Older (high v) → kindBuilding dark; newer → bg3.
      return mix(color.bg3, color.kindBuilding, Math.pow(v, 0.9));
    case "complexity":
      return mix("#f2f2f2", color.danger, Math.pow(v, 1.4));
    case "churn":
      return mix(color.bg2, color.accent, Math.pow(v, 1.2));
    case "author": {
      // Occasional author switch within a file.
      const bucket = Math.floor(
        seeded(entity.id, `auth-${Math.floor(i / 15)}`)() * 7,
      );
      const pa = primaryAuthor(entity);
      const authors = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi"];
      const author = bucket === 0 ? pa : authors[bucket % authors.length]!;
      return hslFor(authorHue(author));
    }
  }
}

function hslFor(h: number): string {
  return `hsl(${h} 68% 62%)`;
}

/** Stack the per-line colours into a single CSS linear-gradient so the
 *  whole strip is one DOM node. Each colour occupies 1/N of the strip. */
function stripGradient(lines: string[]): string {
  const n = lines.length;
  const step = 100 / n;
  const stops: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * step).toFixed(3);
    const b = ((i + 1) * step).toFixed(3);
    stops.push(`${lines[i]} ${a}% ${b}%`);
  }
  return `linear-gradient(to bottom, ${stops.join(", ")})`;
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Accept #rgb, #rrggbb, rgb(...)
  if (hex.startsWith("#")) {
    const v = hex.slice(1);
    if (v.length === 3) {
      const r = parseInt(v[0]! + v[0]!, 16);
      const g = parseInt(v[1]! + v[1]!, 16);
      const b = parseInt(v[2]! + v[2]!, 16);
      return { r, g, b };
    }
    if (v.length === 6) {
      return {
        r: parseInt(v.slice(0, 2), 16),
        g: parseInt(v.slice(2, 4), 16),
        b: parseInt(v.slice(4, 6), 16),
      };
    }
  }
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(hex);
  if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]! };
  return null;
}

// ── Styles ────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: color.bg0,
  padding: `${space[6]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  color: color.text0,
  animation: "seesoftEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: space[4],
  gap: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  marginTop: space[1],
};

const metricChipsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  padding: `${space[1]}px`,
  background: color.bg2,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
};

const chipStyle: CSSProperties = {
  padding: `${space[1]}px ${space[3]}px`,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  color: color.text2,
  background: "transparent",
  border: "none",
  borderRadius: radius.pill,
  cursor: "pointer",
  fontFamily: font.sans,
  transition: "background 180ms ease-out, color 180ms ease-out",
};

const chipActiveStyle: CSSProperties = {
  background: color.bg0,
  color: color.text0,
  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
};

const atlasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: space[3],
  background: color.bg2,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  position: "relative",
};

const atlasStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  animation: "seesoftRow 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  color: color.text3,
  fontSize: font.size.md,
  padding: space[7],
  textAlign: "center",
};

const hoverCardStyle: CSSProperties = {
  position: "absolute",
  top: space[3],
  right: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  pointerEvents: "none",
  maxWidth: 280,
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  gap: space[4],
  marginTop: space[3],
  fontSize: font.size.xxs,
  color: color.text2,
};

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

// Unused but exported for future uses (hashId reference kept for
// callers that might want a per-file deterministic stripe ordering
// later — the strip id already anchors determinism).
void hashId;

export const SeesoftView = memo(SeesoftViewImpl);
