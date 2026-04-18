import { DemoAppHero } from "../../internal/DemoAppHero";

interface Component {
  name: string;
  bars: Array<"ok" | "degraded" | "outage">;
  uptime: string;
}

function buildBars(incidents: Array<{ at: number; kind: "degraded" | "outage" }>): Component["bars"] {
  const len = 60;
  const out: Component["bars"] = [];
  for (let i = 0; i < len; i++) {
    const hit = incidents.find((x) => x.at === i);
    out.push(hit ? hit.kind : "ok");
  }
  return out;
}

const COMPONENTS: Component[] = [
  { name: "Web app (app.quanta.dev)",   bars: buildBars([]),                                                 uptime: "99.99%" },
  { name: "Analysis engines",           bars: buildBars([{ at: 38, kind: "degraded" }]),                      uptime: "99.94%" },
  { name: "Code Universe canvas",       bars: buildBars([]),                                                 uptime: "99.99%" },
  { name: "API (api.quanta.dev)",       bars: buildBars([{ at: 14, kind: "degraded" }, { at: 45, kind: "outage" }]), uptime: "99.88%" },
  { name: "Auth & SSO",                 bars: buildBars([]),                                                 uptime: "100.00%" },
  { name: "Webhooks delivery",          bars: buildBars([{ at: 9, kind: "degraded" }, { at: 32, kind: "degraded" }]), uptime: "99.91%" },
  { name: "Notifications delivery",     bars: buildBars([]),                                                 uptime: "99.97%" },
];

const INCIDENTS = [
  { when: "Apr 12, 14:20 KST", title: "Elevated 5xx on api.quanta.dev",        status: "Resolved",   duration: "32 min" },
  { when: "Apr 07, 09:42 KST", title: "Webhook delivery delays",               status: "Resolved",   duration: "1h 18m" },
  { when: "Mar 28, 23:11 KST", title: "Intermittent canvas WebGL flickering",  status: "Monitoring", duration: "—" },
];

export function StatusPage() {
  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Status"
        title="All systems normal"
        sub="Uptime for the past 60 days. Subscribe to get notified when a component degrades."
      />
      <div className="demo-app__body">
        <div className="demo-block">
          <div className="demo-block__body demo-block__body--flush">
            {COMPONENTS.map((c) => (
              <div key={c.name} className="demo-status-row">
                <div>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--fg-subtle)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {c.uptime} uptime · 60 days
                  </div>
                </div>
                <div className="demo-status-row__bars">
                  {c.bars.map((b, i) => (
                    <span
                      key={i}
                      className={"demo-status-row__bar" + (b === "degraded" ? " is-degraded" : b === "outage" ? " is-outage" : "")}
                      title={b}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Recent incidents</div>
              <div className="demo-block__sub">Last 30 days</div>
            </div>
            <span className="demo-sectionbar__spacer" />
            <button className="demo-btn demo-btn--ghost">Subscribe to updates</button>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {INCIDENTS.map((i) => (
              <div key={i.title} className="demo-row" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                <div className="demo-row__primary">
                  <div className="demo-row__title">{i.title}</div>
                  <div className="demo-row__sub">{i.when} · duration {i.duration}</div>
                </div>
                <span className={"demo-badge" + (i.status === "Resolved" ? " demo-badge--success" : " demo-badge--warn")}>
                  {i.status}
                </span>
                <button className="demo-btn demo-btn--ghost">Postmortem</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
