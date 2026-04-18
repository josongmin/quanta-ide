import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  Zap,
  Filter,
  Send,
  Plus,
  Trash2,
  Play,
  Clock,
  Check,
} from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type Variant = "trigger" | "filter" | "action";

interface ConfigChip {
  k: string;
  v: string;
}

interface PipelineNode {
  variant: Variant;
  mainLine: string;
  subline: string;
  chips: ConfigChip[];
}

interface RunRow {
  id: string;
  ts: string;
  status: "success" | "failed";
  duration: string;
  context: string;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  runs: number;
  enabled: boolean;
  pipeline: PipelineNode[];
  recentRuns: RunRow[];
  metrics: { runsThisWeek: string; successRate: string; p95: string };
}

const AUTOMATIONS: Automation[] = [
  {
    id: "slack-policy",
    name: "Notify Slack on policy violation",
    description: "Policy → Slack",
    runs: 142,
    enabled: true,
    pipeline: [
      {
        variant: "trigger",
        mainLine: "When policy is violated",
        subline: "Any policy, any repository",
        chips: [
          { k: "event", v: "policy.violated" },
          { k: "repos", v: "all" },
        ],
      },
      {
        variant: "filter",
        mainLine: "If severity is high or critical",
        subline: "Skips advisory-level noise",
        chips: [
          { k: "severity", v: "high, critical" },
          { k: "excludes", v: ".github/**" },
        ],
      },
      {
        variant: "action",
        mainLine: "Send a Slack message",
        subline: "Posts to workspace channel with finding details",
        chips: [
          { k: "workspace", v: "acme" },
          { k: "channel", v: "#policy-alerts" },
          { k: "format", v: "detailed" },
        ],
      },
    ],
    recentRuns: [
      { id: "r1", ts: "2026-04-19 09:14", status: "success", duration: "412ms", context: "no-eval in payments/pay.ts" },
      { id: "r2", ts: "2026-04-19 08:47", status: "success", duration: "388ms", context: "pii-leak in logger/index.ts" },
      { id: "r3", ts: "2026-04-18 22:03", status: "failed", duration: "2.1s", context: "Slack 429 rate-limited" },
      { id: "r4", ts: "2026-04-18 17:29", status: "success", duration: "401ms", context: "sql-injection in db/raw.ts" },
      { id: "r5", ts: "2026-04-18 13:12", status: "success", duration: "396ms", context: "no-eval in api/middleware.ts" },
    ],
    metrics: { runsThisWeek: "38", successRate: "97.4%", p95: "480ms" },
  },
  {
    id: "linear-incident",
    name: "Create Linear issue on incident",
    description: "Incident → Linear",
    runs: 31,
    enabled: true,
    pipeline: [
      {
        variant: "trigger",
        mainLine: "When an incident is declared",
        subline: "Severity SEV-1 or SEV-2 only",
        chips: [
          { k: "event", v: "incident.opened" },
          { k: "severity", v: "sev-1, sev-2" },
        ],
      },
      {
        variant: "filter",
        mainLine: "If incident is customer-facing",
        subline: "Skips internal dashboards",
        chips: [{ k: "surface", v: "customer" }],
      },
      {
        variant: "action",
        mainLine: "Create a Linear issue",
        subline: "Opens a post-mortem ticket in the on-call team",
        chips: [
          { k: "team", v: "platform" },
          { k: "template", v: "post-mortem" },
          { k: "priority", v: "urgent" },
        ],
      },
    ],
    recentRuns: [
      { id: "r1", ts: "2026-04-17 11:02", status: "success", duration: "1.2s", context: "SEV-2 checkout latency" },
      { id: "r2", ts: "2026-04-12 02:38", status: "success", duration: "1.0s", context: "SEV-1 auth outage" },
      { id: "r3", ts: "2026-04-05 14:51", status: "success", duration: "820ms", context: "SEV-2 webhook backlog" },
      { id: "r4", ts: "2026-03-30 09:15", status: "failed", duration: "3.4s", context: "Linear 500 — retried" },
      { id: "r5", ts: "2026-03-24 19:07", status: "success", duration: "940ms", context: "SEV-2 CDN 502s" },
    ],
    metrics: { runsThisWeek: "3", successRate: "93.5%", p95: "1.4s" },
  },
  {
    id: "auto-review",
    name: "Auto-assign PR reviewer by policy owner",
    description: "Review → Members",
    runs: 220,
    enabled: true,
    pipeline: [
      {
        variant: "trigger",
        mainLine: "When a pull request is opened",
        subline: "All default-branch targets",
        chips: [
          { k: "event", v: "pr.opened" },
          { k: "branch", v: "main" },
        ],
      },
      {
        variant: "filter",
        mainLine: "If PR touches policy-owned paths",
        subline: "Matched against CODEOWNERS-like rules",
        chips: [{ k: "paths", v: "security/**, auth/**" }],
      },
      {
        variant: "action",
        mainLine: "Request review from owner",
        subline: "Picks first available owner by timezone",
        chips: [
          { k: "strategy", v: "round-robin" },
          { k: "fallback", v: "@platform-oncall" },
        ],
      },
    ],
    recentRuns: [
      { id: "r1", ts: "2026-04-19 10:12", status: "success", duration: "210ms", context: "#4821 auth/session.ts" },
      { id: "r2", ts: "2026-04-19 09:01", status: "success", duration: "188ms", context: "#4817 security/tokens.ts" },
      { id: "r3", ts: "2026-04-18 16:44", status: "success", duration: "234ms", context: "#4812 auth/otp.ts" },
      { id: "r4", ts: "2026-04-18 12:17", status: "success", duration: "201ms", context: "#4805 security/scim.ts" },
      { id: "r5", ts: "2026-04-18 08:58", status: "success", duration: "193ms", context: "#4798 auth/refresh.ts" },
    ],
    metrics: { runsThisWeek: "61", successRate: "99.5%", p95: "250ms" },
  },
  {
    id: "oauth-quarantine",
    name: "Quarantine suspicious OAuth apps",
    description: "Security → Apps",
    runs: 4,
    enabled: false,
    pipeline: [
      {
        variant: "trigger",
        mainLine: "When OAuth app is flagged risky",
        subline: "Score ≥ 70 / 100 from security engine",
        chips: [
          { k: "event", v: "oauth.flagged" },
          { k: "score", v: "≥70" },
        ],
      },
      {
        variant: "filter",
        mainLine: "If app was installed < 7 days ago",
        subline: "Established apps are reviewed manually",
        chips: [{ k: "age", v: "< 7d" }],
      },
      {
        variant: "action",
        mainLine: "Revoke tokens & notify admins",
        subline: "Puts the app in review queue",
        chips: [
          { k: "action", v: "revoke" },
          { k: "notify", v: "security-leads" },
        ],
      },
    ],
    recentRuns: [
      { id: "r1", ts: "2026-04-10 03:22", status: "success", duration: "2.4s", context: "Unknown-CLI flagged score 82" },
      { id: "r2", ts: "2026-03-28 14:18", status: "success", duration: "1.9s", context: "Rogue-bot flagged score 91" },
      { id: "r3", ts: "2026-03-15 09:04", status: "failed", duration: "4.1s", context: "Timeout — app already removed" },
      { id: "r4", ts: "2026-02-26 18:41", status: "success", duration: "2.0s", context: "UnnamedApp flagged score 74" },
      { id: "r5", ts: "2026-02-14 11:55", status: "success", duration: "2.2s", context: "ShadyCLI flagged score 88" },
    ],
    metrics: { runsThisWeek: "0", successRate: "75.0%", p95: "3.8s" },
  },
  {
    id: "digest-email",
    name: "Weekly policy digest email",
    description: "Scheduled → Email",
    runs: 12,
    enabled: true,
    pipeline: [
      {
        variant: "trigger",
        mainLine: "Every Monday at 08:00",
        subline: "Workspace timezone (America/Los_Angeles)",
        chips: [
          { k: "schedule", v: "cron: 0 8 * * 1" },
          { k: "tz", v: "America/Los_Angeles" },
        ],
      },
      {
        variant: "filter",
        mainLine: "Only if violations occurred",
        subline: "Skip the email on quiet weeks",
        chips: [{ k: "violations", v: "> 0" }],
      },
      {
        variant: "action",
        mainLine: "Send a digest email",
        subline: "Summary of top policies, repos, and owners",
        chips: [
          { k: "to", v: "security-leads@acme" },
          { k: "template", v: "weekly-digest" },
        ],
      },
    ],
    recentRuns: [
      { id: "r1", ts: "2026-04-14 08:00", status: "success", duration: "612ms", context: "14 violations" },
      { id: "r2", ts: "2026-04-07 08:00", status: "success", duration: "580ms", context: "9 violations" },
      { id: "r3", ts: "2026-03-31 08:00", status: "success", duration: "601ms", context: "22 violations" },
      { id: "r4", ts: "2026-03-24 08:00", status: "success", duration: "594ms", context: "6 violations" },
      { id: "r5", ts: "2026-03-17 08:00", status: "success", duration: "610ms", context: "11 violations" },
    ],
    metrics: { runsThisWeek: "1", successRate: "100%", p95: "640ms" },
  },
];

