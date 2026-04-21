// Dashboard UI primitives
// --------------------------------------------------------------------
// Shared building blocks: Section, MetricCard, ConfidenceChip, Sparkline,
// EmptyState, ScoreRing. All inline-styled to match the rest of the
// product — no CSS modules, no class names.
//
// Visual language — Google Cloud Console / Gemini dashboard:
//   - Pure white surface
//   - Flat cards: 1px subtle border, 16px radius, NO shadow
//   - Compact rounded-pill chips with a colored dot + label
//   - Large bold section titles, muted captions
// Every primitive here is the ground truth for the Dashboard tab
// surface; existing tabs (RepoHealthTab, GovernanceTab, ...) inherit
// these styles automatically.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { Confidence, Metric, Sentiment } from "../model/types";

// ── Shared palette ────────────────────────────────────────────────────

export const SENTIMENT_COLOR: Readonly<Record<Sentiment, string>> = {
  good: color.success,
  bad: color.danger,
  neutral: color.text2,
};

export const CONFIDENCE_STYLE: Readonly<Record<Confidence, { fg: string; bg: string; dot: string }>> = {
  HIGH: { fg: color.success, bg: "rgba(34, 160, 107, 0.10)", dot: color.success },
  MED:  { fg: color.warn,    bg: "rgba(224, 147, 33, 0.12)", dot: color.warn },
  LOW:  { fg: color.text2,   bg: "rgba(117, 117, 117, 0.10)", dot: color.text3 },
};

export function bucketColor(bucket: "low" | "medium" | "high"): string {
  if (bucket === "low") return color.success;
  if (bucket === "medium") return color.warn;
  return color.danger;
}

// ── Section (title row + body) ────────────────────────────────────────

export function Section(props: {
  title: string;
  caption?: string;
  info?: string;
  right?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section style={SECTION_WRAP}>
      <header style={SECTION_HEADER}>
        <div style={SECTION_TITLE_COL}>
          <h3 style={SECTION_TITLE}>
            {props.title}
            {props.info ? <InfoIcon title={props.info} /> : null}
          </h3>
          {props.caption ? <span style={SECTION_CAPTION}>{props.caption}</span> : null}
        </div>
        {props.right ? <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>{props.right}</div> : null}
      </header>
      <div>{props.children}</div>
    </section>
  );
}

const SECTION_WRAP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  marginBottom: space[7],
};

const SECTION_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: space[3],
};

const SECTION_TITLE_COL: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const SECTION_TITLE: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: font.weight.semibold,
  letterSpacing: -0.2,
  color: color.text0,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const SECTION_CAPTION: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text2,
  letterSpacing: 0,
  lineHeight: 1.45,
};

// ── Confidence chip ───────────────────────────────────────────────────

export function ConfidenceChip(props: {
  confidence: Confidence;
  reason?: string;
  size?: "sm" | "md";
}): ReactElement {
  const s = CONFIDENCE_STYLE[props.confidence];
  const small = props.size === "sm" || !props.size;
  return (
    <span
      title={props.reason}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: small ? "1px 8px 1px 7px" : "2px 10px 2px 8px",
        borderRadius: radius.pill,
        fontSize: small ? 10 : font.size.xs,
        fontWeight: font.weight.semibold,
        letterSpacing: 0.2,
        color: s.fg,
        background: "transparent",
        border: `1px solid ${color.border}`,
        cursor: props.reason ? "help" : "default",
        textTransform: "uppercase",
        fontFamily: font.sans,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: s.dot }} />
      {props.confidence}
    </span>
  );
}

// ── Tier chip (Gemini-style blue-dot pill) ──────────────────────────
// Small rounded-pill badge that attaches to a title, e.g. `Tier 1`,
// `ACTIVE`, `BETA`. Accent-colored dot + label inside a neutral
// bordered pill. Ship this wherever a compact status indicator reads
// naturally next to prose.

