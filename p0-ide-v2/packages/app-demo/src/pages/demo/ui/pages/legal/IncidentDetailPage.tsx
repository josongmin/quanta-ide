import { useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  BellRing,
  Check,
  CheckCircle2,
  Circle,
  FileDown,
  Link as LinkIcon,
  Share2,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { useDemoNav } from "../../DemoPage";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Avatars } from "../../internal/Avatars";
import { initials, pickPalette } from "../../internal/avatar-utils";

type StatusKind = "Investigating" | "Identified" | "Monitoring" | "Resolved" | "Postmortem";

interface TimelineEntry {
  time: string;
  status: StatusKind;
  update: string;
  author: string;
  role?: string;
}

const TIMELINE: TimelineEntry[] = [
  {
    time: "Apr 12 · 14:20",
    status: "Investigating",
    update:
      "We're seeing elevated 5xx rates on api.quanta.dev. Investigating now.",
    author: "Alan Turing",
    role: "Oncall",
  },
  {
    time: "Apr 12 · 14:22",
    status: "Investigating",
    update:
      "Confirmed 5xx spike at 14:19. Looks like a connection pool exhaustion on the primary DB.",
    author: "Alan Turing",
  },
  {
    time: "Apr 12 · 14:28",
    status: "Identified",
    update:
      "Root cause: a misbehaving downstream query. Draining traffic to readonly replicas while we patch the offending code path.",
    author: "Mei Zhang",
    role: "Incident commander",
  },
  {
    time: "Apr 12 · 14:36",
    status: "Monitoring",
    update:
      "5xx rate back to baseline. Monitoring for 15 minutes before we call it resolved.",
    author: "Mei Zhang",
  },
  {
    time: "Apr 12 · 14:45",
    status: "Monitoring",
    update: "Still green. We'll keep monitoring until 14:52.",
    author: "Alan Turing",
  },
  {
    time: "Apr 12 · 14:52",
    status: "Resolved",
    update:
      "All clear. Incident closed. Postmortem to follow within 72 hours.",
    author: "Mei Zhang",
  },
  {
    time: "Apr 15 · 10:00",
    status: "Postmortem",
    update:
      "Postmortem published below. Five action items assigned to owners.",
    author: "Mei Zhang",
    role: "Incident commander",
  },
];

const STATUS_BADGE: Record<StatusKind, string> = {
  Investigating: "demo-badge demo-badge--warn",
  Identified: "demo-badge demo-badge--warn",
  Monitoring: "demo-badge demo-badge--accent",
  Resolved: "demo-badge demo-badge--success",
  Postmortem: "demo-badge demo-badge--accent",
};

interface ActionItem {
  action: string;
  owner: string;
  due: string;
  status: "Done" | "In progress" | "Planned";
}

const ACTION_ITEMS: ActionItem[] = [
  {
    action: "Cap per-request DB timeout to 3s with a circuit breaker",
    owner: "Alan Turing",
    due: "Apr 18",
    status: "Done",
  },
  {
    action: "Add alert on connection-pool saturation > 85% for 2 min",
    owner: "Mei Zhang",
    due: "Apr 20",
    status: "Done",
  },
  {
    action: "Rewrite recommendations() to use pagination cursors",
    owner: "Grace Hopper",
    due: "Apr 26",
    status: "In progress",
  },
  {
    action: "Add load test for peak-hour recommendation traffic",
    owner: "Linus Torvalds",
    due: "May 03",
    status: "In progress",
  },
  {
    action: "Publish internal runbook: 'Connection pool exhaustion' ",
    owner: "Ada Lovelace",
    due: "May 10",
    status: "Planned",
  },
];

const ACTION_STATUS_BADGE: Record<ActionItem["status"], string> = {
  Done: "demo-badge demo-badge--success",
  "In progress": "demo-badge demo-badge--warn",
  Planned: "demo-badge",
};

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const p = pickPalette(name);
  return (
    <span
      aria-label={name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: p.bg,
        color: p.fg,
        fontSize: size <= 22 ? 10 : 11,
        fontWeight: 700,
        letterSpacing: 0,
        flex: "0 0 auto",
      }}
    >
      {initials(name)}
    </span>
  );
}

