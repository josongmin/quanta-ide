import { BookOpen, ChevronRight, ShieldAlert } from "lucide-react";

type ConnectedApp = {
  name: string;
  desc: string;
  perms: string;
  lastUsed: string;
  initials: string;
  color: string;
  stale?: boolean;
  inactive?: boolean;
};

const APPS: ConnectedApp[] = [
  {
    name: "Raycast for Quanta",
    desc: "Spotlight-style launcher that queries recent analyses.",
    perms: "Read analyses",
    lastUsed: "2 hours ago",
    initials: "RC",
    color: "var(--accent)",
  },
  {
    name: "Vercel CI helper",
    desc: "Posts preview-deploy gates back to Quanta policies.",
    perms: "Read policies, write webhooks",
    lastUsed: "Yesterday",
    initials: "VC",
    color: "var(--fg)",
  },
  {
    name: "Notion sync",
    desc: "Mirrors approved rules into an engineering handbook page.",
    perms: "Read rules",
    lastUsed: "3 days ago",
    initials: "No",
    color: "var(--fg-muted)",
  },
  {
    name: "Personal CLI (ada's laptop)",
    desc: "Device-scoped token for the quanta command-line tool.",
    perms: "Read + write all",
    lastUsed: "5 minutes ago",
    initials: "AD",
    color: "var(--success)",
  },
  {
    name: "Public blog preview",
    desc: "Renders a read-only preview for marketing pages.",
    perms: "Read public analyses",
    lastUsed: "2 weeks ago",
    initials: "BP",
    color: "var(--warn)",
    stale: true,
  },
  {
    name: "Deprecated Zapier zap",
    desc: "Legacy billing exporter. Scheduled for removal in Q3.",
    perms: "Read invoices",
    lastUsed: "Never",
    initials: "ZP",
    color: "var(--danger)",
    inactive: true,
  },
];

export function ConnectedAppsPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Integrations</span>
        <h1 className="demo-app__hero-title">Connected apps</h1>
        <p className="demo-app__hero-sub">OAuth applications authorized to access your Quanta workspace.</p>
      </header>
      <div className="demo-app__body">
        <div className="demo-block" style={{ marginBottom: "var(--space-3)" }}>
          <div className="demo-block__body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ color: "var(--fg-subtle)", marginTop: 2 }}>
              <ShieldAlert size={16} strokeWidth={1.8} />
            </span>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
              Connected apps use OAuth 2.0 to act on your behalf. Revoking a token here takes effect
              immediately and cannot be undone — the app will need to re-authorize from scratch.
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Authorized applications</div>
              <div className="demo-block__sub">{APPS.length} active tokens.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {APPS.map((a) => (
              <div
                key={a.name}
                className="demo-row"
                style={{ gridTemplateColumns: "auto minmax(0,1fr) auto auto auto", gap: 16, alignItems: "center" }}
              >
                <span
                  className="demo-avatar"
                  style={{ background: a.color, color: "var(--bg)", fontWeight: 600 }}
                >
                  {a.initials}
                </span>
                <div className="demo-row__primary">
                  <div className="demo-row__title">
                    {a.name}
                    {a.stale && (
                      <span className="demo-badge demo-badge--warn" style={{ marginLeft: 8 }}>Stale</span>
                    )}
                    {a.inactive && (
                      <span className="demo-badge demo-badge--warn" style={{ marginLeft: 8 }}>Inactive</span>
                    )}
                  </div>
                  <div className="demo-row__sub">
                    {a.desc} · <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{a.perms}</span>
                  </div>
                </div>
                <span style={{ color: "var(--fg-subtle)", fontSize: "var(--fs-xs)" }}>
                  Last used {a.lastUsed}
                </span>
                <button className="demo-btn demo-btn--danger">Revoke</button>
                <button
                  aria-label="More"
                  className="demo-btn demo-btn--ghost"
                  style={{ padding: 0, width: 28, height: 28 }}
                >
                  <ChevronRight size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-block" style={{ marginTop: "var(--space-3)" }}>
          <div
            className="demo-block__body"
            style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: "var(--fs-md)", color: "var(--fg)" }}>
                Developers: register a new OAuth app
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 4 }}>
                Building something on top of Quanta? Create an OAuth client to request scoped access
                from your users.
              </div>
            </div>
            <button className="demo-btn demo-btn--ghost">
              <BookOpen size={13} strokeWidth={1.8} /> Read the OAuth docs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
