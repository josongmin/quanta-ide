import { useState } from "react";
import {
  Activity,
  Bug,
  CheckSquare,
  Gauge,
  GitBranch,
  GitMerge,
  Kanban,
  Key,
  ListTodo,
  MessageCircle,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";

type Integration = {
  name: string;
  category: string;
  blurb: string;
  icon: typeof GitBranch;
  connected?: boolean;
};

const INTEGRATIONS: Integration[] = [
  { name: "GitHub",         category: "Source control",   blurb: "Sync repositories, pull requests, and review signals.",       icon: GitBranch,      connected: true },
  { name: "GitLab",         category: "Source control",   blurb: "Mirror projects and wire up merge-request analyses.",          icon: GitBranch },
  { name: "Bitbucket",      category: "Source control",   blurb: "Import pipelines and branch protections.",                     icon: GitMerge },
  { name: "Slack",          category: "Chat",             blurb: "Post policy violations and review requests to a channel.",    icon: MessageSquare,  connected: true },
  { name: "Microsoft Teams",category: "Chat",             blurb: "Deliver digest and incident pings to your tenant.",            icon: Users },
  { name: "Discord",        category: "Chat",             blurb: "Route low-priority notifications to a community server.",      icon: MessageCircle },
  { name: "Jira",           category: "Task management",  blurb: "File tickets from findings with two-way sync on status.",      icon: Kanban,         connected: true },
  { name: "Linear",         category: "Task management",  blurb: "Create issues directly from Quanta review comments.",          icon: ListTodo },
  { name: "Asana",          category: "Task management",  blurb: "Push action items into your project boards.",                  icon: CheckSquare },
  { name: "CircleCI",       category: "CI/CD",            blurb: "Trigger analyses on build steps, gate deploys on results.",    icon: RefreshCw },
  { name: "GitHub Actions", category: "CI/CD",            blurb: "Run the Quanta step in your existing workflow YAML.",          icon: Play,           connected: true },
  { name: "Jenkins",        category: "CI/CD",            blurb: "Attach the shared library to any freestyle or pipeline job.",  icon: Workflow },
  { name: "Datadog",        category: "Observability",    blurb: "Stream metrics and dashboards for policy drift over time.",    icon: Gauge },
  { name: "Grafana",        category: "Observability",    blurb: "Point a datasource at Quanta and chart anything you like.",    icon: Activity },
  { name: "Sentry",         category: "Observability",    blurb: "Correlate runtime errors with recent structural changes.",     icon: Bug },
  { name: "1Password",      category: "Security",         blurb: "Resolve secrets at analysis time from a shared vault.",        icon: Key },
  { name: "Snyk",           category: "Security",         blurb: "Cross-reference vulnerability findings with your codebase.",   icon: ShieldCheck },
];

const CATEGORIES = ["All", "Source control", "Chat", "CI/CD", "Observability", "Task management", "Security"] as const;

export function MarketplacePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const shown = INTEGRATIONS.filter((i) => {
    const matchCat = cat === "All" || i.category === cat;
    const matchQ = !q || i.name.toLowerCase().includes(q.toLowerCase()) || i.blurb.toLowerCase().includes(q.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Integrations</span>
        <h1 className="demo-app__hero-title">Marketplace</h1>
        <p className="demo-app__hero-sub">Connect Quanta to the tools your team already uses.</p>
      </header>
      <div className="demo-app__body">
        <div className="demo-sectionbar">
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "1px solid var(--border)", padding: "0 10px", height: 28,
              borderRadius: "var(--radius-sm)", background: "var(--bg)",
              color: "var(--fg-subtle)", fontSize: "var(--fs-xs)",
            }}
          >
            <Search size={13} strokeWidth={2} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search integrations"
              style={{ border: 0, outline: "none", background: "transparent", color: "var(--fg)", font: "inherit", width: 180 }}
            />
          </div>
          <span className="demo-sectionbar__spacer" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={"demo-badge" + (cat === c ? " demo-badge--accent" : "")}
                style={{ cursor: "pointer", border: "1px solid var(--border)" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div
          className="demo-grid-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)" }}
        >
          {shown.map((i) => {
            const Icon = i.icon;
            return (
              <div key={i.name} className="demo-catalog__card" style={{ position: "relative", textAlign: "left" }}>
                <div className="demo-catalog__card-head">
                  <span className="demo-catalog__card-icon" aria-hidden>
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="demo-catalog__card-cat">{i.category}</span>
                  <span style={{ marginLeft: "auto" }}>
                    {i.connected ? (
                      <span className="demo-badge demo-badge--success">✓ Connected</span>
                    ) : (
                      <button className="demo-btn demo-btn--ghost" style={{ height: 24, padding: "0 8px", fontSize: "var(--fs-xs)" }}>
                        <Plus size={12} strokeWidth={2} /> Connect
                      </button>
                    )}
                  </span>
                </div>
                <div className="demo-catalog__card-title">{i.name}</div>
                <div className="demo-catalog__card-blurb">{i.blurb}</div>
              </div>
            );
          })}
        </div>

        {shown.length === 0 && (
          <div className="demo-empty">
            <div className="demo-empty__title">No integrations match</div>
            <div className="demo-empty__hint">Try a different category or clear the search.</div>
          </div>
        )}
      </div>
    </div>
  );
}