export function TierChip(props: {
  label: string;
  accent?: string;
}): ReactElement {
  const a = props.accent ?? color.accent;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px 2px 8px",
        borderRadius: radius.pill,
        border: `1px solid ${color.border}`,
        background: "#ffffff",
        fontSize: font.size.xs,
        fontWeight: font.weight.medium,
        color: color.text1,
        letterSpacing: 0.1,
        fontFamily: font.sans,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: a }} />
      {props.label}
    </span>
  );
}

// ── Info icon (ⓘ) ────────────────────────────────────────────────────
// Inline help affordance shown next to section titles in the Gemini
// Console. Pure SVG so the size stays crisp at every zoom.

export function InfoIcon(props: { title?: string }): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      aria-hidden={!props.title}
      role={props.title ? "img" : undefined}
      style={{ color: color.text3, flexShrink: 0 }}
    >
      {props.title ? <title>{props.title}</title> : null}
      <circle cx={7} cy={7} r={6.25} fill="none" stroke="currentColor" strokeWidth={1.1} />
      <circle cx={7} cy={4.2} r={0.9} fill="currentColor" />
      <rect x={6.35} y={5.9} width={1.3} height={4.2} rx={0.6} fill="currentColor" />
    </svg>
  );
}

// ── Progress bar (Gemini usage track) ───────────────────────────────
// Thin pill-shaped bar with a dark leading segment representing usage
// against a limit. When `value/limit` is tiny, we render a small
// solid dot on the left instead of a hairline — matches the console's
// "●━━━━━━━━  2 / 2K" readout.

export function ProgressBar(props: {
  value: number;
  limit: number;
  width?: number;
  tone?: "default" | "danger" | "success";
}): ReactElement {
  const w = props.width ?? 180;
  const h = 6;
  const ratio = props.limit > 0 ? Math.max(0, Math.min(1, props.value / props.limit)) : 0;
  const filled = Math.max(ratio * w, ratio > 0 ? 8 : 0);
  const fill =
    props.tone === "danger" ? color.danger :
    props.tone === "success" ? color.success :
    color.text0;
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        borderRadius: radius.pill,
        background: color.bg3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: filled,
          height: h,
          borderRadius: radius.pill,
          background: fill,
          transition: "width 280ms ease-out",
        }}
      />
    </div>
  );
}

// ── Limit chart (axis with red dashed threshold) ────────────────────
// Single-metric card body: label + big Y scale on right + horizontal
// red dashed line at `limit` with a `Limit` pill at its left tip.
// Used for the "비율 제한 분류" / rate-limit slots in the dashboard.

export function LimitChart(props: {
  value: number;
  limit: number;
  height?: number;
  formatValue?: (v: number) => string;
}): ReactElement {
  const h = props.height ?? 200;
  const fmt = props.formatValue ?? ((v: number) => v.toLocaleString());
  // Scale: axis goes from 0 to max(value, limit*2) so the limit line
  // lands around mid-height when usage is well below it.
  const top = Math.max(props.value, props.limit * 2, 1);
  const limitY = h - (props.limit / top) * h;
  return (
    <div style={{ position: "relative", width: "100%", height: h }}>
      {/* Top gridline + label */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, borderTop: `1px solid ${color.border}` }} />
      <div style={{ position: "absolute", top: -8, right: 0, fontSize: font.size.sm, color: color.text1, fontVariantNumeric: "tabular-nums" }}>
        {fmt(top)}
      </div>
      {/* Limit line */}
      <div
        style={{
          position: "absolute",
          top: limitY,
          left: 0,
          right: 0,
          borderTop: `1.5px dashed ${color.danger}`,
        }}
      />
      <span
        style={{
          position: "absolute",
          top: limitY - 11,
          left: 0,
          padding: "2px 8px",
          borderRadius: 4,
          background: color.danger,
          color: "#ffffff",
          fontSize: 10,
          fontWeight: font.weight.semibold,
          letterSpacing: 0.3,
          lineHeight: 1.4,
          fontFamily: font.sans,
        }}
      >
        Limit
      </span>
      <div style={{ position: "absolute", top: limitY + 6, right: 0, fontSize: font.size.sm, color: color.text1, fontVariantNumeric: "tabular-nums" }}>
        {fmt(props.limit)}
      </div>
      {/* Baseline + 0 label */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, borderTop: `1px solid ${color.border}` }} />
      <div style={{ position: "absolute", bottom: -8, right: 0, fontSize: font.size.sm, color: color.text1, fontVariantNumeric: "tabular-nums" }}>
        0
      </div>
    </div>
  );
}

