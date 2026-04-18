import { Laptop, Smartphone, Monitor, Tablet, Terminal, LogOut } from "lucide-react";

type DeviceKind = "laptop" | "phone" | "desktop" | "tablet" | "terminal";
type Freshness = "now" | "recent" | "idle";

interface Session {
  id: string;
  kind: DeviceKind;
  client: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  freshness: Freshness;
  thisDevice?: boolean;
  unusual?: boolean;
}

const SESSIONS: Session[] = [
  { id: "s1", kind: "laptop",   client: "Chrome 131",              os: "macOS 15",     location: "Seoul, KR",          ip: "121.210.53.12",  lastActive: "Active now",        freshness: "now",    thisDevice: true },
  { id: "s2", kind: "phone",    client: "Safari",                  os: "iOS 18",       location: "Seoul, KR",          ip: "121.210.53.12",  lastActive: "3 minutes ago",     freshness: "now" },
  { id: "s3", kind: "desktop",  client: "Firefox 128",             os: "Windows 11",   location: "Tokyo, JP",          ip: "203.0.113.41",   lastActive: "1 hour ago",        freshness: "recent" },
  { id: "s4", kind: "laptop",   client: "Quanta extension",        os: "VSCode · macOS", location: "Seoul, KR",        ip: "121.210.53.12",  lastActive: "2 hours ago",       freshness: "recent" },
  { id: "s5", kind: "terminal", client: "curl/8.4",                os: "Linux · API",  location: "Frankfurt, DE",      ip: "198.51.100.7",   lastActive: "1 day ago",         freshness: "idle" },
  { id: "s6", kind: "phone",    client: "Chrome",                  os: "Android 14",   location: "San Francisco, US",  ip: "72.14.248.19",   lastActive: "6 days ago",        freshness: "idle",   unusual: true },
];

function DeviceIcon({ kind }: { kind: DeviceKind }) {
  const props = { size: 16, strokeWidth: 1.8 };
  if (kind === "laptop") return <Laptop {...props} />;
  if (kind === "phone") return <Smartphone {...props} />;
  if (kind === "desktop") return <Monitor {...props} />;
  if (kind === "tablet") return <Tablet {...props} />;
  return <Terminal {...props} />;
}

function dotClass(s: Session) {
  if (s.unusual) return "demo-dot demo-dot--warn";
  if (s.freshness === "now") return "demo-dot demo-dot--success";
  if (s.freshness === "recent") return "demo-dot demo-dot--warn";
  return "demo-dot";
}

export function ActiveSessionsPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Security</span>
        <h1 className="demo-app__hero-title">Active sessions</h1>
        <p className="demo-app__hero-sub">Devices and browsers currently signed in to your account. Revoke any session you don&apos;t recognise.</p>
      </header>
      <div className="demo-app__body">
        <div className="demo-grid-3" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">Total sessions</div>
            <div className="demo-stat__value">6</div>
            <div className="demo-stat__delta" style={{ color: "var(--fg-subtle)" }}>across 5 devices</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Devices</div>
            <div className="demo-stat__value">5</div>
            <div className="demo-stat__delta" style={{ color: "var(--fg-subtle)" }}>2 mobile · 3 desktop</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Last unusual login</div>
            <div className="demo-stat__value" style={{ fontSize: "var(--fs-lg)" }}>6 days ago</div>
            <div className="demo-stat__delta" style={{ color: "var(--warn)" }}>San Francisco, US</div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Signed-in sessions</div>
              <div className="demo-block__sub">Sorted by most recent activity.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {SESSIONS.map((s) => (
              <div key={s.id} className="demo-row" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto auto auto", gap: 16 }}>
                <span className="demo-avatar" aria-hidden><DeviceIcon kind={s.kind} /></span>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{s.client} on {s.os}</div>
                  <div className="demo-row__sub">
                    {s.location} · <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{s.ip}</span>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  <span className={dotClass(s)} />
                  {s.lastActive}
                </div>
                {s.thisDevice ? (
                  <span className="demo-badge demo-badge--success">This device</span>
                ) : s.unusual ? (
                  <span className="demo-badge demo-badge--warn">Unusual</span>
                ) : (
                  <span />
                )}
                <button
                  className="demo-btn demo-btn--danger"
                  disabled={s.thisDevice}
                  aria-label={`Revoke session ${s.client} on ${s.os}`}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
          <footer className="demo-block__foot">
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost" style={{ color: "var(--danger)" }}>
              <LogOut size={13} strokeWidth={1.8} /> Sign out of all other sessions
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