const VARIANT_STYLE: Record<
  Variant,
  { bg: string; fg: string; label: string; icon: ReactNode }
> = {
  trigger: {
    bg: "var(--bg-accent-subtle)",
    fg: "var(--accent)",
    label: "When",
    icon: <Zap size={16} strokeWidth={1.8} />,
  },
  filter: {
    bg: "var(--bg-warn-subtle)",
    fg: "var(--warn)",
    label: "If",
    icon: <Filter size={16} strokeWidth={1.8} />,
  },
  action: {
    bg: "var(--bg-success-subtle)",
    fg: "var(--success)",
    label: "Then",
    icon: <Send size={16} strokeWidth={1.8} />,
  },
};

function Connector() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "var(--space-2) 0",
      }}
      aria-hidden
    >
      <span style={{ width: 2, height: 20, background: "var(--border-strong)" }} />
    </div>
  );
}

function RuleCard({ node }: { node: PipelineNode }) {
  const style = VARIANT_STYLE[node.variant];
  return (
    <article
      style={{
        padding: "var(--space-4)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        display: "flex",
        gap: "var(--space-3)",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-md)",
          background: style.bg,
          color: style.fg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        {style.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--fs-10)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: style.fg,
            marginBottom: "var(--space-1)",
          }}
        >
          {style.label}
        </div>
        <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, marginBottom: "var(--space-1h)" }}>
          {node.mainLine}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{node.subline}</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-1h)",
            marginTop: "var(--space-2h)",
          }}
        >
          {node.chips.map((c) => (
            <span key={c.k} className="demo-badge">
              <span style={{ color: "var(--fg-subtle)", marginRight: 4 }}>{c.k}:</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{c.v}</span>
            </span>
          ))}
        </div>
      </div>
      <button className="demo-btn demo-btn--ghost" style={{ height: 28 }}>
        Edit
      </button>
    </article>
  );
}

