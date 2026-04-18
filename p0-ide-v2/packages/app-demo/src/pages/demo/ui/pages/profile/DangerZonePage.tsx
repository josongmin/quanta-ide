import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

export function DangerZonePage() {
  const [text, setText] = useState("");
  const match = text === "DELETE";

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Profile"
        title="Danger zone"
        sub="These actions are permanent. Be sure."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Export your data</div>
              <div className="demo-block__sub">Download a JSON archive of your profile, preferences, and audit trail.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost"><Download size={13} strokeWidth={1.8} /> Request export</button>
          </header>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Transfer ownership</div>
              <div className="demo-block__sub">Hand this workspace off to another Owner-level member.</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Transfer…</button>
          </header>
        </div>

        <div className="demo-block" style={{ borderColor: "var(--border-danger-subtle)" }}>
          <header className="demo-block__head" style={{ background: "var(--bg-danger-subtle)", borderBottom: "1px solid var(--border-danger-subtle)" }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ color: "var(--danger)" }} />
            <div>
              <div className="demo-block__title" style={{ color: "var(--danger)" }}>Delete account</div>
              <div className="demo-block__sub">All workspaces you own will be deleted. This cannot be undone.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 0 }}>
              Type <code style={{ background: "var(--bg-muted)", padding: "1px 6px", borderRadius: 4 }}>DELETE</code> to confirm.
            </p>
            <div className="demo-danger-confirm">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
              />
              <button className="demo-btn demo-btn--danger" disabled={!match}>Delete my account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
