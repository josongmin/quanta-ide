import { Plus, Send } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

const HOOKS = [
  { url: "https://hooks.acme.com/ci",          events: ["analysis.completed", "policy.violated"],  last: "2 min ago", health: "ok" },
  { url: "https://acme.datadoghq.com/intake",  events: ["policy.violated", "key.rotated"],          last: "14 min ago", health: "degraded" },
  { url: "https://hooks.slack.com/TXXXX/…",    events: ["review.requested", "incident.opened"],    last: "1 hour ago", health: "ok" },
  { url: "https://acme.pagerduty.com/integration/xxx", events: ["incident.opened"],                last: "2 days ago", health: "failing" },
];

const ATTEMPTS = [
  { when: "2026-04-19 14:22 KST", event: "analysis.completed",    status: 200, ms: 84 },
  { when: "2026-04-19 14:14 KST", event: "policy.violated",       status: 200, ms: 91 },
  { when: "2026-04-19 13:58 KST", event: "key.rotated",            status: 502, ms: 5220 },
  { when: "2026-04-19 13:41 KST", event: "review.requested",       status: 200, ms: 78 },
  { when: "2026-04-19 13:04 KST", event: "policy.violated",       status: 429, ms: 122 },
];

export function WebhooksPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Webhooks"
        sub="Outbound HTTPS endpoints. We retry failed deliveries for up to 24 hours with exponential backoff."
      />
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <span className="demo-sectionbar__spacer" />
          <button className="demo-btn demo-btn--ghost"><Send size={13} strokeWidth={1.8} /> Send test event</button>
          <button className="demo-btn demo-btn--primary"><Plus size={13} strokeWidth={1.8} /> New endpoint</button>
        </div>

        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            {HOOKS.map((h) => (
              <div key={h.url} className="demo-row" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto auto", gap: 16 }}>
                <span className={`demo-dot demo-dot--${h.health === "ok" ? "success" : h.health === "degraded" ? "warn" : "danger"}`} />
                <div className="demo-row__primary">
                  <div className="demo-row__title" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{h.url}</div>
                  <div className="demo-row__sub">
                    {h.events.map((e) => (
                      <span key={e} className="demo-badge" style={{ marginRight: 4 }}>{e}</span>
                    ))}
                    · last delivered {h.last}
                  </div>
                </div>
                <span className={"demo-badge" + (h.health === "ok" ? " demo-badge--success" : h.health === "degraded" ? " demo-badge--warn" : " demo-badge--danger")}>
                  {h.health}
                </span>
                <button className="demo-btn demo-btn--ghost">Configure</button>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Recent delivery attempts</div>
              <div className="demo-block__sub">Across all endpoints.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {ATTEMPTS.map((a, i) => (
                  <tr key={i}>
                    <td className="is-mono">{a.when}</td>
                    <td>{a.event}</td>
                    <td>
                      <span className={
                        a.status < 300 ? "demo-badge demo-badge--success" :
                        a.status < 500 ? "demo-badge demo-badge--warn" :
                        "demo-badge demo-badge--danger"
                      }>
                        {a.status}
                      </span>
                    </td>
                    <td className="is-num">{a.ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
