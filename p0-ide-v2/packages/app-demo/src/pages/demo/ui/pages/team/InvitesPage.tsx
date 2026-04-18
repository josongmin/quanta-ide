import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

const INVITES = [
  { email: "bill@acme.com",     role: "Engineer", sent: "2 hours ago",  expires: "in 6 days" },
  { email: "linda@acme.com",    role: "Reviewer", sent: "1 day ago",    expires: "in 5 days" },
  { email: "carmack@acme.com",  role: "Admin",    sent: "3 days ago",   expires: "in 3 days" },
  { email: "hejlsberg@acme.com",role: "Engineer", sent: "5 days ago",   expires: "tomorrow" },
  { email: "dan@external.dev",  role: "Reviewer", sent: "8 days ago",   expires: "expired" },
];

export function InvitesPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Team"
        title="Invitations"
        sub="Pending invitations. Invites expire 7 days after being sent."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Send new invitations</div>
              <div className="demo-block__sub">Comma-separate emails. Each recipient gets a unique token.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px auto", gap: 8 }}>
              <input className="demo-input" placeholder="alice@acme.com, bob@acme.com" />
              <select className="demo-select" defaultValue="Engineer">
                <option>Engineer</option>
                <option>Reviewer</option>
                <option>Admin</option>
                <option>Owner</option>
              </select>
              <button className="demo-btn demo-btn--primary">Send invites</button>
            </div>
            <p style={{ marginTop: 8, fontSize: "var(--fs-10)", color: "var(--fg-subtle)" }}>
              Tip: you can also share a workspace link that anyone with a matching email domain can join.
            </p>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div className="demo-block__title">Pending</div>
            <span className="demo-sectionbar__spacer" />
            <span className="demo-badge">{INVITES.length} invites</span>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {INVITES.map((i) => (
              <div key={i.email} className="demo-row">
                <span className="demo-avatar">{i.email[0]!.toUpperCase()}</span>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{i.email}</div>
                  <div className="demo-row__sub">{i.role} · sent {i.sent} · {i.expires}</div>
                </div>
                <span className={"demo-badge" + (i.expires === "expired" ? " demo-badge--danger" : "")}>
                  {i.expires === "expired" ? "Expired" : "Pending"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="demo-btn demo-btn--ghost" style={{ padding: 0, width: 28, height: 28 }} aria-label="Copy link">
                    <Copy size={13} strokeWidth={1.8} />
                  </button>
                  <button className="demo-btn demo-btn--ghost" style={{ padding: 0, width: 28, height: 28 }} aria-label="Resend">
                    <RefreshCw size={13} strokeWidth={1.8} />
                  </button>
                  <button className="demo-btn demo-btn--danger" style={{ padding: 0, width: 28, height: 28 }} aria-label="Revoke">
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
