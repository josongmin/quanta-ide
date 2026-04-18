import { Search, MessageSquare, FileText, BookOpen, Zap, LifeBuoy } from "lucide-react";

const TOPICS = [
  { icon: Zap,        title: "Getting started",    blurb: "Install, first workspace, first analysis.",  count: 14 },
  { icon: BookOpen,   title: "Concepts",           blurb: "Risk, blast, taint, behavior, incidents.",   count: 22 },
  { icon: FileText,   title: "Rules & policies",   blurb: "Write, test, and enforce team rules.",       count: 17 },
  { icon: LifeBuoy,   title: "Troubleshooting",    blurb: "Common errors, log locations, resetting.",   count: 9  },
];

const POPULAR = [
  "How do I add a teammate?",
  "What counts as a seat?",
  "Can I self-host Quanta?",
  "How do I rotate an API key?",
  "What data is shared with AI providers?",
  "How does Code Universe differ from the IDE?",
];

export function HelpPage() {
  return (
    <div className="demo-app">
      <header className="demo-app__hero" style={{ textAlign: "center", padding: "var(--space-6) var(--space-5) var(--space-4)" }}>
        <span className="demo-app__hero-kicker">Help center</span>
        <h1 className="demo-app__hero-title" style={{ fontSize: 24 }}>How can we help?</h1>
        <p className="demo-app__hero-sub" style={{ margin: "0 auto" }}>
          Search 150+ articles, join the community, or talk to a human.
        </p>
      </header>
      <div className="demo-app__body">
        <div className="demo-help-search">
          <Search size={17} strokeWidth={1.8} />
          <input type="search" placeholder="Search articles, guides, and known issues" />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-subtle)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 6px" }}>⌘K</kbd>
        </div>

        <div className="demo-grid-2">
          {TOPICS.map((t) => (
            <button key={t.title} className="demo-catalog__card">
              <div className="demo-catalog__card-head">
                <span className="demo-catalog__card-icon"><t.icon size={15} strokeWidth={1.6} /></span>
                <span className="demo-catalog__card-cat">{t.count} articles</span>
              </div>
              <div className="demo-catalog__card-title">{t.title}</div>
              <div className="demo-catalog__card-blurb">{t.blurb}</div>
            </button>
          ))}
        </div>

        <div className="demo-block" style={{ marginTop: 16 }}>
          <header className="demo-block__head">
            <div className="demo-block__title">Popular questions</div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            {POPULAR.map((q) => (
              <button key={q} className="demo-row" style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer", gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <span style={{ fontSize: "var(--fs-sm)" }}>{q}</span>
                <span className="demo-badge">Guide</span>
              </button>
            ))}
          </div>
        </div>

        <div className="demo-grid-2" style={{ marginTop: 16 }}>
          <div className="demo-block">
            <div className="demo-block__body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <MessageSquare size={18} strokeWidth={1.6} style={{ color: "var(--accent)", marginTop: 2 }} />
              <div>
                <div className="demo-block__title">Chat with support</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", margin: "2px 0 10px" }}>
                  Median first response: 8 minutes · 24×5 for Team+ plans.
                </div>
                <button className="demo-btn demo-btn--primary">Start chat</button>
              </div>
            </div>
          </div>
          <div className="demo-block">
            <div className="demo-block__body" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <LifeBuoy size={18} strokeWidth={1.6} style={{ color: "var(--fg-muted)", marginTop: 2 }} />
              <div>
                <div className="demo-block__title">Open a ticket</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-subtle)", margin: "2px 0 10px" }}>
                  For billing, compliance, or anything needing a paper trail.
                </div>
                <button className="demo-btn demo-btn--ghost">support@quanta.dev</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
