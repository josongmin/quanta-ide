import { useState } from "react";
import {
  DollarSign,
  Coins,
  Activity,
  Gauge,
  AlertTriangle,
  Flame,
  TrendingUp,
  Sparkles,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { AreaChart } from "../../internal/AreaChart";
import { Sparkline } from "../../internal/Sparkline";
import { StatCard } from "../../internal/StatCard";

type Range = "7d" | "30d" | "MTD" | "YTD";
const RANGES: Range[] = ["7d", "30d", "MTD", "YTD"];

function series(n: number, seed: number, amp = 0.7, base = 0.2) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(base + (s / 233280) * amp);
  }
  return out;
}

const spendSeries   = series(30, 42, 0.75, 0.2);
const requestSeries = series(30, 7,  0.6,  0.3);
const avgSeries     = series(30, 18, 0.4,  0.4);

interface ModelBreakdownRow {
  model: string;
  vendor: "Anthropic" | "OpenAI" | "Google" | "Local";
  requests: string;
  tokensIn: string;
  tokensOut: string;
  cost: string;
  budget: number;
  budgetLabel: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  warn?: boolean;
}

const MODELS: ModelBreakdownRow[] = [
  { model: "claude-opus-4.7",   vendor: "Anthropic", requests: "24,812", tokensIn: "14.2", tokensOut: "3.8",  cost: "$612.44", budget: 92, budgetLabel: "$612 / $660",   delta: "+34%", deltaTone: "down", warn: true },
  { model: "claude-sonnet-4.6", vendor: "Anthropic", requests: "58,914", tokensIn: "12.8", tokensOut: "2.4",  cost: "$394.12", budget: 71, budgetLabel: "$394 / $555",   delta: "+6%",  deltaTone: "down" },
  { model: "gpt-5",             vendor: "OpenAI",    requests: "21,422", tokensIn: "9.2",  tokensOut: "2.1",  cost: "$284.90", budget: 58, budgetLabel: "$285 / $490",   delta: "+12%", deltaTone: "down" },
  { model: "gemini-2.5-pro",    vendor: "Google",    requests: "12,108", tokensIn: "6.1",  tokensOut: "1.5",  cost: "$198.24", budget: 84, budgetLabel: "$198 / $235",   delta: "-3%",  deltaTone: "up",   warn: true },
  { model: "gpt-5-mini",        vendor: "OpenAI",    requests: "14,212", tokensIn: "3.4",  tokensOut: "0.9",  cost: "$162.06", budget: 41, budgetLabel: "$162 / $395",   delta: "-8%",  deltaTone: "up" },
  { model: "claude-haiku-4.5",  vendor: "Anthropic", requests: "9,820",  tokensIn: "1.8",  tokensOut: "0.4",  cost: "$118.55", budget: 39, budgetLabel: "$119 / $305",   delta: "-2%",  deltaTone: "up" },
  { model: "qwen3-coder-32b",   vendor: "Local",     requests: "1,630",  tokensIn: "0.7",  tokensOut: "0.2",  cost: "$72.00",  budget: 24, budgetLabel: "compute · $72", delta: "—",    deltaTone: "neutral" },
];

const VENDOR_COLOR: Record<ModelBreakdownRow["vendor"], string> = {
  Anthropic: "#d97706",
  OpenAI:    "#10b981",
  Google:    "#2563eb",
  Local:     "var(--fg-muted)",
};

interface EngineRow {
  engine: string;
  cost: string;
  pct: number;
  series: number[];
}

const ENGINES: EngineRow[] = [
  { engine: "risk.score",          cost: "$612.80", pct: 33, series: series(14, 3) },
  { engine: "blast.radius",        cost: "$422.44", pct: 23, series: series(14, 8) },
  { engine: "behavior.diff",       cost: "$284.10", pct: 15, series: series(14, 11) },
  { engine: "taint.trace",         cost: "$214.02", pct: 12, series: series(14, 17) },
  { engine: "incidents.correlate", cost: "$172.55", pct: 9,  series: series(14, 19) },
];

interface MemberRow {
  name: string;
  cost: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  sparkColor?: string;
}

