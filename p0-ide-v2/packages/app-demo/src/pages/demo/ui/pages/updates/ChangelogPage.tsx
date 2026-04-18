import { Rss, Sparkles } from "lucide-react";

type Tag = "Feature" | "Improvement" | "Fix" | "Security";

interface Entry {
  date: string;
  version: string;
  tag: Tag;
  title: string;
  bullets: string[];
  code?: string;
  screenshot?: string;
}

const ENTRIES: Entry[] = [
  {
    date: "2026-04-19",
    version: "v2026.04.19",
    tag: "Feature",
    title: "Try demo lives in the sidebar",
    bullets: [
      "A new demo shell lets you browse every mockup surface without leaving the IDE.",
      "Opens with ⌘⇧D. Deep-links like demo://billing.pricing work from anywhere.",
      "Each demo page is a real React screen — handy as a design reference.",
    ],
    screenshot: "Try demo — sidebar shell",
  },
  {
    date: "2026-04-12",
    version: "v2026.04.12",
    tag: "Improvement",
    title: "Code Universe: 4× faster initial paint",
    bullets: [
      "Ground-data batching now streams symbol metadata before geometry, so the canvas never shows placeholder blocks.",
      "LOD sync pipelines merged — 38% fewer frame stalls on 10k-symbol repos.",
      "Viewport hook now drops idle callbacks under 55fps instead of thrashing them.",
    ],
    code: "canvas.render({ lod: \"adaptive\", batch: \"ground-data\" })",
  },
  {
    date: "2026-04-05",
    version: "v2026.04.05",
    tag: "Fix",
    title: "Policies: matcher escaping on Windows paths",
    bullets: [
      "Backslash-separated paths in .quanta/policies.yml no longer trip the glob engine.",
      "Case-insensitive matches honor the workspace root rather than the CLI cwd.",
      "Fixed a regression where negated matchers silently matched zero files.",
    ],
  },
  {
    date: "2026-03-28",
    version: "v2026.03.28",
    tag: "Feature",
    title: "Multi-file canvas with live LOD",
    bullets: [
      "Pan across your repo like a map. Every file renders as expanded code with inline symbol chips.",
      "Level-of-detail transitions dynamically — from outline to full source in one zoom.",
      "Ships with 4 themes and a debug HUD behind ?debug=1.",
    ],
    screenshot: "Code Universe — full repo pan",
  },
  {
    date: "2026-03-15",
    version: "v2026.03.15",
    tag: "Security",
    title: "SSO: SCIM provisioning GA",
    bullets: [
      "Okta, Azure AD, and Google Workspace can now push users, groups, and role mappings.",
      "Deprovisioning is near-realtime; audit events carry the SCIM request ID.",
      "SOC 2 Type II report refreshed for 2026 — available under Legal.",
    ],
  },
];

const TAG_BADGE: Record<Tag, string> = {
  Feature:     "demo-badge demo-badge--accent",
  Improvement: "demo-badge demo-badge--success",
  Fix:         "demo-badge demo-badge--warn",
  Security:    "demo-badge demo-badge--danger",
};

function Screenshot({ label }: { label: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        aspectRatio: "16 / 9",
        width: "100%",
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--fg-subtle)",
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
      aria-label={`screenshot: ${label}`}
    >
      screenshot · {label}
    </div>
  );
}

export function ChangelogPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero">
        <span className="demo-app__hero-kicker">Updates</span>
        <h1 className="demo-app__hero-title">What&apos;s new in Quanta</h1>
        <p className="demo-app__hero-sub">Ship log, curated. Subscribe to the RSS or email digest.</p>
      </header>
      <div className="demo-app__body">

        <div className="demo-sectionbar" style={{ marginBottom: 16 }}>
          <Sparkles size={16} strokeWidth={1.8} style={{ color: "var(--accent)" }} />
          <div>
            <div className="demo-sectionbar__title">Subscribe</div>
            <div className="demo-sectionbar__desc">One short email, every other Friday.</div>
          </div>
          <span className="demo-sectionbar__spacer" />
          <div style={{ display: "grid", gridTemplateColumns: "240px auto auto", gap: 8, alignItems: "center" }}>
            <input className="demo-input" type="email" placeholder="you@acme.com" aria-label="Subscribe email" />
            <button className="demo-btn demo-btn--primary">Subscribe</button>
            <button className="demo-btn demo-btn--ghost">
              <Rss size={13} strokeWidth={1.8} /> RSS feed
            </button>
          </div>
        </div>

        {ENTRIES.map((e) => (
          <div key={e.version} className="demo-block">
            <header className="demo-block__head">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  className="is-mono"
                  style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", letterSpacing: "0.02em" }}
                >
                  {e.date}
                </span>
                <span className="demo-badge">{e.version}</span>
                <span className={TAG_BADGE[e.tag]}>{e.tag}</span>
              </div>
            </header>
            <div className="demo-block__body">
              <h3
                style={{
                  margin: 0,
                  fontSize: "var(--fs-lg)",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                {e.title}
              </h3>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--fg-muted)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
                {e.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              {e.code && <pre className="demo-code" style={{ marginTop: 12 }}>{e.code}</pre>}
              {e.screenshot && <Screenshot label={e.screenshot} />}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