// ── Sparkline (tiny inline SVG) ───────────────────────────────────────

export function Sparkline(props: {
  points: readonly number[];
  color?: string;
  width?: number;
  height?: number;
}): ReactElement | null {
  const { points } = props;
  if (points.length < 2) return null;
  const w = props.width ?? 80;
  const h = props.height ?? 22;
  const n = points.length;
  const toX = (i: number): number => (i / (n - 1)) * w;
  const toY = (v: number): number => h - Math.max(0, Math.min(1, v)) * h;
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");
  const area = d + ` L${w.toFixed(1)},${h.toFixed(1)} L0,${h.toFixed(1)} Z`;
  const c = props.color ?? color.accent;
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-hidden="true">
      <path d={area} fill={c} fillOpacity={0.12} />
      <path d={d} fill="none" stroke={c} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Trend arrow ───────────────────────────────────────────────────────

export function TrendIndicator(props: {
  trend?: "up" | "down" | "flat";
  delta?: number;
  sentiment?: Sentiment;
}): ReactElement | null {
  if (props.trend === undefined || props.delta === undefined || props.delta === 0) return null;
  const arrow = props.trend === "up" ? "↑" : props.trend === "down" ? "↓" : "→";
  // Delta interpretation: if sentiment=bad, "up" is bad; if good, "up" is good. Default: neutral text.
  let fg: string = color.text2;
  if (props.sentiment === "bad") fg = props.trend === "up" ? color.danger : color.success;
  if (props.sentiment === "good") fg = props.trend === "up" ? color.success : color.danger;
  const delta = props.delta;
  const text = Number.isInteger(delta) ? `${delta > 0 ? "+" : ""}${delta}` : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      fontSize: 10,
      fontFamily: font.mono,
      fontWeight: font.weight.semibold,
      color: fg,
    }}>
      <span>{arrow}</span>
      <span>{text}</span>
    </span>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────

export function MetricCard(props: { metric: Metric; tone?: "default" | "accent" }): ReactElement {
  const m = props.metric;
  const isMissing = m.status === "missing";
  const valueColor = isMissing
    ? color.text3
    : m.sentiment
      ? SENTIMENT_COLOR[m.sentiment]
      : color.text0;

  const accent = props.tone === "accent";

  return (
    <div
      style={{
        ...CARD_BASE,
        background: accent ? `linear-gradient(135deg, ${color.accent}12 0%, ${color.accent}04 100%)` : color.bg1,
        borderColor: accent ? color.accentBorder : color.border,
        opacity: isMissing ? 0.75 : 1,
      }}
    >
      <div style={CARD_HEADER}>
        <span style={CARD_LABEL}>{m.label}</span>
        <ConfidenceChip confidence={m.confidence} reason={m.confidenceReason} />
      </div>

      <div style={CARD_VALUE_ROW}>
        <span
          style={{
            ...CARD_VALUE,
            color: valueColor,
            fontStyle: isMissing ? "italic" : "normal",
            fontWeight: isMissing ? font.weight.regular : font.weight.semibold,
          }}
        >
          {m.value}
        </span>
        <TrendIndicator trend={m.trend} delta={m.delta} sentiment={m.sentiment} />
        {m.sparkline && m.sparkline.length > 1 ? (
          <Sparkline
            points={m.sparkline}
            color={m.sentiment === "bad" ? color.danger : m.sentiment === "good" ? color.success : color.accent}
            width={64}
            height={18}
          />
        ) : null}
      </div>

      {isMissing ? (
        <div style={MISSING_HINT}>
          <span style={MISSING_DOT}>●</span>
          {m.enableHint ?? "Source not connected"}
        </div>
      ) : m.hint ? (
        <div style={CARD_HINT}>{m.hint}</div>
      ) : null}
    </div>
  );
}