const MEMBERS: MemberRow[] = [
  { name: "Ada Lovelace",   cost: "$312.40", delta: "+18%", deltaTone: "down", sparkColor: "var(--accent)" },
  { name: "Alan Turing",    cost: "$241.80", delta: "+4%",  deltaTone: "neutral" },
  { name: "Grace Hopper",   cost: "$198.12", delta: "-6%",  deltaTone: "up" },
  { name: "Linus Torvalds", cost: "$142.60", delta: "-11%", deltaTone: "up" },
  { name: "Donald Knuth",   cost: "$101.80", delta: "+1%",  deltaTone: "neutral" },
];

const VENDOR_SHARES = [
  { vendor: "Anthropic", pct: 61, color: "#d97706" },
  { vendor: "OpenAI",    pct: 24, color: "#10b981" },
  { vendor: "Google",    pct: 11, color: "#2563eb" },
  { vendor: "Local",     pct: 4,  color: "var(--fg-muted)" },
];

interface AlertItem {
  tone: "warn" | "danger";
  icon: typeof AlertTriangle;
  title: string;
  desc: string;
  time: string;
}

const ALERTS: AlertItem[] = [
  { tone: "danger", icon: AlertTriangle, title: "Budget at 93% — auto-pause in 2 days",    desc: "Workspace ceiling $2,000 / month. Pause triggers read-only spend mode.", time: "now" },
  { tone: "warn",   icon: Flame,         title: "claude-opus-4.7 spike +210% today",        desc: "Originated from behavior.diff · agent trace pr_01HZK8Y1.",             time: "14m ago" },
  { tone: "warn",   icon: Activity,      title: "Anthropic latency elevated 400ms p95",     desc: "Fallbacks engaged for 2.1% of traffic · SLA still met.",               time: "1h ago" },
];

interface SuggestionRow {
  title: string;
  blurb: string;
  save: string;
  icon: typeof Lightbulb;
}

const SUGGESTIONS: SuggestionRow[] = [
  { icon: Lightbulb, title: "Route risk.score to haiku",        blurb: "97% of requests here finish under 800 tokens. Haiku handles those with ≥ 99% agreement.", save: "save $340/mo" },
  { icon: Sparkles,  title: "Enable embedding cache",           blurb: "Re-emits the same vectors 41% of the time. Cross-run cache at the workspace level.",      save: "save $180/mo" },
  { icon: Gauge,     title: "Drop o4 reasoning for behavior.diff", blurb: "Sonnet-4.6 is within 0.3σ on benchmarks and 4× cheaper on this workload.",            save: "save $95/mo" },
];

function VendorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }}
    />
  );
}