const KICKER: CSSProperties = {
  fontSize: "var(--fs-10)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: "var(--fw-bold)",
  color: "var(--fg-subtle)",
};

interface ChecklistItem {
  label: string;
  done: boolean;
}

export function IncidentDetailPage() {
  const nav = useDemoNav();
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { label: "Draft written", done: true },
    { label: "Reviewed by leads", done: true },
    { label: "Published", done: true },
    { label: "Action items assigned", done: true },
    { label: "Action items completed (3/5)", done: false },
  ]);

  const toggleChecklist = (i: number) => {
    setChecklist((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c)),
    );
  };

  const handleSubscribe = () => {
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Incidents"
        title="Elevated 5xx on api.quanta.dev"
        sub="INC-2026-0042 · Opened Apr 12, 14:20 KST · Resolved Apr 12, 14:52 KST · Severity P2 · 32 minutes"
      />
      <div className="demo-app__body">
        {/* ==================== ACTION BAR ==================== */}
        <div className="demo-sectionbar">
          <button
            type="button"
            className="demo-btn demo-btn--ghost"
            onClick={() => nav.navigate("legal.status")}
          >
            <ArrowLeft size={13} strokeWidth={1.8} aria-hidden /> Back to status page
          </button>
          <span className="demo-badge demo-badge--success">Resolved</span>
          <span className="demo-badge demo-badge--warn">P2 — Major</span>
          <span className="demo-sectionbar__spacer" />
          <button type="button" className="demo-btn demo-btn--ghost">
            <BellRing size={13} strokeWidth={1.8} aria-hidden /> Subscribe
          </button>
          <button type="button" className="demo-btn demo-btn--ghost">
            <Share2 size={13} strokeWidth={1.8} aria-hidden /> Share
          </button>
          <button type="button" className="demo-btn demo-btn--ghost">
            <FileDown size={13} strokeWidth={1.8} aria-hidden /> Export PDF
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 300px",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* ==================== MAIN COLUMN ==================== */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Status banner */}
            <div
              role="status"
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr)",
                gap: "var(--space-3)",
                alignItems: "center",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--bg-success-subtle)",
                border: "1px solid var(--border-success-subtle)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <CheckCircle2
                size={20}
                strokeWidth={1.8}
                style={{ color: "var(--success)" }}
                aria-hidden
              />
              <div>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: "var(--fw-semibold)" }}>
                  This incident was fully resolved 7 days ago.
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  Last update Apr 15, 10:00 KST · Postmortem published below
                </div>
              </div>
            </div>

            {/* Timeline */}
            <section>
              <h2 style={{ margin: "0 0 var(--space-2h)", fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.01em" }}>
                Timeline
              </h2>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 110,
                    top: 12,
                    bottom: 12,
                    width: 2,
                    background: "var(--border)",
                  }}
                />
                {TIMELINE.map((t, i) => (
                  <article
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 20px minmax(0, 1fr) auto",
                      alignItems: "start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) 0",
                      borderBottom: i < TIMELINE.length - 1 ? "1px dashed var(--border)" : undefined,
                    }}
                  >
                    <time
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-subtle)",
                        whiteSpace: "nowrap",
                        marginTop: 2,
                      }}
                    >
                      {t.time}
                    </time>
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        marginTop: 4,
                        marginLeft: 4,
                        background: "var(--bg)",
                        border: `2px solid ${
                          t.status === "Resolved"
                            ? "var(--success)"
                            : t.status === "Monitoring"
                              ? "var(--accent)"
                              : t.status === "Postmortem"
                                ? "var(--accent)"
                                : "var(--warn)"
                        }`,
                        position: "relative",
                        zIndex: 1,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center", marginBottom: 4 }}>
                        <span className={STATUS_BADGE[t.status]}>{t.status}</span>
                      </div>
                      <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                        {t.update}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar name={t.author} />
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "right" }}>
                        <div style={{ fontWeight: "var(--fw-medium)", color: "var(--fg)" }}>{t.author}</div>
                        {t.role && <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>{t.role}</div>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Impact summary */}
            <section>
              <h2 style={{ margin: "0 0 var(--space-2h)", fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.01em" }}>
                Impact summary
              </h2>
              <div className="demo-grid-3">
                <div className="demo-stat">
                  <div className="demo-stat__label">Affected users</div>
                  <div className="demo-stat__value">~1,200</div>
                  <div className="demo-stat__delta">0.7% of DAU</div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat__label">Requests failed</div>
                  <div className="demo-stat__value">~8,400</div>
                  <div className="demo-stat__delta">5xx rate peaked at 4.2%</div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat__label">Duration</div>
                  <div className="demo-stat__value">32 min</div>
                  <div className="demo-stat__delta">14:20 → 14:52 KST</div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat__label">Components</div>
                  <div className="demo-stat__value" style={{ fontSize: "var(--fs-md)" }}>
                    api · analysis
                  </div>
                  <div className="demo-stat__delta">2 of 7 services</div>
                </div>
              </div>
            </section>

            {/* Root cause */}
            <section>
              <h2 style={{ margin: "0 0 var(--space-2h)", fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.01em" }}>
                Root cause
              </h2>
              <div className="demo-prose">
                <p>
                  At 14:19 KST, <code style={{ fontFamily: "var(--font-mono)" }}>api.quanta.dev</code>{" "}
                  began returning elevated 5xx errors on the recommendations endpoint. The first
                  page was triggered within 60 seconds; on-call engaged at 14:20.
                </p>
                <p>
                  The proximate cause was a misbehaving query in the <code style={{ fontFamily: "var(--font-mono)" }}>recommendations()</code>{" "}
                  path that was emitting a full table scan on the{" "}
                  <code style={{ fontFamily: "var(--font-mono)" }}>orders</code> table whenever the
                  cursor parameter was null. Under peak-hour load, a handful of unlucky requests
                  saturated the primary DB's connection pool. Once the pool was exhausted, every
                  downstream request queued, and the p95 latency chain-reacted across services.
                </p>
                <p>
                  The offending query was of the form:
                </p>
                <pre
                  style={{
                    padding: "var(--space-3)",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg)",
                    overflowX: "auto",
                    margin: 0,
                  }}
                >
                  <code>{`SELECT * FROM orders
  WHERE user_id = $1
    AND (CASE WHEN $2 IS NULL THEN true ELSE id > $2 END)
  ORDER BY id ASC LIMIT 50;`}</code>
                </pre>
                <p style={{ marginTop: "var(--space-3)" }}>
                  The predicate confused the planner into a sequential scan. Mitigation was to
                  drain traffic to readonly replicas while we patched the callsite to pass an
                  explicit high-watermark cursor. Recovery was complete by 14:36, and we stayed
                  in monitoring until 14:52.
                </p>
              </div>
            </section>

            {/* What went well / wrong / fixing */}
            <section className="demo-grid-3">
              <article
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--bg-success-subtle)",
                  border: "1px solid var(--border-success-subtle)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ ...KICKER, color: "var(--success)", marginBottom: "var(--space-2)" }}>
                  What went well
                </div>
                <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                  <li>Paging was instant — oncall was acknowledged in 38 seconds.</li>
                  <li>Root cause identified in under 10 minutes with DB dashboards.</li>
                  <li>Graceful degradation kept reads working throughout.</li>
                </ul>
              </article>
              <article
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--bg-warn-subtle)",
                  border: "1px solid var(--border-warn-subtle)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ ...KICKER, color: "var(--warn)", marginBottom: "var(--space-2)" }}>
                  What went wrong
                </div>
                <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                  <li>No alert on connection-pool saturation — discovered via p95 alarm.</li>
                  <li>Offending query was not covered by our load test fixtures.</li>
                  <li>Runbook for pool exhaustion was stale; tribal knowledge filled the gap.</li>
                </ul>
              </article>
              <article
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--bg-accent-subtle)",
                  border: "1px solid var(--border-accent-subtle)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ ...KICKER, color: "var(--accent)", marginBottom: "var(--space-2)" }}>
                  What we're fixing
                </div>
                <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--fs-xs)", color: "var(--fg)", lineHeight: "var(--lh-relaxed)" }}>
                  <li>Per-request DB timeout with circuit breaker (shipped Apr 18).</li>
                  <li>Saturation alarm on connection pool &gt; 85% for 2 min.</li>
                  <li>Cursor-based pagination on the offending endpoint.</li>
                </ul>
              </article>
            </section>

            {/* Action items table */}
            <section>
              <h2 style={{ margin: "0 0 var(--space-2h)", fontSize: "var(--fs-lg)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.01em" }}>
                Action items
              </h2>
              <div className="demo-block">
                <div className="demo-block__body demo-block__body--flush">
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th style={{ width: 160 }}>Owner</th>
                        <th style={{ width: 90 }}>Due</th>
                        <th style={{ width: 110 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTION_ITEMS.map((a, i) => (
                        <tr key={i}>
                          <td style={{ color: "var(--fg)" }}>{a.action}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={a.owner} />
                              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg)" }}>
                                {a.owner}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)" }}>
                            {a.due}
                          </td>
                          <td>
                            <span className={ACTION_STATUS_BADGE[a.status]}>{a.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Contributing factors / Related incidents */}
            <section className="demo-grid-2">
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Contributing factors</div>
                    <div className="demo-block__sub">What amplified the impact</div>
                  </div>
                </header>
                <div className="demo-block__body">
                  <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: "var(--lh-relaxed)" }}>
                    <li>Connection pool was misconfigured — max of 60 was too low for peak hour.</li>
                    <li>Missing alert on pool saturation meant we learned via customer 5xx.</li>
                    <li>Load tests never exercised the cursor=null codepath.</li>
                    <li>Retry storm amplified queue depth on dependent services.</li>
                  </ul>
                </div>
              </div>
              <div className="demo-block">
                <header className="demo-block__head">
                  <div>
                    <div className="demo-block__title">Related incidents</div>
                    <div className="demo-block__sub">Similar root causes in the last 6 months</div>
                  </div>
                </header>
                <div className="demo-block__body demo-block__body--flush">
                  <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                    <div className="demo-row__primary">
                      <div className="demo-row__title">INC-2026-0028 · Pool exhaustion on analysis engine</div>
                      <div className="demo-row__sub">Jan 22, 2026 · duration 18 min</div>
                    </div>
                    <span className="demo-badge demo-badge--success">Resolved</span>
                    <button type="button" className="demo-btn demo-btn--ghost" onClick={() => nav.navigate("legal.status")}>
                      <LinkIcon size={11} strokeWidth={1.8} aria-hidden /> Open
                    </button>
                  </div>
                  <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                    <div className="demo-row__primary">
                      <div className="demo-row__title">INC-2025-0091 · Slow planner on recommendations</div>
                      <div className="demo-row__sub">Nov 04, 2025 · duration 41 min</div>
                    </div>
                    <span className="demo-badge demo-badge--success">Resolved</span>
                    <button type="button" className="demo-btn demo-btn--ghost" onClick={() => nav.navigate("legal.status")}>
                      <LinkIcon size={11} strokeWidth={1.8} aria-hidden /> Open
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ==================== SIDEBAR ==================== */}
          <aside
            style={{
              position: "sticky",
              top: "var(--space-2)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              minWidth: 0,
            }}
          >
            {/* Meta card */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Incident</div>
                  <div className="demo-block__sub">Core metadata</div>
                </div>
              </header>
              <div className="demo-block__body">
                <div className="demo-kv">
                  <div className="demo-kv__k">Incident ID</div>
                  <div className="demo-kv__v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    INC-2026-0042
                  </div>
                  <div className="demo-kv__k">Severity</div>
                  <div className="demo-kv__v">
                    <span className="demo-badge demo-badge--warn">P2 — Major</span>
                  </div>
                  <div className="demo-kv__k">Status</div>
                  <div className="demo-kv__v">
                    <span className="demo-badge demo-badge--success">Resolved</span>
                  </div>
                  <div className="demo-kv__k">Detected</div>
                  <div className="demo-kv__v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    Apr 12, 14:20 KST
                  </div>
                  <div className="demo-kv__k">Resolved</div>
                  <div className="demo-kv__v" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    Apr 12, 14:52 KST
                  </div>
                  <div className="demo-kv__k">Duration</div>
                  <div className="demo-kv__v">32 min</div>
                  <div className="demo-kv__k">Commander</div>
                  <div className="demo-kv__v">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Avatar name="Mei Zhang" />
                      <span>Mei Zhang</span>
                    </span>
                  </div>
                  <div className="demo-kv__k">Responders</div>
                  <div className="demo-kv__v">
                    <Avatars
                      names={["Alan Turing", "Mei Zhang", "Grace Hopper", "Linus Torvalds"]}
                      max={4}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Affected services */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Affected services</div>
                </div>
              </header>
              <div className="demo-block__body demo-block__body--flush">
                <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div className="demo-row__primary">
                    <div className="demo-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <TriangleAlert size={12} strokeWidth={1.8} style={{ color: "var(--warn)" }} aria-hidden />
                      api.quanta.dev
                    </div>
                    <div className="demo-row__sub">External HTTP surface</div>
                  </div>
                  <span className="demo-badge demo-badge--warn">Degraded</span>
                </div>
                <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div className="demo-row__primary">
                    <div className="demo-row__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Shield size={12} strokeWidth={1.8} style={{ color: "var(--fg-muted)" }} aria-hidden />
                      analysis engine
                    </div>
                    <div className="demo-row__sub">Downstream consumer</div>
                  </div>
                  <span className="demo-badge demo-badge--warn">Impacted</span>
                </div>
              </div>
            </div>

            {/* Postmortem checklist */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Postmortem status</div>
                </div>
              </header>
              <div className="demo-block__body">
                <ul className="demo-checklist">
                  {checklist.map((c, i) => (
                    <li key={i} className={"demo-checklist__item" + (c.done ? " is-done" : "")}>
                      <button
                        type="button"
                        onClick={() => toggleChecklist(i)}
                        aria-pressed={c.done}
                        aria-label={c.done ? `Mark "${c.label}" undone` : `Mark "${c.label}" done`}
                        className="demo-checklist__bullet"
                        style={{ cursor: "pointer", border: 0, background: "transparent", padding: 0 }}
                      >
                        {c.done ? (
                          <Check size={12} strokeWidth={2.2} aria-hidden />
                        ) : (
                          <Circle size={12} strokeWidth={1.8} aria-hidden />
                        )}
                      </button>
                      <div className="demo-checklist__title">{c.label}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Subscribe card */}
            <div className="demo-block">
              <header className="demo-block__head">
                <div>
                  <div className="demo-block__title">Get postmortem updates</div>
                  <div className="demo-block__sub">We'll email when action items ship</div>
                </div>
              </header>
              <div className="demo-block__body">
                {subscribed ? (
                  <div
                    style={{
                      padding: "var(--space-2h) var(--space-3)",
                      background: "var(--bg-success-subtle)",
                      border: "1px solid var(--border-success-subtle)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "var(--fs-xs)",
                      color: "var(--fg)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    role="status"
                  >
                    <CheckCircle2 size={14} strokeWidth={1.8} style={{ color: "var(--success)" }} aria-hidden />
                    Subscribed to {email} — confirmation sent.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label
                      htmlFor="incident-subscribe"
                      style={{
                        ...KICKER,
                        display: "block",
                      }}
                    >
                      Email
                    </label>
                    <input
                      id="incident-subscribe"
                      type="email"
                      className="demo-input"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button
                      type="button"
                      className="demo-btn demo-btn--primary demo-btn--block"
                      onClick={handleSubscribe}
                      disabled={!email.trim()}
                    >
                      Get notified on updates
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