const CARD_BASE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: `18px 20px 16px`,
  background: "#ffffff",
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  minWidth: 0,
};

const CARD_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const CARD_LABEL: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  color: color.text1,
  letterSpacing: 0,
};

const CARD_VALUE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
  flexWrap: "wrap",
};

const CARD_VALUE: CSSProperties = {
  fontSize: 28,
  fontFamily: font.sans,
  letterSpacing: -0.8,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
};

const CARD_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: 0,
  marginTop: 2,
};

const MISSING_HINT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
  fontStyle: "italic",
};

const MISSING_DOT: CSSProperties = {
  fontSize: 8,
  color: color.text3,
};

// ── Empty state ───────────────────────────────────────────────────────

export function EmptyState(props: { title: string; body?: string; action?: string }): ReactElement {
  return (
    <div style={EMPTY_WRAP}>
      <div style={EMPTY_ICON}>◌</div>
      <div style={EMPTY_TITLE}>{props.title}</div>
      {props.body ? <div style={EMPTY_BODY}>{props.body}</div> : null}
      {props.action ? <div style={EMPTY_ACTION}>{props.action}</div> : null}
    </div>
  );
}

const EMPTY_WRAP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  padding: `${space[7]}px ${space[4]}px`,
  background: "#ffffff",
  border: `1px dashed ${color.border}`,
  borderRadius: 12,
  color: color.text2,
  textAlign: "center",
};

const EMPTY_ICON: CSSProperties = {
  fontSize: 28,
  color: color.text3,
  lineHeight: 1,
};

const EMPTY_TITLE: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  color: color.text1,
  letterSpacing: font.letter.tight,
};

const EMPTY_BODY: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
  maxWidth: 420,
  lineHeight: 1.45,
};

const EMPTY_ACTION: CSSProperties = {
  marginTop: space[1],
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.accent,
  padding: `${space[1]}px ${space[3]}px`,
  background: color.accentSoft,
  borderRadius: radius.pill,
};

// ── Score ring ────────────────────────────────────────────────────────

export function ScoreRing(props: {
  score: number;          // 0..100
  bucket: "low" | "medium" | "high";
  label: string;
  sub?: string;
  size?: number;
}): ReactElement {
  const size = props.size ?? 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const clamp = Math.max(0, Math.min(100, props.score));
  const dash = (clamp / 100) * circ;
  const trackColor = "rgba(0,0,0,0.06)";
  const fillColor = bucketColor(props.bucket);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: space[1] }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 420ms cubic-bezier(0.2, 0, 0.1, 1), stroke 240ms" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 2,
        }}>
          <span style={{
            fontSize: 26, fontWeight: font.weight.bold, color: fillColor,
            letterSpacing: -0.8, fontVariantNumeric: "tabular-nums",
          }}>
            {Math.round(props.score)}
          </span>
          <span style={{
            fontSize: 9, fontWeight: font.weight.semibold, color: color.text3,
            letterSpacing: 0.6, textTransform: "uppercase",
          }}>
            / 100
          </span>
        </div>
      </div>
      <div style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text0, letterSpacing: font.letter.tight }}>
        {props.label}
      </div>
      {props.sub ? (
        <div style={{ fontSize: font.size.xs, color: color.text2, letterSpacing: font.letter.tight }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

// ── Horizontal bar (stacked %) ────────────────────────────────────────

export function StackedBar(props: {
  segments: readonly { label: string; value: number; color: string }[];
  height?: number;
}): ReactElement {
  const h = props.height ?? 8;
  const total = Math.max(1, props.segments.reduce((a, s) => a + s.value, 0));
  return (
    <div style={{ display: "flex", width: "100%", height: h, borderRadius: radius.pill, overflow: "hidden", background: color.bg3 }}>
      {props.segments.map((s, i) => {
        const pct = (s.value / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={`${s.label}-${i}`}
            title={`${s.label} · ${s.value}`}
            style={{ width: `${pct}%`, background: s.color, transition: "width 420ms" }}
          />
        );
      })}
    </div>
  );
}