export function SpendDashboardPage() {
  const [range, setRange] = useState<Range>("MTD");

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="AI"
        title="AI spend"
        sub="Token consumption and cost across every model, engine, and member. Updated every 5 minutes."
      />
      <div className="demo-app__body">
        {/* Top section bar */}
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__title">Spend overview</span>
          <span className="demo-sectionbar__desc">MTD · April 1 – 19, 2026</span>
          <span className="demo-sectionbar__spacer" />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1h)",
              fontSize: "var(--fs-xs)",
              color: "var(--success)",
              fontWeight: "var(--fw-semibold)",
            }}
          >
            <TrendingUp size={12} strokeWidth={2} aria-hidden="true" />
            on track · est. end-of-period $2,104
          </span>
          <div className="demo-billing-toggle" style={{ marginBottom: 0 }}>
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={range === r ? "is-active" : ""}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-3)",
            marginBottom: "var(--space-5)",
          }}
        >
          <StatCard
            label="Total spend"
            value="$1,842.31"
            icon={<DollarSign size={12} strokeWidth={1.8} />}
            delta="+12% vs last period"
            deltaTone="down"
            chart={<AreaChart values={spendSeries} height={56} color="var(--accent)" />}
          />
          <StatCard
            label="Tokens used"
            value="48.2M / 80M"
            icon={<Coins size={12} strokeWidth={1.8} />}
            delta="60% of monthly cap"
            deltaTone="neutral"
            chart={
              <div className="demo-progress demo-progress--accent" style={{ marginTop: 4 }}>
                <div className="demo-progress__bar">
                  <div className="demo-progress__fill" style={{ width: "60%" }} />
                </div>
                <div className="demo-progress__meta">
                  <span>In</span>
                  <span>Out</span>
                </div>
              </div>
            }
          />
          <StatCard
            label="Requests"
            value="142,918"
            icon={<Activity size={12} strokeWidth={1.8} />}
            delta="+8%"
            deltaTone="down"
            chart={<Sparkline values={requestSeries} color="var(--accent-purple)" height={40} />}
          />
          <StatCard
            label="Avg cost / request"
            value="$0.0129"
            icon={<Gauge size={12} strokeWidth={1.8} />}
            delta="-3%"
            deltaTone="up"
            chart={<Sparkline values={avgSeries} height={40} />}
          />
        </div>

        {/* Big area chart: Spend by provider */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Spend by provider</div>
              <div className="demo-block__sub">Daily spend, stacked by vendor · USD</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span
              style={{
                fontSize: "var(--fs-10)",
                color: "var(--fg-subtle)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}
            >
              updated 14s ago
            </span>
          </header>
          <div className="demo-block__body">
            <AreaChart values={spendSeries} height={160} color="var(--accent)" />
            <div
              style={{
                marginTop: "var(--space-3)",
                paddingTop: "var(--space-3)",
                borderTop: "1px dashed var(--border)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "var(--space-3)",
              }}
            >
              {VENDOR_SHARES.map((v) => (
                <div key={v.vendor} style={{ display: "flex", alignItems: "center", gap: "var(--space-1h)" }}>
                  <VendorDot color={v.color} />
                  <span style={{ fontSize: "var(--fs-xs)", fontWeight: "var(--fw-medium)" }}>{v.vendor}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg-muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {v.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Breakdown by model */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Breakdown by model</div>
              <div className="demo-block__sub">Click a row to drill into per-hour usage</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button type="button" className="demo-btn demo-btn--ghost">Export CSV</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th style={{ textAlign: "right" }}>Requests</th>
                  <th style={{ textAlign: "right" }}>Tokens in (M)</th>
                  <th style={{ textAlign: "right" }}>Tokens out (M)</th>
                  <th style={{ textAlign: "right" }}>Cost</th>
                  <th>Budget</th>
                  <th style={{ textAlign: "right" }}>Δ vs avg</th>
                </tr>
              </thead>
              <tbody>
                {MODELS.map((m) => (
                  <tr key={m.model}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1h)" }}>
                        <VendorDot color={VENDOR_COLOR[m.vendor]} />
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-xs)",
                            fontWeight: "var(--fw-semibold)",
                          }}
                        >
                          {m.model}
                        </span>
                      </div>
                    </td>
                    <td className="is-num">{m.requests}</td>
                    <td className="is-num">{m.tokensIn}</td>
                    <td className="is-num">{m.tokensOut}</td>
                    <td className="is-num" style={{ fontWeight: "var(--fw-semibold)" }}>
                      {m.cost}
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <div
                        className={
                          m.warn
                            ? "demo-progress demo-progress--danger"
                            : m.budget > 70
                            ? "demo-progress demo-progress--warn"
                            : "demo-progress demo-progress--accent"
                        }
                      >
                        <div className="demo-progress__bar">
                          <div className="demo-progress__fill" style={{ width: `${m.budget}%` }} />
                        </div>
                        <div className="demo-progress__meta">
                          <span>{m.budgetLabel}</span>
                          <span>{m.budget}%</span>
                        </div>
                      </div>
                    </td>
                    <td
                      className="is-num"
                      style={{
                        color:
                          m.deltaTone === "up"   ? "var(--success)"
                        : m.deltaTone === "down" ? "var(--danger)"
                        :                          "var(--fg-muted)",
                        fontWeight: "var(--fw-medium)",
                      }}
                    >
                      {m.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top spenders: 2-col */}
        <div className="demo-grid-2">
          <div className="demo-block" style={{ margin: 0 }}>
            <header className="demo-block__head">
              <div>
                <div className="demo-block__title">Top engines</div>
                <div className="demo-block__sub">By cost this period</div>
              </div>
            </header>
            <div className="demo-block__body demo-block__body--flush">
              {ENGINES.map((e) => (
                <div
                  key={e.engine}
                  className="demo-row"
                  style={{ gridTemplateColumns: "minmax(0, 1fr) 88px auto auto", alignItems: "center" }}
                >
                  <div className="demo-row__primary">
                    <div
                      className="demo-row__title"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}
                    >
                      {e.engine}
                    </div>
                    <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
                      {e.pct}% of spend
                    </div>
                  </div>
                  <Sparkline values={e.series} width={88} height={22} color="var(--accent)" />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg)",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: "var(--fw-semibold)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {e.cost}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="demo-block" style={{ margin: 0 }}>
            <header className="demo-block__head">
              <div>
                <div className="demo-block__title">Top members</div>
                <div className="demo-block__sub">Heaviest spenders this period</div>
              </div>
            </header>
            <div className="demo-block__body demo-block__body--flush">
              {MEMBERS.map((m) => (
                <div
                  key={m.name}
                  className="demo-row"
                  style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto auto", alignItems: "center" }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--bg-muted)",
                      color: "var(--fg-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "var(--fs-10)",
                      fontWeight: "var(--fw-bold)",
                    }}
                  >
                    {m.name.split(" ").map((s) => s[0]).join("")}
                  </span>
                  <div className="demo-row__primary">
                    <div className="demo-row__title">{m.name}</div>
                    <div
                      style={{
                        fontSize: "var(--fs-10)",
                        color:
                          m.deltaTone === "up"   ? "var(--success)"
                        : m.deltaTone === "down" ? "var(--danger)"
                        :                          "var(--fg-subtle)",
                      }}
                    >
                      {m.delta} vs last week
                    </div>
                  </div>
                  <Sparkline values={series(7, m.name.length * 3)} width={68} height={20} color={m.sparkColor ?? "var(--fg-muted)"} />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-xs)",
                      fontWeight: "var(--fw-semibold)",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {m.cost}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Budget alerts */}
        <div className="demo-block" style={{ marginTop: "var(--space-5)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Alerts</div>
              <div className="demo-block__sub">Auto-resolves when spend or latency returns to baseline</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span className="demo-badge demo-badge--warn">3 active</span>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {ALERTS.map((a) => {
              const Icon = a.icon;
              const tone = a.tone === "danger" ? "demo-dot demo-dot--danger" : "demo-dot demo-dot--warn";
              return (
                <div
                  key={a.title}
                  className="demo-row"
                  style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto auto" }}
                >
                  <span className={tone} />
                  <div className="demo-row__primary">
                    <div
                      className="demo-row__title"
                      style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}
                    >
                      <Icon
                        size={12}
                        strokeWidth={2}
                        aria-hidden="true"
                        style={{ color: a.tone === "danger" ? "var(--danger)" : "var(--warn)" }}
                      />
                      {a.title}
                    </div>
                    <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>
                      {a.desc}
                    </div>
                  </div>
                  <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
                    {a.time}
                  </span>
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    style={{ height: 24, padding: "0 var(--space-2)", fontSize: "var(--fs-10)" }}
                  >
                    Investigate
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost optimization */}
        <div className="demo-sectionbar" style={{ marginTop: "var(--space-5)" }}>
          <span className="demo-sectionbar__title">Cost optimization</span>
          <span className="demo-sectionbar__desc">3 suggestions based on this period's traffic</span>
          <span className="demo-sectionbar__spacer" />
          <span
            style={{
              fontSize: "var(--fs-xs)",
              fontWeight: "var(--fw-semibold)",
              color: "var(--success)",
            }}
          >
            up to $615/mo savings available
          </span>
        </div>
        <div className="demo-grid-3">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="demo-catalog__card" style={{ cursor: "default" }}>
                <div className="demo-catalog__card-head">
                  <span className="demo-catalog__card-icon">
                    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="demo-catalog__card-cat">suggestion</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--fs-10)",
                      color: "var(--success)",
                      fontWeight: "var(--fw-bold)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.save}
                  </span>
                </div>
                <div className="demo-catalog__card-title">{s.title}</div>
                <div className="demo-catalog__card-blurb">{s.blurb}</div>
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <button
                    type="button"
                    className="demo-btn demo-btn--primary"
                    style={{ height: 26, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="demo-btn demo-btn--ghost"
                    style={{
                      height: 26,
                      padding: "0 var(--space-2h)",
                      fontSize: "var(--fs-10)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Details <ArrowRight size={11} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
