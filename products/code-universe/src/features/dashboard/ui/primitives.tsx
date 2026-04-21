// Dashboard UI primitives
// --------------------------------------------------------------------
// Shared building blocks: Section, MetricCard, ConfidenceChip, Sparkline,
// EmptyState, ScoreRing. All inline-styled to match the rest of the
// product — no CSS modules, no class names.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
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
  right?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section style={SECTION_WRAP}>
      <header style={SECTION_HEADER}>
        <div style={SECTION_TITLE_COL}>
          <h3 style={SECTION_TITLE}>{props.title}</h3>
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
  marginBottom: space[6],
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
  fontSize: font.size.xl,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
  color: color.text0,
};

const SECTION_CAPTION: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
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
        padding: small ? "1px 6px 1px 5px" : "2px 8px 2px 6px",
        borderRadius: radius.pill,
        fontSize: small ? 9.5 : font.size.xs,
        fontWeight: font.weight.semibold,
        letterSpacing: 0.3,
        color: s.fg,
        background: s.bg,
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
  gap: space[2],
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.xs,
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
  letterSpacing: font.letter.tight,
};

const CARD_VALUE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
  flexWrap: "wrap",
};

const CARD_VALUE: CSSProperties = {
  fontSize: 24,
  fontFamily: font.sans,
  letterSpacing: -0.5,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
};

const CARD_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.tight,
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
  background: color.bg2,
  border: `1px dashed ${color.border}`,
  borderRadius: radius.lg,
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
