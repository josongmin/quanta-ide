import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

type WebhookEvent = {
  name: string;
  category: "Analysis" | "Policy" | "Review" | "Team" | "Billing" | "System";
  version: string;
  description: string;
  payload: string;
  subscribed?: boolean;
};

const CATEGORIES = ["All", "Analysis", "Policy", "Review", "Team", "Billing", "System"] as const;

const EVENTS: WebhookEvent[] = [
  {
    name: "analysis.completed",
    category: "Analysis",
    version: "2",
    description:
      "Fires when a structural analysis finishes successfully. Use this to unblock CI, update dashboards, or post a summary to chat.",
    payload: `{
  "id": "an_01HZK8X2Q3R4N7V",
  "repo": "acme/core-api",
  "ref": "refs/heads/main",
  "engine": "quanta.v3",
  "risk_score": 0.42,
  "blast_radius": 17,
  "duration_ms": 12480,
  "created_at": "2026-04-19T10:14:22Z"
}`,
    subscribed: true,
  },
  {
    name: "analysis.failed",
    category: "Analysis",
    version: "2",
    description:
      "Delivered when an analysis job terminates with an error — typically parse failure, timeout, or missing dependencies.",
    payload: `{
  "id": "an_01HZK8X2Q3R4N7V",
  "repo": "acme/core-api",
  "ref": "refs/heads/feat/payments",
  "engine": "quanta.v3",
  "error": {
    "code": "parse_error",
    "message": "Unexpected token at src/router.ts:142"
  },
  "created_at": "2026-04-19T10:17:03Z"
}`,
  },
  {
    name: "policy.violated",
    category: "Policy",
    version: "1",
    description:
      "Emitted for every rule violation detected in an analysis. Fan these out to a findings tracker or chat channel.",
    payload: `{
  "rule_id": "no-cross-module-imports",
  "rule_name": "Cross-module import guard",
  "commit": "9b4f12a",
  "file": "packages/core/src/db.ts",
  "line": 84,
  "severity": "high",
  "violator_email": "grace@acme.com"
}`,
    subscribed: true,
  },
  {
    name: "policy.gate_blocked",
    category: "Policy",
    version: "1",
    description:
      "Fires when a pull request is blocked by one or more required policies. Use it to post actionable review comments.",
    payload: `{
  "pr_id": "pr_01HZK8Y1M8WN3R",
  "pr_url": "https://github.com/acme/core-api/pull/2184",
  "rules": [
    "no-cross-module-imports",
    "require-adr-for-public-api"
  ],
  "blocked_at": "2026-04-19T10:19:51Z"
}`,
  },
  {
    name: "review.requested",
    category: "Review",
    version: "1",
    description:
      "Triggered when Quanta assigns or re-assigns a human reviewer based on blast-radius and ownership signals.",
    payload: `{
  "pr_id": "pr_01HZK8Y1M8WN3R",
  "pr_url": "https://github.com/acme/core-api/pull/2184",
  "reviewer_email": "alan@acme.com",
  "requested_by": "ada@acme.com",
  "due_at": "2026-04-21T18:00:00Z"
}`,
  },
  {
    name: "member.joined",
    category: "Team",
    version: "1",
    description:
      "Sent when a newly-invited teammate accepts an invite and activates their seat.",
    payload: `{
  "email": "linus@acme.com",
  "role": "engineer",
  "invited_by": "ada@acme.com",
  "joined_at": "2026-04-18T22:03:11Z"
}`,
    subscribed: true,
  },
  {
    name: "invoice.paid",
    category: "Billing",
    version: "1",
    description:
      "Delivered after a successful charge against your workspace's default payment method.",
    payload: `{
  "invoice_id": "in_1Q9Z2aCkL0ZmXy",
  "amount_cents": 49900,
  "currency": "usd",
  "method": "card_visa_4242",
  "paid_at": "2026-04-01T00:04:27Z"
}`,
  },
  {
    name: "incident.opened",
    category: "System",
    version: "1",
    description:
      "Fires when Quanta detects a service-level anomaly affecting your workspace or a downstream integration.",
    payload: `{
  "incident_id": "inc_7FQ3R1W",
  "component": "analysis-workers",
  "severity": "minor",
  "opened_at": "2026-04-19T09:42:08Z"
}`,
  },
];

