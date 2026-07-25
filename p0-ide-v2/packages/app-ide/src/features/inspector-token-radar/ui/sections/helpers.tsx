import type { Tier, RunStatus, AgentRole, EfficiencyGrade, RightSizingScore } from "@quanta/app-ide/entities/token-radar";

/* ─── Number / time formatters ─────────────────────────────── */

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function fmtUsd(n: number, opts?: { showCents?: boolean }): string {
  const showCents = opts?.showCents ?? n < 100;
  if (showCents) return `$${n.toFixed(n < 1 ? 2 : 1)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function fmtKb(n: number): string {
  if (n >= 1024) return `${(n / 1024).toFixed(1)} MB`;
  return `${n} KB`;
}

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function fmtPct(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

export function fmtPctNum(n: number, decimals = 0): string {
  return `${n.toFixed(decimals)}%`;
}

export function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function fmtRel(iso: string, nowIso?: string): string {
  const then = Date.parse(iso);
  const now = nowIso ? Date.parse(nowIso) : Date.now();
  if (!Number.isFinite(then) || !Number.isFinite(now)) return iso;
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ─── Status / role labels ─────────────────────────────────── */

export const STATUS_LABEL: Record<RunStatus, string> = {
  running: "running",
  merged:  "merged",
  failed:  "failed",
  stuck:   "stuck",
  paused:  "paused",
};

export function statusToneCls(s: RunStatus): string {
  switch (s) {
    case "merged":  return "tr-pane__pill--ok";
    case "running": return "tr-pane__pill--info";
    case "paused":  return "tr-pane__pill--warn";
    case "stuck":   return "tr-pane__pill--warn";
    case "failed":  return "tr-pane__pill--bad";
  }
}

export const ROLE_LABEL: Record<AgentRole, string> = {
  orchestrator: "orch",
  planner:      "plan",
  coder:        "coder",
  reviewer:     "review",
  tester:       "test",
  fixer:        "fix",
  summarizer:   "sum",
  security:     "security",
  doc:          "doc",
};

export function roleAccentCls(r: AgentRole): string {
  switch (r) {
    case "orchestrator": return "tr-pane__role--orch";
    case "planner":      return "tr-pane__role--plan";
    case "coder":        return "tr-pane__role--coder";
    case "reviewer":     return "tr-pane__role--review";
    case "tester":       return "tr-pane__role--test";
    case "fixer":        return "tr-pane__role--fix";
    case "summarizer":   return "tr-pane__role--sum";
    case "security":     return "tr-pane__role--sec";
    case "doc":          return "tr-pane__role--doc";
  }
}

export function gradeToneCls(g: EfficiencyGrade | RightSizingScore): string {
  switch (g) {
    case "A": return "tr-pane__grade--ok";
    case "B": return "tr-pane__grade--ok";
    case "C": return "tr-pane__grade--warn";
    case "D": return "tr-pane__grade--bad";
    case "F": return "tr-pane__grade--bad";
  }
}

/* ─── Tier badge ───────────────────────────────────────────── */

export function TierBadge({ tier }: { tier: Tier }) {
  const label = tier === "t1" ? "T1" : tier === "t2" ? "T2" : "T3";
  return (
    <span className={`tr-pane__tier tr-pane__tier--${tier}`} aria-label={`tier ${label}`}>
      {label}
    </span>
  );
}

/* ─── Section header ───────────────────────────────────────── */

export function SectionTitle({
  tier,
  title,
  hint,
  badge,
  badgeTone,
}: {
  tier: Tier;
  title: string;
  hint?: string;
  badge?: string;
  badgeTone?: "ok" | "warn" | "bad" | "info";
}) {
  return (
    <div className="tr-pane__section-h">
      <TierBadge tier={tier} />
      <span className="tr-pane__section-title">{title}</span>
      {hint && <span className="tr-pane__section-hint">{hint}</span>}
      {badge !== undefined && (
        <span className={`tr-pane__section-badge${badgeTone ? ` tr-pane__section-badge--${badgeTone}` : ""}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─── Mini sparkline ───────────────────────────────────────── */

export function Sparkline({
  values,
  width = 120,
  height = 28,
  toneCls,
  filled = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  toneCls: string;
  filled?: boolean;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const stepX = values.length === 1 ? 0 : (width - 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = 1 + i * stepX;
    const y = 1 + (1 - v / max) * (height - 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyPoints = pts.join(" ");
  const areaD = filled
    ? `M ${pts[0]} L ${pts.slice(1).join(" L ")} L ${(width - 1).toFixed(2)},${(height - 1).toFixed(2)} L 1,${(height - 1).toFixed(2)} Z`
    : "";

  return (
    <svg className="tr-pane__spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <line className="tr-pane__spark-base" x1={1} x2={width - 1} y1={height - 1} y2={height - 1} />
      {filled && <path className={`tr-pane__spark-area ${toneCls}`} d={areaD} />}
      <polyline className={`tr-pane__spark-line ${toneCls}`} points={polyPoints} />
    </svg>
  );
}

/* ─── Mini donut ───────────────────────────────────────────── */

export function MiniDonut({
  slices,
  size = 96,
  stroke = 14,
}: {
  slices: { value: number; toneCls: string; label: string }[];
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;

  let acc = 0;
  return (
    <svg className="tr-pane__donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="distribution">
      <circle className="tr-pane__donut-track" cx={cx} cy={cy} r={r} strokeWidth={stroke} />
      {slices.map((s, i) => {
        const dash = (s.value / total) * circ;
        const offset = -((acc / total) * circ);
        acc += s.value;
        return (
          <circle
            key={i}
            className={`tr-pane__donut-arc ${s.toneCls}`}
            cx={cx}
            cy={cy}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
            strokeDashoffset={offset.toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`}
          >
            <title>{`${s.label} ${((s.value / total) * 100).toFixed(0)}%`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/* ─── Stacked horizontal bar (for flamegraph row) ─────────── */

export function StackBar({
  segments,
}: {
  segments: { share: number; toneCls: string; label: string; tooltip?: string }[];
}) {
  return (
    <div className="tr-pane__stackbar" role="group" aria-label="stacked share">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`tr-pane__stackbar-seg ${seg.toneCls}`}
          style={{ width: `${(seg.share * 100).toFixed(2)}%` }}
          title={seg.tooltip ?? `${seg.label} · ${(seg.share * 100).toFixed(0)}%`}
        >
          {seg.share >= 0.10 && <span className="tr-pane__stackbar-label">{seg.label}</span>}
        </div>
      ))}
    </div>
  );
}

/* ─── Linear bar (single share) ────────────────────────────── */

export function LinearBar({
  value,
  toneCls,
  height = 6,
}: {
  /** 0..1 */
  value: number;
  toneCls: string;
  height?: number;
}) {
  return (
    <div className="tr-pane__bar" style={{ height }}>
      <div
        className={`tr-pane__bar-fill ${toneCls}`}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height }}
      />
    </div>
  );
}
