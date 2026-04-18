import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  Copy,
  GaugeCircle,
  GripVertical,
  Layers,
  LineChart,
  ListTree,
  Plus,
  Settings,
  Sparkles,
  Table2,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { AreaChart } from "../../internal/AreaChart";
import { Sparkline } from "../../internal/Sparkline";
import { StatCard } from "../../internal/StatCard";

type WidgetKind =
  | "stat"
  | "line"
  | "area"
  | "bar"
  | "table"
  | "list"
  | "heatmap"
  | "progress";

type PlacedWidget = {
  id: string;
  kind: WidgetKind;
  title: string;
  colSpan: number;
  rowSpan: number;
};

const LIBRARY: { kind: WidgetKind; label: string; icon: ReactNode }[] = [
  { kind: "stat",     label: "Stat tile",  icon: <GaugeCircle size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "line",     label: "Line chart", icon: <LineChart size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "area",     label: "Area chart", icon: <TrendingUp size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "bar",      label: "Bar chart",  icon: <BarChart3 size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "table",    label: "Table",      icon: <Table2 size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "list",     label: "List",       icon: <ListTree size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "heatmap",  label: "Heatmap",    icon: <Layers size={14} strokeWidth={1.7} aria-hidden="true" /> },
  { kind: "progress", label: "Progress",   icon: <Boxes size={14} strokeWidth={1.7} aria-hidden="true" /> },
];

const DATA_SOURCES = [
  { id: "usage",    name: "Usage metrics", hint: "42 series" },
  { id: "engines",  name: "Engines",       hint: "7 tables" },
  { id: "policies", name: "Policies",      hint: "18 tables" },
  { id: "tickets",  name: "Tickets",       hint: "3 tables" },
  { id: "webhooks", name: "Webhooks",      hint: "2 streams" },
];

const AREA_SERIES = [
  0.18, 0.22, 0.28, 0.24, 0.32, 0.36, 0.42, 0.38, 0.46, 0.52,
  0.48, 0.58, 0.62, 0.56, 0.64, 0.72, 0.68, 0.74, 0.82, 0.78,
  0.86, 0.82, 0.9, 0.86,
];

const RISK_SPARK = [0.62, 0.58, 0.6, 0.64, 0.62, 0.66, 0.63, 0.68, 0.66, 0.64];
const VIOL_SPARK = [0.12, 0.18, 0.14, 0.22, 0.26, 0.2, 0.28, 0.3, 0.24, 0.34];

const TOP_REPOS = [
  { repo: "acme/order-service",    runs: 1284, risk: 0.68 },
  { repo: "acme/payment-gateway",  runs: 1021, risk: 0.74 },
  { repo: "acme/identity-core",    runs:  842, risk: 0.42 },
  { repo: "acme/notifier",         runs:  611, risk: 0.31 },
  { repo: "acme/ledger",           runs:  538, risk: 0.59 },
];

const ENGINE_BARS = [
  { name: "risk",       ms: 162, tone: "var(--accent)" },
  { name: "blast",      ms: 248, tone: "var(--accent-purple)" },
  { name: "taint",      ms: 412, tone: "var(--warn)" },
  { name: "behavior",   ms: 188, tone: "var(--success)" },
  { name: "incidents",  ms: 104, tone: "var(--fg-muted)" },
  { name: "ownership",  ms:  78, tone: "var(--fg-muted)" },
];

const PUBLISHED = [
  { id: "exec",    title: "Executive summary",   edited: "2d ago", views: 284 },
  { id: "sre",     title: "SRE on-call",         edited: "5h ago", views: 142 },
  { id: "sec",     title: "Security watchtower", edited: "1d ago", views:  97 },
  { id: "fin",     title: "Finance & usage",     edited: "3d ago", views:  61 },
];