export function AutomationBuilderPage() {
  const [selectedId, setSelectedId] = useState(AUTOMATIONS[0].id);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.enabled])),
  );
  const [query, setQuery] = useState("");
  const [ruleName, setRuleName] = useState<Record<string, string>>(() =>
    Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.name])),
  );

  const selected = AUTOMATIONS.find((a) => a.id === selectedId) ?? AUTOMATIONS[0];
  const selectedEnabled = enabledMap[selected.id] ?? selected.enabled;

  const filtered = AUTOMATIONS.filter(
    (a) =>
      query.trim() === "" ||
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Automation"
        title="Automation builder"
        sub="If-this-then-that for your workspace. Zero-code pipelines that react to events across the engines."
      />
      <div className="demo-app__body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 30%) minmax(0, 1fr)",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* LEFT — list */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2h)",
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <input
                type="search"
                className="demo-input"
                placeholder="Search automations…"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                aria-label="Search automations"
              />
              <button className="demo-btn demo-btn--primary demo-btn--block">
                <Plus size={13} strokeWidth={2} /> New automation
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1h)" }}>
              {filtered.map((a) => {
                const isSelected = a.id === selectedId;
                const enabled = enabledMap[a.id] ?? a.enabled;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "var(--space-3)",
                      border: isSelected
                        ? "1px solid var(--fg)"
                        : "1px solid var(--border)",
                      background: isSelected ? "var(--bg-subtle)" : "var(--bg)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      cursor: "pointer",
                    }}
                    aria-pressed={isSelected}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                      }}
                    >
                      <span
                        className={enabled ? "demo-dot demo-dot--success" : "demo-dot"}
                        style={
                          enabled
                            ? undefined
                            : { background: "var(--fg-subtle)", opacity: 0.6 }
                        }
                      />
                      <span
                        style={{
                          fontSize: "var(--fs-sm)",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {ruleName[a.id] ?? a.name}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "var(--fs-10)",
                          color: "var(--fg-subtle)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {a.runs} runs
                      </span>
                    </div>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                      {a.description}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="demo-empty">
                  <div className="demo-empty__title">No matches</div>
                  <div className="demo-empty__hint">Try a different search term.</div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT — editor */}
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2h) var(--space-3)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
              }}
            >
              <input
                type="text"
                className="demo-input"
                value={ruleName[selected.id] ?? selected.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setRuleName((m) => ({ ...m, [selected.id]: e.target.value }))
                }
                style={{ flex: 1, fontWeight: 600, fontSize: "var(--fs-md)" }}
                aria-label="Rule name"
              />
              <label
                className="demo-toggle"
                aria-label={selectedEnabled ? "Disable rule" : "Enable rule"}
              >
                <input
                  type="checkbox"
                  checked={selectedEnabled}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEnabledMap((m) => ({ ...m, [selected.id]: e.target.checked }))
                  }
                />
                <span className="demo-toggle__track" />
              </label>
              <button className="demo-btn demo-btn--ghost">
                <Play size={13} strokeWidth={1.8} /> Test run
              </button>
              <button className="demo-btn demo-btn--primary">Save</button>
              <button
                className="demo-btn demo-btn--danger"
                aria-label="Delete automation"
                style={{ width: 32, padding: 0, justifyContent: "center" }}
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>

            {/* Pipeline */}
            <div
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {selected.pipeline.map((node, i) => (
                <div key={`${selected.id}-${i}`}>
                  <RuleCard node={node} />
                  {i < selected.pipeline.length - 1 && <Connector />}
                </div>
              ))}
              <div
                style={{
                  marginTop: "var(--space-3)",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button className="demo-btn demo-btn--ghost">
                  <Plus size={13} strokeWidth={2} /> Add step
                </button>
              </div>
            </div>

            {/* Recent runs */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Recent runs</div>
                  <div className="demo-block__sub">
                    Last 5 invocations · full history is retained for 30 days.
                  </div>
                </div>
                <span className="demo-sectionbar__spacer" />
                <span
                  style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Clock size={11} strokeWidth={1.8} /> Updated just now
                </span>
              </header>
              <div className="demo-block__body demo-block__body--flush">
                <table className="demo-table">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>Timestamp</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 90, textAlign: "right" }}>Duration</th>
                      <th>Trigger context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.recentRuns.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>
                          {r.ts}
                        </td>
                        <td>
                          {r.status === "success" ? (
                            <span className="demo-badge demo-badge--success">
                              <Check size={11} strokeWidth={2.4} /> Success
                            </span>
                          ) : (
                            <span className="demo-badge demo-badge--danger">Failed</span>
                          )}
                        </td>
                        <td className="is-num" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          {r.duration}
                        </td>
                        <td style={{ color: "var(--fg-muted)", fontSize: "var(--fs-xs)" }}>
                          {r.context}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metrics */}
            <div className="demo-grid-3">
              <div className="demo-stat">
                <div className="demo-stat__label">Runs this week</div>
                <div className="demo-stat__value">{selected.metrics.runsThisWeek}</div>
                <div className="demo-stat__delta">vs. last week +6</div>
              </div>
              <div className="demo-stat">
                <div className="demo-stat__label">Success rate</div>
                <div className="demo-stat__value">{selected.metrics.successRate}</div>
                <div className="demo-stat__delta is-up">Healthy</div>
              </div>
              <div className="demo-stat">
                <div className="demo-stat__label">P95 latency</div>
                <div className="demo-stat__value">{selected.metrics.p95}</div>
                <div className="demo-stat__delta">Last 7 days</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
