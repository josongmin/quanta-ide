import { useState } from "react";
import { ChevronUp, MessageSquare, Search } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";
import { Avatars } from "../../internal/Avatars";

interface RoadmapItem {
  id: string;
  tags: string[];
  title: string;
  description: string;
  votes: number;
  voted?: boolean;
  comments: number;
  subscribers: string[];
  progress?: number; // 0–100 (in-progress only)
  shipDate?: string; // e.g. "Apr 8" (shipped only)
}

const UNDER: RoadmapItem[] = [
  {
    id: "u1",
    tags: ["Editor", "Stretch"],
    title: "Monaco editor parity",
    description: "Full multi-cursor, command palette, and extension-compatible key bindings, so Quanta can be a daily driver.",
    votes: 512,
    comments: 84,
    subscribers: ["Grace Hopper", "Ada Lovelace", "Linus Torvalds", "Rich Hickey"],
  },
  {
    id: "u2",
    tags: ["Agent", "Security"],
    title: "Self-hosted runtime",
    description: "Deploy the analysis runtime inside your own VPC — code never leaves the perimeter, keys stay in KMS.",
    votes: 342,
    voted: true,
    comments: 41,
    subscribers: ["Margaret Hamilton", "Katherine Johnson", "Alan Kay"],
  },
  {
    id: "u3",
    tags: ["Policies", "DX"],
    title: "Custom policy DSL",
    description: "Author rules as typed, composable predicates instead of YAML. First-class literals for symbols and edges.",
    votes: 218,
    comments: 33,
    subscribers: ["Barbara Liskov", "Donald Knuth"],
  },
  {
    id: "u4",
    tags: ["Agent"],
    title: "Agent screen sharing",
    description: "Let the agent drive a live preview while you watch — useful for end-to-end reproduction of flaky bugs.",
    votes: 94,
    comments: 12,
    subscribers: ["Guido van Rossum", "Anders Hejlsberg"],
  },
];

const PLANNED: RoadmapItem[] = [
  {
    id: "p1",
    tags: ["Integrations", "IaC"],
    title: "Terraform provider",
    description: "Provision workspaces, policies, and SSO from Terraform. Ships with a starter module for enterprise orgs.",
    votes: 287,
    voted: true,
    comments: 24,
    subscribers: ["Grady Booch", "Martin Fowler", "Kent Beck"],
  },
  {
    id: "p2",
    tags: ["Integrations", "Observability"],
    title: "Datadog log bridge",
    description: "Forward policy violations and agent runs to Datadog — full trace correlation on service names.",
    votes: 164,
    comments: 19,
    subscribers: ["Bjarne Stroustrup", "James Gosling"],
  },
  {
    id: "p3",
    tags: ["Integrations", "Agent"],
    title: "Policy bot for chat",
    description: "Post structural-integrity digests to a channel, and let teammates triage violations without leaving chat.",
    votes: 112,
    comments: 15,
    subscribers: ["Rob Pike", "Ken Thompson", "Brian Kernighan"],
  },
];

const IN_PROGRESS: RoadmapItem[] = [
  {
    id: "g1",
    tags: ["Canvas", "Performance"],
    title: "Canvas minimap",
    description: "Always-on minimap with hotspots for violations and recent edits. Scrubbing jumps the viewport.",
    votes: 201,
    voted: true,
    comments: 27,
    subscribers: ["Joe Armstrong", "Alan Turing", "John McCarthy"],
    progress: 70,
  },
  {
    id: "g2",
    tags: ["Intelligence", "Engine"],
    title: "Python engine v2",
    description: "Full re-export and dataclass awareness, with 3× faster incremental indexing on large monorepos.",
    votes: 176,
    comments: 22,
    subscribers: ["Guido van Rossum", "Raymond Hettinger", "David Beazley"],
    progress: 40,
  },
];

const SHIPPED: RoadmapItem[] = [
  {
    id: "s1",
    tags: ["Integrations", "Security"],
    title: "SCIM provisioning",
    description: "Okta, Azure AD, and Google Workspace push users and groups in near-realtime.",
    votes: 138,
    comments: 11,
    subscribers: ["Radia Perlman", "Whitfield Diffie"],
    shipDate: "Apr 8",
  },
  {
    id: "s2",
    tags: ["Canvas", "Flagship"],
    title: "Multi-file canvas",
    description: "Pan across your repo like a map. Every file renders as expanded code with inline symbol chips.",
    votes: 408,
    voted: true,
    comments: 56,
    subscribers: ["Ivan Sutherland", "Douglas Engelbart", "Alan Kay", "Bret Victor"],
    shipDate: "Mar 28",
  },
  {
    id: "s3",
    tags: ["Security"],
    title: "OIDC SSO",
    description: "Generic OIDC SSO with group mapping. SAML still available for legacy IdPs.",
    votes: 88,
    comments: 7,
    subscribers: ["Radia Perlman", "Bruce Schneier"],
    shipDate: "Mar 15",
  },
];

const FILTERS = ["All", "Intelligence", "Canvas", "Policies", "Agent", "Editor", "Integrations"] as const;
type Filter = typeof FILTERS[number];