const INITIAL_WIDGETS: PlacedWidget[] = [
  { id: "w1", kind: "area",  title: "Analyses over time",       colSpan: 6, rowSpan: 2 },
  { id: "w2", kind: "stat",  title: "Risk score median",        colSpan: 3, rowSpan: 1 },
  { id: "w3", kind: "stat",  title: "Policy violations",        colSpan: 3, rowSpan: 1 },
  { id: "w4", kind: "table", title: "Top repos",                colSpan: 6, rowSpan: 2 },
  { id: "w5", kind: "bar",   title: "Engine latency (p95)",     colSpan: 6, rowSpan: 2 },
];

const ACCENT_SWATCHES = [
  { id: "accent",  color: "var(--accent)" },
  { id: "purple",  color: "var(--accent-purple)" },
  { id: "success", color: "var(--success)" },
  { id: "warn",    color: "var(--warn)" },
  { id: "danger",  color: "var(--danger)" },
  { id: "muted",   color: "var(--fg-muted)" },
];

function WidgetChrome({
  widget,
  selected,
  onSelect,
}: {
  widget: PlacedWidget;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        gridColumn: `span ${widget.colSpan}`,
        gridRow: `span ${widget.rowSpan}`,
        border: selected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        boxShadow: selected ? "0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent)" : "none",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        cursor: "pointer",
        transition: "border-color 0.14s ease, box-shadow 0.14s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-1h) var(--space-2h)",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-subtle)",
        }}
      >
        <span
          style={{ color: "var(--fg-subtle)", cursor: "move", display: "inline-flex" }}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag"
        >
          <GripVertical size={13} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span
          style={{
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-medium)",
            color: "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {widget.title}
        </span>
        <span style={{ flex: 1 }} />
        <IconBtn label="Settings"><Settings size={12} strokeWidth={1.7} aria-hidden="true" /></IconBtn>
        <IconBtn label="Duplicate"><Copy size={12} strokeWidth={1.7} aria-hidden="true" /></IconBtn>
        <IconBtn label="Delete"><Trash2 size={12} strokeWidth={1.7} aria-hidden="true" /></IconBtn>
      </div>
      <div style={{ padding: "var(--space-3)", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <WidgetBody widget={widget} />
      </div>
    </div>
  );
}

function IconBtn({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        padding: 0,
        border: 0,
        background: "transparent",
        color: "var(--fg-subtle)",
        borderRadius: "var(--radius-xs)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function WidgetBody({ widget }: { widget: PlacedWidget }) {
  if (widget.id === "w1") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span style={{ fontSize: 22, fontWeight: "var(--fw-bold)", letterSpacing: "-0.02em" }}>
            48,621
          </span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--success)" }}>▲ 12.4%</span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            vs last 30d
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AreaChart values={AREA_SERIES} height={140} color="var(--accent)" />
        </div>
      </div>
    );
  }

  if (widget.id === "w2") {
    return (
      <StatMini label="Risk score (median)" value="0.64" delta="+0.03" tone="warn" series={RISK_SPARK} />
    );
  }

  if (widget.id === "w3") {
    return (
      <StatMini label="Policy violations" value="148" delta="+22" tone="danger" series={VIOL_SPARK} />
    );
  }

  if (widget.id === "w4") {
    return (
      <div style={{ height: "100%", overflow: "auto" }}>
        <table className="demo-table">
          <thead>
            <tr>
              <th>Repo</th>
              <th style={{ textAlign: "right" }}>Runs</th>
              <th style={{ textAlign: "right" }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {TOP_REPOS.map((r) => (
              <tr key={r.repo}>
                <td className="is-mono">{r.repo}</td>
                <td className="is-num">{r.runs.toLocaleString()}</td>
                <td className="is-num">
                  <span
                    style={{
                      color:
                        r.risk >= 0.65 ? "var(--danger)" : r.risk >= 0.5 ? "var(--warn)" : "var(--fg)",
                    }}
                  >
                    {r.risk.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (widget.id === "w5") {
    const maxMs = Math.max(...ENGINE_BARS.map((b) => b.ms));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2h)", height: "100%", justifyContent: "center" }}>
        {ENGINE_BARS.map((b) => (
          <div key={b.name} style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr) 56px", gap: "var(--space-2h)", alignItems: "center" }}>
            <code style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)", color: "var(--fg-muted)" }}>
              {b.name}
            </code>
            <div style={{ height: 10, background: "var(--bg-muted)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(b.ms / maxMs) * 100}%`,
                  height: "100%",
                  background: b.tone,
                  borderRadius: "var(--radius-pill)",
                }}
              />
            </div>
            <span style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)", color: "var(--fg)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {b.ms}ms
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function StatMini({
  label,
  value,
  delta,
  tone,
  series,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "warn" | "danger" | "success";
  series: number[];
}) {
  const deltaColor = tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--warn)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", height: "100%" }}>
      <span style={{ fontSize: "var(--fs-10)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: "var(--fw-semibold)" }}>
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: "var(--fw-bold)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      <span style={{ fontSize: "var(--fs-10)", color: deltaColor, fontWeight: "var(--fw-semibold)" }}>
        ▲ {delta}
      </span>
      <div style={{ flex: 1, minHeight: 0, marginTop: "var(--space-1)" }}>
        <Sparkline values={series} width={220} height={36} color={deltaColor} />
      </div>
    </div>
  );
}

function LibraryTile({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      draggable
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-1)",
        padding: "var(--space-2)",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg)",
        cursor: "grab",
        fontSize: "var(--fs-10)",
        color: "var(--fg-muted)",
        textAlign: "center",
        minHeight: 56,
      }}
    >
      <span style={{ color: "var(--fg)" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function DataSourceRow({ name, hint }: { name: string; hint: string }) {
  return (
    <button
      type="button"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1h) var(--space-2)",
        border: 0,
        background: "transparent",
        borderRadius: "var(--radius-xs)",
        color: "var(--fg-muted)",
        font: "inherit",
        fontSize: "var(--fs-xs)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span className="demo-dot" style={{ width: 5, height: 5 }} />
      <span style={{ flex: 1, color: "var(--fg)" }}>{name}</span>
      <span style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>{hint}</span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div
        style={{
          padding: "0 var(--space-1)",
          fontSize: "var(--fs-10)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--fg-subtle)",
          fontWeight: "var(--fw-bold)",
          marginBottom: "var(--space-2)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function PropField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        marginBottom: "var(--space-2h)",
      }}
    >
      <span style={{ fontSize: "var(--fs-10)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", fontWeight: "var(--fw-semibold)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function DashboardBuilderPage() {
  const [widgets] = useState<PlacedWidget[]>(INITIAL_WIDGETS);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>("w2");
  const [title, setTitle] = useState("Engineering health · draft");
  const [metric, setMetric] = useState("risk_median");
  const [timeRange, setTimeRange] = useState("7d");
  const [format, setFormat] = useState("number");
  const [showDelta, setShowDelta] = useState(true);
  const [compareTo, setCompareTo] = useState("last_period");
  const [accent, setAccent] = useState("accent");
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [aggregation, setAggregation] = useState("median");
  const [filterExpr, setFilterExpr] = useState("repo:/^(order|payment).*/");

  const selected = useMemo(() => widgets.find((w) => w.id === selectedWidgetId), [widgets, selectedWidgetId]);

  const canvasStyle: CSSProperties = {
    padding: "var(--space-4)",
    overflow: "auto",
    position: "relative",
    background:
      "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    backgroundPosition: "0 0",
    backgroundColor: "var(--bg-subtle)",
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Dashboard builder"
        sub="Compose custom dashboards from a library of widgets. Drop-in, rearrange, publish."
      />
      <div className="demo-app__body">
        {/* Top bar */}
        <div className="demo-sectionbar">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Dashboard title"
            className="demo-input"
            style={{ maxWidth: 340, height: 32, fontWeight: "var(--fw-semibold)" }}
          />
          <span className="demo-sectionbar__spacer" />
          <button type="button" className="demo-btn demo-btn--ghost" style={{ height: 30 }}>
            Preview
          </button>
          <button type="button" className="demo-btn demo-btn--ghost" style={{ height: 30 }}>
            Revision history
          </button>
          <button type="button" className="demo-btn demo-btn--ghost" style={{ height: 30 }}>
            Duplicate
          </button>
          <button type="button" className="demo-btn demo-btn--primary" style={{ height: 30 }}>
            <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
            Save & publish
          </button>
        </div>

        {/* 3-col panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px minmax(0, 1fr) 300px",
            gap: 0,
            minHeight: 640,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {/* LEFT — library */}
          <aside
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              padding: "var(--space-3)",
              overflow: "auto",
            }}
          >
            <Section label="Widgets">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-1h)" }}>
                {LIBRARY.map((w) => (
                  <LibraryTile key={w.kind} icon={w.icon} label={w.label} />
                ))}
              </div>
            </Section>

            <Section label="Data sources">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {DATA_SOURCES.map((s) => (
                  <DataSourceRow key={s.id} name={s.name} hint={s.hint} />
                ))}
              </div>
            </Section>

            <Section label="Theme">
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                Uses the active workspace theme. Switch in{" "}
                <span style={{ color: "var(--fg)" }}>org settings</span>.
              </div>
            </Section>
          </aside>

          {/* CENTER — canvas */}
          <section style={canvasStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                gridAutoRows: "112px",
                gap: "var(--space-2h)",
              }}
            >
              {widgets.map((w) => (
                <WidgetChrome
                  key={w.id}
                  widget={w}
                  selected={w.id === selectedWidgetId}
                  onSelect={() => setSelectedWidgetId(w.id)}
                />
              ))}
              <div
                style={{
                  gridColumn: "span 12",
                  gridRow: "span 1",
                  border: "1.5px dashed var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "color-mix(in srgb, var(--bg) 80%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  color: "var(--fg-subtle)",
                  fontSize: "var(--fs-xs)",
                }}
              >
                <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
                Drag a widget from the library to add
              </div>
            </div>
          </section>

          {/* RIGHT — properties */}
          <aside
            style={{
              borderLeft: "1px solid var(--border)",
              padding: "var(--space-3)",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                marginBottom: "var(--space-3)",
              }}
            >
              <span
                className="demo-badge demo-badge--accent"
                style={{ letterSpacing: "0.08em" }}
              >
                {selected?.kind ?? "stat"}
              </span>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" }}>
                {selected?.title ?? "Stat tile"}
              </span>
            </div>

            <PropField label="Title">
              <input className="demo-input" defaultValue={selected?.title ?? ""} style={{ height: 30 }} />
            </PropField>

            <PropField label="Metric">
              <select
                className="demo-select"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                style={{ height: 30 }}
              >
                <option value="risk_median">Risk score (median)</option>
                <option value="risk_p95">Risk score (p95)</option>
                <option value="analyses">Analyses</option>
                <option value="policies">Policies</option>
              </select>
            </PropField>

            <PropField label="Time range">
              <select
                className="demo-select"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                style={{ height: 30 }}
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="mtd">MTD</option>
                <option value="ytd">YTD</option>
              </select>
            </PropField>

            <PropField label="Format">
              <select
                className="demo-select"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                style={{ height: 30 }}
              >
                <option value="number">Number</option>
                <option value="percent">Percentage</option>
                <option value="duration">Duration</option>
                <option value="bytes">Bytes</option>
              </select>
            </PropField>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) 0",
                borderTop: "1px dashed var(--border)",
                borderBottom: "1px dashed var(--border)",
                marginBottom: "var(--space-2h)",
              }}
            >
              <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--fg)" }}>Show delta</span>
              <label className="demo-toggle">
                <input
                  type="checkbox"
                  checked={showDelta}
                  onChange={(e) => setShowDelta(e.target.checked)}
                />
                <span className="demo-toggle__track" />
              </label>
            </div>

            <PropField label="Comparison period">
              <select
                className="demo-select"
                value={compareTo}
                onChange={(e) => setCompareTo(e.target.value)}
                style={{ height: 30 }}
              >
                <option value="last_period">Last period</option>
                <option value="last_week">Last week</option>
                <option value="last_month">Last month</option>
                <option value="last_quarter">Last quarter</option>
              </select>
            </PropField>

            <PropField label="Color accent">
              <div style={{ display: "flex", gap: "var(--space-1h)", flexWrap: "wrap" }}>
                {ACCENT_SWATCHES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-label={s.id}
                    onClick={() => setAccent(s.id)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: s.color,
                      border:
                        accent === s.id
                          ? "2px solid var(--fg)"
                          : "1px solid var(--border)",
                      cursor: "pointer",
                      padding: 0,
                      boxShadow:
                        accent === s.id
                          ? "0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "none",
                    }}
                  />
                ))}
              </div>
            </PropField>

            {/* Advanced */}
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1h)",
                padding: "var(--space-2) 0",
                border: 0,
                background: "transparent",
                color: "var(--fg)",
                fontSize: "var(--fs-xs)",
                fontWeight: "var(--fw-semibold)",
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginTop: "var(--space-1)",
              }}
            >
              {advancedOpen ? (
                <ChevronDown size={13} strokeWidth={2} aria-hidden="true" />
              ) : (
                <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
              )}
              Advanced
            </button>

            {advancedOpen ? (
              <div style={{ marginTop: "var(--space-1)" }}>
                <PropField label="Aggregation">
                  <select
                    className="demo-select"
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value)}
                    style={{ height: 30 }}
                  >
                    <option value="median">Median</option>
                    <option value="mean">Mean</option>
                    <option value="p95">p95</option>
                    <option value="sum">Sum</option>
                  </select>
                </PropField>

                <PropField label="Filter expression">
                  <textarea
                    className="demo-textarea"
                    value={filterExpr}
                    onChange={(e) => setFilterExpr(e.target.value)}
                    rows={3}
                    style={{ minHeight: 64, fontFamily: "var(--font-mono)", fontSize: 11 }}
                  />
                </PropField>
              </div>
            ) : null}

            <div style={{ flex: 1 }} />

            <button
              type="button"
              className="demo-btn demo-btn--danger demo-btn--block"
              style={{ marginTop: "var(--space-3)", height: 32 }}
            >
              <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
              Delete widget
            </button>
          </aside>
        </div>

        {/* Published dashboards strip */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <div className="demo-sectionbar">
            <span className="demo-sectionbar__title">Published dashboards</span>
            <span className="demo-sectionbar__desc">4 live · shared with your workspace</span>
            <span className="demo-sectionbar__spacer" />
            <button type="button" className="demo-btn demo-btn--ghost" style={{ height: 28 }}>
              View all
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(220px, 1fr))",
              gap: "var(--space-3)",
              overflowX: "auto",
            }}
          >
            {PUBLISHED.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    height: 68,
                    background:
                      "linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, var(--bg)) 0%, var(--bg-subtle) 100%)",
                    borderBottom: "1px solid var(--border)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--fg-subtle)",
                  }}
                >
                  <BarChart3 size={22} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div style={{ padding: "var(--space-2h) var(--space-3)" }}>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2, letterSpacing: "0.04em" }}>
                    Last edited {p.edited} · viewed {p.views}×
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini stat row to anchor the page */}
        <div className="demo-stats" style={{ marginTop: "var(--space-5)" }}>
          <StatCard label="Dashboards" value="12" delta="+2 this week" deltaTone="up" />
          <StatCard label="Widgets in library" value="28" delta="8 new" deltaTone="up" />
          <StatCard label="Shared viewers" value="142" delta="+18" deltaTone="up" />
          <StatCard label="Avg load time" value="284ms" delta="-42ms" deltaTone="up" />
        </div>
      </div>
    </div>
  );
}
