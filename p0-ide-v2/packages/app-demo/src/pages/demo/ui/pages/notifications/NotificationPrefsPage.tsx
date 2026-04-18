import { DemoAppHero } from "../../internal/DemoAppHero";

const CATEGORIES = [
  { key: "review",     label: "PR review requested",           hint: "Someone tagged you as a reviewer." },
  { key: "mention",    label: "Mentioned in a comment",        hint: "@you in a review or agent chat." },
  { key: "violation",  label: "Policy violated on main",       hint: "A merge tripped a rule you subscribe to." },
  { key: "invite",     label: "New workspace invite",          hint: "Someone invited you to a workspace." },
  { key: "billing",    label: "Billing receipts & failures",   hint: "Paid invoices and payment failures." },
  { key: "system",     label: "System & maintenance",          hint: "Scheduled maintenance, outages, product updates." },
];

const CHANNELS: Array<{ key: "in_app" | "email" | "slack"; label: string }> = [
  { key: "in_app", label: "In-app" },
  { key: "email",  label: "Email" },
  { key: "slack",  label: "Slack" },
];

export function NotificationPrefsPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Notifications"
        title="Notification preferences"
        sub="Decide where each type of event lands. Workspace owners can enforce defaults."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-prefs">
              <thead>
                <tr>
                  <th>Event</th>
                  {CHANNELS.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((cat, rowIdx) => (
                  <tr key={cat.key}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{cat.label}</div>
                      <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", marginTop: 2 }}>{cat.hint}</div>
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c.key}>
                        <label className="demo-toggle">
                          <input
                            type="checkbox"
                            defaultChecked={!(c.key === "slack" && rowIdx > 2) && !(cat.key === "system" && c.key === "email")}
                            aria-label={`${cat.label} — ${c.label}`}
                          />
                          <span className="demo-toggle__track" />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="demo-block__foot">
            <span style={{ marginRight: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-subtle)" }}>
              Connect Slack to enable the third column.
            </span>
            <button className="demo-btn demo-btn--ghost">Connect Slack</button>
            <button className="demo-btn demo-btn--primary">Save</button>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Quiet hours</div>
              <div className="demo-block__sub">Email digests instead of real-time pings.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <label className="demo-toggle" aria-label="Enable quiet hours">
              <input type="checkbox" defaultChecked />
              <span className="demo-toggle__track" />
            </label>
          </header>
          <div className="demo-block__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="demo-field">
              <label className="demo-field__label">From</label>
              <input className="demo-input" type="time" defaultValue="19:00" />
            </div>
            <div className="demo-field">
              <label className="demo-field__label">Until</label>
              <input className="demo-input" type="time" defaultValue="09:00" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