function UpvoteButton({ count, initiallyVoted }: { count: number; initiallyVoted?: boolean }) {
  const [voted, setVoted] = useState(!!initiallyVoted);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const n = voted ? count + (initiallyVoted ? 0 : 1) : count - (initiallyVoted ? 1 : 0);
  return (
    <button
      type="button"
      onClick={() => setVoted((v) => !v)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      aria-pressed={voted}
      aria-label={voted ? `Remove upvote (${n})` : `Upvote (${n})`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-1) var(--space-2) var(--space-1) var(--space-1h)",
        height: 24,
        border: `1px solid ${voted ? "var(--accent)" : hover ? "var(--border-strong)" : "var(--border)"}`,
        background: voted ? "var(--bg-accent-subtle)" : hover ? "var(--bg-hover)" : "var(--bg)",
        color: voted ? "var(--accent)" : "var(--fg-muted)",
        borderRadius: "var(--radius-pill)",
        font: "inherit",
        fontSize: "var(--fs-10)",
        fontWeight: "var(--fw-bold)",
        letterSpacing: "0.04em",
        cursor: "pointer",
        outline: focus ? "2px solid var(--accent)" : "none",
        outlineOffset: 2,
        transition: "all 0.14s ease",
      }}
    >
      <ChevronUp size={11} strokeWidth={2.4} aria-hidden="true" /> {n}
    </button>
  );
}

function FeatureCard({ item, dim }: { item: RoadmapItem; dim?: boolean }) {
  const pct = item.progress != null ? `${item.progress}%` : "0%";
  return (
    <article
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg)",
        padding: "var(--space-3) var(--space-3h)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        transition: "border-color 0.14s ease, transform 0.14s ease",
        opacity: dim ? 0.78 : 1,
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
        {item.tags.map((t) => (
          <span key={t} className="demo-badge">{t}</span>
        ))}
      </div>
      <h4
        style={{
          margin: 0,
          fontSize: "var(--fs-sm)",
          fontWeight: "var(--fw-semibold)",
          letterSpacing: "-0.005em",
          lineHeight: "var(--lh-snug)",
          color: "var(--fg)",
        }}
      >
        {item.title}
      </h4>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-xs)",
          color: "var(--fg-muted)",
          lineHeight: "var(--lh-relaxed)",
        }}
      >
        {item.description}
      </p>
      {item.progress != null && (
        <div className="demo-progress demo-progress--warn" style={{ marginTop: 2 }}>
          <div className="demo-progress__bar">
            <div className="demo-progress__fill" style={{ width: pct }} />
          </div>
          <div className="demo-progress__meta">
            <span>Building</span>
            <span>{item.progress}%</span>
          </div>
        </div>
      )}
      {item.shipDate && (
        <span
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: "var(--fw-semibold)",
          }}
        >
          Shipped {item.shipDate}
        </span>
      )}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          marginTop: "var(--space-1)",
        }}
      >
        <UpvoteButton count={item.votes} initiallyVoted={item.voted} />
        <span
          aria-label={`${item.comments} comments`}
          style={{
            fontSize: "var(--fs-10)",
            color: "var(--fg-subtle)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
          }}
        >
          <MessageSquare size={11} strokeWidth={1.8} aria-hidden="true" /> {item.comments}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Avatars names={item.subscribers} max={3} />
        </span>
      </footer>
    </article>
  );
}

interface ColumnProps {
  title: string;
  tone: "default" | "accent" | "warn" | "success";
  items: RoadmapItem[];
  dim?: boolean;
}

function Column({ title, tone, items, dim }: ColumnProps) {
  const dotClass =
    tone === "accent"  ? "demo-dot demo-dot--accent"
  : tone === "warn"    ? "demo-dot demo-dot--warn"
  : tone === "success" ? "demo-dot demo-dot--success"
  :                      "demo-dot";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2h)", minWidth: 0 }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "var(--space-1h) var(--space-1)",
          borderBottom: "1px dashed var(--border)",
        }}
      >
        <span className={dotClass} />
        <h3
          style={{
            margin: 0,
            fontSize: "var(--fs-xs)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          {title}
        </h3>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "var(--fs-10)",
            padding: "1px 8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--bg-muted)",
            color: "var(--fg-subtle)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {items.length}
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2h)" }}>
        {items.map((item) => (
          <FeatureCard key={item.id} item={item} dim={dim} />
        ))}
      </div>
    </div>
  );
}

export function RoadmapPage() {
  const [filter, setFilter] = useState<Filter>("All");

  const keep = (items: RoadmapItem[]) =>
    filter === "All" ? items : items.filter((i) => i.tags.includes(filter));

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Updates"
        title="Public roadmap"
        sub="What we're planning, building, and shipping. Upvote the work that matters to you."
      />
      <div className="demo-app__body">

        <div className="demo-sectionbar" style={{ alignItems: "center", gap: "var(--space-3)" }}>
          <div className="demo-billing-toggle" style={{ marginBottom: 0, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? "is-active" : ""}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="demo-sectionbar__spacer" />
          <div
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Search
              size={13}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: 10,
                color: "var(--fg-subtle)",
                pointerEvents: "none",
              }}
            />
            <input
              className="demo-input"
              placeholder="Search ideas"
              style={{ width: 240, paddingLeft: 30 }}
              aria-label="Search ideas"
            />
          </div>
          <button type="button" className="demo-btn demo-btn--primary">+ Submit idea</button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "var(--space-3)",
            minHeight: 520,
            marginTop: "var(--space-3)",
          }}
        >
          <Column title="Under consideration" tone="default" items={keep(UNDER)} />
          <Column title="Planned" tone="accent" items={keep(PLANNED)} />
          <Column title="In progress" tone="warn" items={keep(IN_PROGRESS)} />
          <Column title="Shipped" tone="success" items={keep(SHIPPED)} dim />
        </div>

      </div>
    </div>
  );
}
