import { useState } from "react";
import { AlertTriangle, Upload, Check, Globe } from "lucide-react";

export function OrgSettingsPage() {
  const [confirm, setConfirm] = useState("");
  const canDelete = confirm === "acme";

  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Admin</span>
        <h1 className="demo-app__hero-title">Organization settings</h1>
        <p className="demo-app__hero-sub">
          Workspace identity, discoverability, and defaults that apply to everyone in the org.
        </p>
      </header>
      <div className="demo-app__body">

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Identity</div>
              <div className="demo-block__sub">How your workspace appears to members and integrations.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--primary">Save changes</button>
          </header>
          <div className="demo-block__body">
            <div className="demo-field">
              <label className="demo-field__label" htmlFor="org-name">Org name</label>
              <input id="org-name" className="demo-input" type="text" defaultValue="Acme Inc." />
              <span className="demo-field__hint">Shown in emails, invoices, and the app switcher.</span>
            </div>

            <div className="demo-field" style={{ marginTop: 14 }}>
              <label className="demo-field__label" htmlFor="org-slug">Workspace URL</label>
              <div style={{ position: "relative" }}>
                <input
                  id="org-slug"
                  className="demo-input"
                  type="text"
                  value="acme"
                  readOnly
                  style={{ paddingLeft: 128, fontFamily: "var(--font-mono)" }}
                />
                <span
                  style={{
                    position: "absolute", left: 10, top: 9,
                    fontSize: "var(--fs-xs)", color: "var(--fg-subtle)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  quanta.dev/
                </span>
              </div>
              <span className="demo-field__hint">Contact support to change the slug — existing links will break.</span>
            </div>

            <div className="demo-field" style={{ marginTop: 14 }}>
              <label className="demo-field__label">Logo</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="demo-avatar demo-avatar--lg" aria-hidden>AC</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="demo-btn demo-btn--ghost">
                      <Upload size={13} strokeWidth={1.8} /> Upload
                    </button>
                    <button className="demo-btn demo-btn--ghost">Remove</button>
                  </div>
                  <span className="demo-field__hint">PNG or SVG, square, at least 256×256.</span>
                </div>
              </div>
            </div>

            <div className="demo-field" style={{ marginTop: 14 }}>
              <label className="demo-field__label" htmlFor="org-domain">Primary domain</label>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 8, alignItems: "center" }}>
                <input id="org-domain" className="demo-input" type="text" defaultValue="acme.com" />
                <button className="demo-btn demo-btn--ghost">
                  <Globe size={13} strokeWidth={1.8} /> Verify
                </button>
                <span className="demo-badge demo-badge--success">
                  <Check size={12} strokeWidth={2.2} /> Verified
                </span>
              </div>
              <span className="demo-field__hint">Used for domain-based joining and SSO matching.</span>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Discoverability</div>
              <div className="demo-block__sub">Who can find and join this workspace.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {[
              { label: "Allow anyone with @acme.com email to join", hint: "Members with a verified corporate email skip approval.", on: true },
              { label: "Require admin approval for new members",    hint: "Even domain-matched sign-ups land in a review queue.",    on: false },
              { label: "Show in public project directory",          hint: "Appear on quanta.dev/explore. Off-by-default.",           on: false },
            ].map((r) => (
              <div key={r.label} className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{r.label}</div>
                  <div className="demo-row__sub">{r.hint}</div>
                </div>
                <label className="demo-toggle">
                  <input type="checkbox" defaultChecked={r.on} aria-label={r.label} />
                  <span className="demo-toggle__track" />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Defaults for new members</div>
              <div className="demo-block__sub">Initial preferences applied when someone joins the workspace.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div className="demo-row__primary">
                <div className="demo-row__title">Enable 2FA enforcement</div>
                <div className="demo-row__sub" style={{ color: "var(--danger)" }}>
                  Off — recommended to enable for organizations over 10 members.
                </div>
              </div>
              <label className="demo-toggle">
                <input type="checkbox" defaultChecked={false} aria-label="Enable 2FA enforcement" />
                <span className="demo-toggle__track" />
              </label>
            </div>

            <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div className="demo-row__primary">
                <div className="demo-row__title">Default role</div>
                <div className="demo-row__sub">What new members are assigned on join.</div>
              </div>
              <select className="demo-select" defaultValue="engineer" aria-label="Default role">
                <option value="viewer">Viewer</option>
                <option value="engineer">Engineer</option>
                <option value="lead">Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div className="demo-row__primary">
                <div className="demo-row__title">Default timezone</div>
                <div className="demo-row__sub">Used for digests, schedules, and audit timestamps.</div>
              </div>
              <select className="demo-select" defaultValue="seoul" aria-label="Default timezone">
                <option value="utc">UTC</option>
                <option value="seoul">Asia/Seoul (GMT+9)</option>
                <option value="tokyo">Asia/Tokyo (GMT+9)</option>
                <option value="sf">America/Los_Angeles (GMT-8)</option>
                <option value="ny">America/New_York (GMT-5)</option>
                <option value="london">Europe/London (GMT+0)</option>
                <option value="berlin">Europe/Berlin (GMT+1)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="demo-block" style={{ borderColor: "var(--border-danger-subtle)" }}>
          <header
            className="demo-block__head"
            style={{ background: "var(--bg-danger-subtle)", borderBottom: "1px solid var(--border-danger-subtle)" }}
          >
            <AlertTriangle size={16} strokeWidth={2} style={{ color: "var(--danger)" }} />
            <div>
              <div className="demo-block__title" style={{ color: "var(--danger)" }}>Delete organization</div>
              <div className="demo-block__sub">
                Removes all workspaces, members, audit logs, and billing history. This cannot be undone.
              </div>
            </div>
          </header>
          <div className="demo-block__body">
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 0 }}>
              Type <code style={{ background: "var(--bg-muted)", padding: "1px 6px", borderRadius: 4 }}>acme</code> to confirm.
            </p>
            <div className="demo-danger-confirm">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="acme"
                aria-label="Type acme to confirm"
              />
              <button className="demo-btn demo-btn--danger" disabled={!canDelete}>
                Delete organization
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
