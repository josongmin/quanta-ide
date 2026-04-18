import { ArrowUp, Plus, X, Mail } from "lucide-react";

interface Resource {
  name: string;
  alertPct: number;
  cap: string;
  current: string;
  pct: number;
  tone: "ok" | "warn" | "danger";
}

const RESOURCES: Resource[] = [
  { name: "AI tokens",          alertPct: 80, cap: "2.5M",  current: "1.42M",  pct: 57, tone: "ok"     },
  { name: "Analysis minutes",   alertPct: 75, cap: "20,000", current: "8,204", pct: 41, tone: "ok"     },
  { name: "Seats",              alertPct: 90, cap: "25",    current: "22",    pct: 88, tone: "warn"   },
  { name: "Webhook deliveries", alertPct: 80, cap: "50,000", current: "46,712", pct: 93, tone: "danger" },
];

const RECIPIENTS = [
  { email: "ada@acme.com",       role: "Owner" },
  { email: "billing@acme.com",   role: "Billing contact" },
  { email: "grace@acme.com",     role: "Admin" },
];

export function UsageAlertsPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Billing</span>
        <h1 className="demo-app__hero-title">Usage alerts &amp; budgets</h1>
        <p className="demo-app__hero-sub">
          Get notified before you blow past a cap. Alerts are evaluated daily.
        </p>
      </header>
      <div className="demo-app__body">

        <div className="demo-grid-3" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">This period</div>
            <div className="demo-stat__value">$612.40</div>
            <div className="demo-stat__delta">Day 14 of 30</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Projected end-of-period</div>
            <div className="demo-stat__value">$1,312</div>
            <div className="demo-stat__delta is-up">
              <ArrowUp size={10} strokeWidth={2.4} /> +8% vs last period
            </div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Hard cap</div>
            <div className="demo-stat__value">$1,500</div>
            <div className="demo-stat__delta">Runs pause at 100%</div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Budget caps</div>
              <div className="demo-block__sub">Configure a warning threshold and a hard cap per resource.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--primary">Save caps</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th style={{ width: 120 }}>Alert at %</th>
                  <th style={{ width: 120 }}>Hard cap</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Current</th>
                  <th style={{ width: 120, textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>
                      <input
                        className="demo-input"
                        type="number"
                        defaultValue={r.alertPct}
                        aria-label={`${r.name} alert threshold`}
                        style={{ width: 88, height: 28, padding: "0 8px", fontSize: "var(--fs-xs)" }}
                      />
                    </td>
                    <td className="is-mono">{r.cap}</td>
                    <td className="is-num">{r.current} <span style={{ color: "var(--fg-subtle)" }}>({r.pct}%)</span></td>
                    <td style={{ textAlign: "right" }}>
                      {r.tone === "ok"     && <span className="demo-badge demo-badge--success">Healthy</span>}
                      {r.tone === "warn"   && <span className="demo-badge demo-badge--warn">Near cap</span>}
                      {r.tone === "danger" && <span className="demo-badge demo-badge--danger">Over alert</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Recipients</div>
              <div className="demo-block__sub">Who gets an email when a threshold trips.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">
              <Plus size={13} strokeWidth={1.8} /> Add recipient
            </button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {RECIPIENTS.map((r) => (
              <div key={r.email} className="demo-row" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto auto" }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: "var(--bg-muted)", color: "var(--fg-muted)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Mail size={14} strokeWidth={1.8} />
                </div>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{r.email}</div>
                  <div className="demo-row__sub">{r.role}</div>
                </div>
                <span className="demo-badge">alerts + weekly digest</span>
                <button className="demo-btn demo-btn--ghost" aria-label={`Remove ${r.email}`}>
                  <X size={13} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <footer className="demo-block__foot">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
              <input className="demo-input" type="email" placeholder="ops@acme.com" aria-label="Add recipient email" />
              <button className="demo-btn demo-btn--primary">Add</button>
            </div>
          </footer>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Spend history</div>
              <div className="demo-block__sub">Rolling spend trend across the last three billing periods.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "var(--fs-sm)" }}>
              <div style={{ fontFamily: "var(--font-mono)", color: "var(--fg-muted)", letterSpacing: "-0.02em" }}>
                ▁▁▂▂▃▃▃▄▄▅▆▆▇█
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                3-month rolling average: <strong style={{ color: "var(--fg)" }}>$840</strong>
                {" · "}last month: <strong style={{ color: "var(--fg)" }}>$792</strong>
                {" · "}this month projected: <strong style={{ color: "var(--fg)" }}>$920</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Auto-stop</div>
              <div className="demo-block__sub">What happens when the hard cap is reached.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div className="demo-row__primary">
                <div className="demo-row__title">Pause analysis runs when hard cap is reached</div>
                <div className="demo-row__sub">
                  New runs return <span className="is-mono">HTTP 402</span>; in-flight runs finish. Seats and reads stay online.
                </div>
              </div>
              <label className="demo-toggle">
                <input type="checkbox" defaultChecked aria-label="Pause on hard cap" />
                <span className="demo-toggle__track" />
              </label>
            </div>

            <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div className="demo-row__primary">
                <div className="demo-row__title">Notify Slack on trip</div>
                <div className="demo-row__sub">Post to <span className="is-mono">#platform-alerts</span> in addition to email.</div>
              </div>
              <label className="demo-toggle">
                <input type="checkbox" aria-label="Slack notify" />
                <span className="demo-toggle__track" />
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
