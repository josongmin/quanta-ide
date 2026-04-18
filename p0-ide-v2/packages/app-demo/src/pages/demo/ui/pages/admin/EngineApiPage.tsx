import { useMemo, useState } from "react";
import {
  Cpu,
  Zap,
  Plug,
  Terminal,
  Globe,
  Activity,
  Clock,
  Gauge,
  TrendingUp,
  CircleAlert,
  Server,
} from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { AreaChart } from "../../internal/AreaChart";
import { StatCard } from "../../internal/StatCard";
import { HttpStatusBadge } from "../../internal/HttpStatusBadge";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const RANGES = ["1h", "24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

interface ClientType {
  id: string;
  label: string;
  calls: number;
  color: string;
  icon: (p: { size?: number; strokeWidth?: number }) => React.ReactElement;
}

const CLIENT_TYPES: ClientType[] = [
  { id: "mcp",  label: "MCP servers",    calls: 620_400, color: "#6366f1", icon: (p) => <Plug {...p} /> },
  { id: "cli",  label: "CLI",            calls: 310_120, color: "#10b981", icon: (p) => <Terminal {...p} /> },
  { id: "rest", label: "REST API",       calls: 180_740, color: "#0d99ff", icon: (p) => <Globe {...p} /> },
  { id: "ide",  label: "IDE extension",  calls:  90_310, color: "#f59e0b", icon: (p) => <Cpu {...p} /> },
  { id: "ci",   label: "CI bots",        calls:  42_880, color: "#e11d48", icon: (p) => <Server {...p} /> },
];

interface EngineRow {
  id: string;
  label: string;
  calls: number;
  p50: number;
  p95: number;
  errorRate: number;
}

const ENGINES: EngineRow[] = [
  { id: "risk",       label: "Risk score",          calls: 452_120, p50:  38, p95: 189, errorRate: 0.02 },
  { id: "blast",      label: "Blast radius",        calls: 291_450, p50:  62, p95: 221, errorRate: 0.08 },
  { id: "taint",      label: "Taint analysis",      calls: 182_100, p50: 184, p95: 512, errorRate: 0.15 },
  { id: "behavior",   label: "Behavior diff",       calls: 154_820, p50:  92, p95: 412, errorRate: 0.04 },
  { id: "incidents",  label: "Incident correlate",  calls:  92_310, p50:  22, p95:  98, errorRate: 0.01 },
  { id: "ownership",  label: "Ownership",           calls:  82_540, p50:  14, p95:  61, errorRate: 0.00 },
];

interface TopClient {
  name: string;
  type: string;
  typeColor: string;
  calls: string;
  p95: number;
  err: number;
  last: string;
}

const TOP_CLIENTS: TopClient[] = [
  { name: "claude-mcp@raycast",      type: "MCP",  typeColor: "#6366f1", calls: "142k", p95: 189, err: 0.01, last: "now" },
  { name: "acme-ci-worker",          type: "CI",   typeColor: "#e11d48", calls: "94.2k", p95: 234, err: 0.02, last: "2 min ago" },
  { name: "quanta-cli@ada-mbp",      type: "CLI",  typeColor: "#10b981", calls: "41.8k", p95: 102, err: 0.00, last: "14 min ago" },
  { name: "cursor-mcp@alan",         type: "MCP",  typeColor: "#6366f1", calls: "32.1k", p95: 201, err: 0.03, last: "now" },
  { name: "claude-mcp@grace",        type: "MCP",  typeColor: "#6366f1", calls: "28.4k", p95: 212, err: 0.04, last: "3 min ago" },
  { name: "gh-actions@acme/policies",type: "CI",   typeColor: "#e11d48", calls: "12.9k", p95: 442, err: 0.11, last: "41 min ago" },
  { name: "ide-ext@linus-linux",     type: "IDE",  typeColor: "#f59e0b", calls: "11.2k", p95:  64, err: 0.00, last: "now" },
  { name: "ad-hoc@postman",          type: "REST", typeColor: "#0d99ff", calls:  "8.6k", p95: 218, err: 0.21, last: "1 hour ago" },
];

interface LogEntry {
  when: string;
  client: string;
  engine: string;
  ms: number;
  status: 200 | 206 | 401 | 429 | 500 | 504;
}

const RECENT_LOG: LogEntry[] = [
  { when: "14:28:12.901", client: "claude-mcp@raycast",   engine: "risk.score",        ms:  38, status: 200 },
  { when: "14:28:12.843", client: "quanta-cli@ada-mbp",   engine: "blast.radius",      ms: 112, status: 200 },
  { when: "14:28:12.712", client: "cursor-mcp@alan",      engine: "taint.trace",       ms: 418, status: 200 },
  { when: "14:28:12.509", client: "acme-ci-worker",       engine: "policy.evaluate",   ms:  76, status: 200 },
  { when: "14:28:11.982", client: "claude-mcp@raycast",   engine: "risk.score",        ms:  41, status: 200 },
  { when: "14:28:11.440", client: "gh-actions@acme/pol",  engine: "taint.trace",       ms: 812, status: 504 },
  { when: "14:28:10.911", client: "quanta-cli@ada-mbp",   engine: "incidents.correlate",ms:  18, status: 200 },
  { when: "14:28:10.732", client: "ad-hoc@postman",       engine: "risk.score",        ms:   4, status: 401 },
  { when: "14:28:10.201", client: "ide-ext@linus-linux",  engine: "ownership.at",      ms:  12, status: 200 },
  { when: "14:28:09.812", client: "claude-mcp@grace",     engine: "behavior.diff",     ms: 241, status: 200 },
  { when: "14:28:09.420", client: "acme-ci-worker",       engine: "blast.radius",      ms: 198, status: 200 },
  { when: "14:28:08.981", client: "unknown@3.241.1.22",   engine: "risk.score",        ms:   2, status: 429 },
];

// deterministic 24-point volume series
function buildSeries(len: number, seed: number) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const r = s / 0x7fffffff;
    const circ = Math.sin((i / len) * Math.PI * 2) * 0.25 + 0.55;
    out.push(Math.max(0.15, Math.min(1, circ + (r - 0.5) * 0.28)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function EngineApiPage() {
  const [range, setRange] = useState<Range>("24h");
  const series = useMemo(() => buildSeries(range === "1h" ? 30 : range === "24h" ? 48 : range === "7d" ? 84 : 120, 7), [range]);

  const totalCalls = CLIENT_TYPES.reduce((a, c) => a + c.calls, 0);
  const maxEngineCalls = Math.max(...ENGINES.map((e) => e.calls));

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin · Engine API"
        title="External engine traffic"
        sub="Observability for the public engine endpoints — MCP servers, CLI sessions, REST API, IDE extensions, and CI bots. All timings include network overhead measured at the edge."
      />

      <div className="demo-app__body">

        {/* ------- Range toggle ------- */}
        <div className="demo-sectionbar">
          <div className="demo-billing-toggle" style={{ marginBottom: 0 }}>
            {RANGES.map((r) => (
              <button key={r} className={range === r ? "is-active" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
          <span className="demo-sectionbar__desc">
            <span className="demo-dot demo-dot--success" style={{ marginRight: 6 }} />
            Live — last event 0.4s ago
          </span>
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost"><Activity size={13} strokeWidth={1.8} /> Open in Grafana</button>
          <button className="demo-btn demo-btn--ghost">Export CSV</button>
        </div>

        {/* ------- Top stats ------- */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-3h)" }}>
          <StatCard icon={<Zap         size={14} strokeWidth={1.8} />} label="Calls / 24h"     value={fmtInt(totalCalls)} delta="+18.2%" deltaTone="up" />
          <StatCard icon={<TrendingUp  size={14} strokeWidth={1.8} />} label="Success rate"    value="99.86%"             delta="+0.04%" deltaTone="up" />
          <StatCard icon={<Clock       size={14} strokeWidth={1.8} />} label="p50 latency"     value="42 ms"              delta="−3 ms"  deltaTone="up" />
          <StatCard icon={<Gauge       size={14} strokeWidth={1.8} />} label="p95 latency"     value="218 ms"             delta="+12 ms" deltaTone="down" />
          <StatCard icon={<CircleAlert size={14} strokeWidth={1.8} />} label="p99 latency"     value="612 ms"             delta="+41 ms" deltaTone="down" />
          <StatCard icon={<Cpu         size={14} strokeWidth={1.8} />} label="Active clients"  value="847"                delta="+24"    deltaTone="up" />
        </div>

        {/* ------- Time series ------- */}
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Request volume</div>
              <div className="demo-block__sub">Calls per {range === "1h" ? "2 min" : range === "24h" ? "30 min" : range === "7d" ? "2 hr" : "6 hr"} bucket · {range} window</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <div style={{ display: "inline-flex", gap: 12, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span><span className="demo-dot demo-dot--success" /> 2xx</span>
              <span><span className="demo-dot demo-dot--warn" /> 4xx</span>
              <span><span className="demo-dot demo-dot--danger" /> 5xx</span>
            </div>
          </header>
          <div className="demo-block__body">
            <AreaChart values={series} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span>{range === "24h" ? "14 hours ago" : range === "7d" ? "7 days ago" : range === "30d" ? "30 days ago" : "1 hour ago"}</span>
              <span>now</span>
            </div>
          </div>
        </div>

        {/* ------- Two-col: client mix + engine mix ------- */}
        <div className="demo-grid-2" style={{ marginTop: "var(--space-3h)" }}>

          {/* Client type mix */}
          <div className="demo-block">
            <header className="demo-block__head">
              <div>
                <div className="demo-block__title">Traffic by client type</div>
                <div className="demo-block__sub">Share of total calls in the selected window.</div>
              </div>
            </header>
            <div className="demo-block__body">

              {/* Stacked bar */}
              <div style={{ display: "flex", width: "100%", height: 10, borderRadius: "var(--radius-pill)", overflow: "hidden", background: "var(--bg-muted)" }}>
                {CLIENT_TYPES.map((c) => (
                  <span
                    key={c.id}
                    title={`${c.label}: ${fmtInt(c.calls)}`}
                    style={{ width: `${(c.calls / totalCalls) * 100}%`, background: c.color }}
                  />
                ))}
              </div>

              {/* Legend rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14 }}>
                {CLIENT_TYPES.map((c) => {
                  const pct = (c.calls / totalCalls) * 100;
                  return (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) 80px 60px", alignItems: "center", gap: 10, padding: "6px 0" }}>
                      <span
                        style={{
                          width: 22, height: 22,
                          borderRadius: 6,
                          background: `color-mix(in srgb, ${c.color} 16%, var(--bg))`,
                          color: c.color,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {c.icon({ size: 13, strokeWidth: 1.8 })}
                      </span>
                      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>{c.label}</span>
                      <span className="is-mono" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "right" }}>
                        {fmtInt(c.calls)}
                      </span>
                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Engine mix */}
          <div className="demo-block">
            <header className="demo-block__head">
              <div>
                <div className="demo-block__title">Traffic by engine</div>
                <div className="demo-block__sub">Which engines clients are actually calling.</div>
              </div>
            </header>
            <div className="demo-block__body" style={{ padding: 0 }}>
              <table className="demo-table">
                <thead>
                  <tr>
                    <th>Engine</th>
                    <th></th>
                    <th className="is-num" style={{ textAlign: "right" }}>Calls</th>
                    <th className="is-num" style={{ textAlign: "right" }}>p50</th>
                    <th className="is-num" style={{ textAlign: "right" }}>p95</th>
                    <th className="is-num" style={{ textAlign: "right" }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {ENGINES.map((e) => {
                    const pct = (e.calls / maxEngineCalls) * 100;
                    const errTone = e.errorRate >= 0.1 ? "danger" : e.errorRate >= 0.05 ? "warn" : "success";
                    return (
                      <tr key={e.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e.label}</td>
                        <td style={{ width: 120 }}>
                          <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "var(--fg)" }} />
                          </div>
                        </td>
                        <td className="is-num">{fmtInt(e.calls)}</td>
                        <td className="is-num">{e.p50} ms</td>
                        <td className="is-num">{e.p95} ms</td>
                        <td className="is-num">
                          <span className={`demo-dot demo-dot--${errTone}`} style={{ marginRight: 4 }} />
                          {e.errorRate.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ------- Top clients ------- */}
        <div className="demo-block" style={{ marginTop: "var(--space-3h)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Top clients</div>
              <div className="demo-block__sub">Sorted by call volume in the selected window.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Rate-limit policies</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Calls</th>
                  <th className="is-num" style={{ textAlign: "right" }}>p95</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Error rate</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {TOP_CLIENTS.map((c) => (
                  <tr key={c.name}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{c.name}</td>
                    <td>
                      <span
                        className="demo-badge"
                        style={{
                          background: `color-mix(in srgb, ${c.typeColor} 14%, var(--bg))`,
                          color: c.typeColor,
                          border: `1px solid color-mix(in srgb, ${c.typeColor} 30%, var(--bg))`,
                        }}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td className="is-num">{c.calls}</td>
                    <td className="is-num">{c.p95} ms</td>
                    <td className="is-num">
                      <span className={cn(
                        "demo-badge",
                        c.err >= 0.1 ? "demo-badge--danger" : c.err >= 0.02 ? "demo-badge--warn" : "demo-badge--success",
                      )}>
                        {c.err.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ color: "var(--fg-subtle)" }}>{c.last}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-10)" }}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ------- Live request log ------- */}
        <div className="demo-block" style={{ marginTop: "var(--space-3h)" }}>
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Live request log</div>
              <div className="demo-block__sub">Tail of the edge access log. Non-2xx responses are highlighted.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span className="demo-dot demo-dot--success" /> Streaming
            </span>
            <button className="demo-btn demo-btn--ghost">Pause</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Time</th>
                  <th>Client</th>
                  <th>Engine</th>
                  <th className="is-num" style={{ textAlign: "right", width: 90 }}>Duration</th>
                  <th style={{ width: 80 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_LOG.map((l, i) => (
                  <tr key={i} style={l.status >= 400 ? { background: "var(--bg-danger-subtle)" } : undefined}>
                    <td className="is-mono" style={{ color: "var(--fg-subtle)" }}>{l.when}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{l.client}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{l.engine}</td>
                    <td className="is-num" style={{ fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: l.ms > 400 ? "var(--warn)" : "var(--fg-muted)" }}>{l.ms} ms</span>
                    </td>
                    <td><HttpStatusBadge code={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="demo-block__foot">
            <span style={{ marginRight: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
              Showing last 12 events · full log retained for 14 days on Team, 90 days on Enterprise.
            </span>
            <button className="demo-btn demo-btn--ghost">Open full log</button>
          </div>
        </div>

      </div>
    </div>
  );
}