const CATEGORY_TONE: Record<WebhookEvent["category"], string> = {
  Analysis: "demo-badge demo-badge--accent",
  Policy: "demo-badge demo-badge--warn",
  Review: "demo-badge demo-badge--accent",
  Team: "demo-badge demo-badge--success",
  Billing: "demo-badge demo-badge--success",
  System: "demo-badge demo-badge--danger",
};

export function WebhookCatalogPage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const [q, setQ] = useState("");

  const shown = useMemo(
    () =>
      EVENTS.filter((e) => {
        const matchCat = cat === "All" || e.category === cat;
        const needle = q.trim().toLowerCase();
        const matchQ =
          !needle ||
          e.name.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle);
        return matchCat && matchQ;
      }),
    [cat, q],
  );

  const subscribedCount = EVENTS.filter((e) => e.subscribed).length;

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Developers"
        title="Webhook event catalog"
        sub="Every event Quanta emits, with sample payloads you can copy. Subscribe an endpoint to only the events you need."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div className="demo-sectionbar__title">
            {EVENTS.length} events · {subscribedCount} subscribed
          </div>
          <span className="demo-sectionbar__spacer" />
          <div
            className="demo-billing-toggle"
            style={{ marginBottom: 0, flexWrap: "wrap" }}
          >
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cat === c ? "is-active" : ""}
                aria-pressed={cat === c}
              >
                {c}
              </button>
            ))}
          </div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1h)",
              border: "1px solid var(--border)",
              padding: "0 var(--space-2h)",
              height: 28,
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--fg-subtle)",
              fontSize: "var(--fs-xs)",
              cursor: "text",
            }}
          >
            <Search size={13} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events"
              aria-label="Search events"
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                color: "var(--fg)",
                font: "inherit",
                width: 180,
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
            gap: "var(--space-3h)",
          }}
        >
          {shown.map((e) => (
            <article
              key={e.name}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <header
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-sm)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--fg)",
                  }}
                >
                  {e.name}
                </span>
                <span className={CATEGORY_TONE[e.category]}>{e.category}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  v{e.version}
                </span>
              </header>

              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2h)",
                  flex: 1,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {e.description}
                </p>
                <pre
                  className="demo-code"
                  style={{ margin: 0, maxHeight: 220, overflow: "auto", whiteSpace: "pre" }}
                >
                  {e.payload}
                </pre>
              </div>

              <footer
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderTop: "1px dashed var(--border)",
                  background: "var(--bg-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <label className="demo-toggle">
                  <input type="checkbox" defaultChecked={e.subscribed} />
                  <span className="demo-toggle__track" />
                </label>
                <span
                  style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--fg-subtle)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: "var(--fw-semibold)",
                  }}
                >
                  Subscribed
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: "var(--space-1h)",
                  }}
                >
                  <button
                    className="demo-btn demo-btn--ghost"
                    style={{ height: 26, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
                  >
                    Copy curl
                  </button>
                  <button
                    className="demo-btn demo-btn--ghost"
                    style={{ height: 26, padding: "0 var(--space-2h)", fontSize: "var(--fs-10)" }}
                  >
                    Send test
                  </button>
                </span>
              </footer>
            </article>
          ))}
        </div>

        {shown.length === 0 && (
          <div className="demo-empty">
            <div className="demo-empty__title">No events match</div>
            <div className="demo-empty__hint">Try a different category or clear the search.</div>
          </div>
        )}
      </div>
    </div>
  );
}
