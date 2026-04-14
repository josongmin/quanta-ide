import "./home-picker.css";

type Choice = "repo" | "agent" | "pr";

interface HomePickerProps {
  onPick: (choice: Choice, label: string) => void;
}

const cards: {
  id: Choice;
  label: string;
  sub: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "repo",
    label: "Open Repo",
    sub: "Browse and load a repository",
    hint: "⌘ O",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    id: "agent",
    label: "AI Coding Agent",
    sub: "Start a new coding session",
    hint: "⌘ J",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="13" rx="2" />
        <path d="M9 3v3M15 3v3M9 13h.01M15 13h.01M9 17h6" />
      </svg>
    ),
  },
  {
    id: "pr",
    label: "PR Review",
    sub: "Review pull requests with auto-fix",
    hint: "⌘ R",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <circle cx="18" cy="18" r="2.2" />
        <path d="M6 8.2v7.6M18 15.8V11a4 4 0 0 0-4-4h-2.5l2 2m0-4l-2 2" />
      </svg>
    ),
  },
];

type RecentStatus = "clean" | "changes" | "review";

type InsightTag =
  | { kind: "commits"; n: number }
  | { kind: "pr"; n: number }
  | { kind: "rebase" }
  | { kind: "cve" }
  | { kind: "release"; v: string }
  | { kind: "quiet" };

interface Insight {
  additions: number;
  deletions: number;
  authors: string[];
  tags: InsightTag[];
}

const recents: {
  name: string;
  branch: string;
  changes: number;
  status: RecentStatus;
  time: string;
  spark: number[];
  insight: Insight;
}[] = [
  {
    name: "payments-api", branch: "main", changes: 3, status: "changes", time: "1h ago",
    spark: [1, 0, 3, 2, 0, 4, 1, 2, 0, 3, 5, 2, 1, 3],
    insight: {
      additions: 240, deletions: 87,
      authors: ["R", "D"],
      tags: [{ kind: "commits", n: 3 }],
    },
  },
  {
    name: "order-service", branch: "feat/checkout", changes: 0, status: "clean", time: "3h ago",
    spark: [2, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    insight: {
      additions: 0, deletions: 0,
      authors: [],
      tags: [{ kind: "quiet" }],
    },
  },
  {
    name: "ledger-core", branch: "main", changes: 12, status: "review", time: "yesterday",
    spark: [0, 1, 2, 0, 4, 3, 2, 5, 8, 6, 4, 9, 7, 11],
    insight: {
      additions: 1240, deletions: 340,
      authors: ["M", "J", "R", "D"],
      tags: [{ kind: "commits", n: 14 }, { kind: "pr", n: 1 }, { kind: "rebase" }],
    },
  },
  {
    name: "auth-gateway", branch: "release/0.4", changes: 1, status: "changes", time: "2d ago",
    spark: [0, 0, 1, 0, 2, 3, 5, 4, 2, 1, 0, 0, 1, 0],
    insight: {
      additions: 45, deletions: 8,
      authors: ["M"],
      tags: [{ kind: "commits", n: 1 }, { kind: "release", v: "v0.4" }],
    },
  },
  {
    name: "search-index", branch: "main", changes: 0, status: "clean", time: "5d ago",
    spark: [3, 2, 4, 1, 3, 2, 0, 1, 0, 0, 0, 0, 0, 0],
    insight: {
      additions: 180, deletions: 60,
      authors: ["D", "K"],
      tags: [{ kind: "commits", n: 7 }, { kind: "cve" }],
    },
  },
];

export function HomePicker({ onPick }: HomePickerProps) {
  return (
    <div className="hp">
      <div className="hp__inner">
        <header className="hp__head">
          <div className="hp__eyebrow">Software Intelligence Platform</div>
          <h1 className="hp__title">
            Where would you like to <em>start</em>?
          </h1>
        </header>

        <div className="hp__cards">
          {cards.map((c) => (
            <button
              key={c.id}
              type="button"
              className="hp__card"
              onClick={() => onPick(c.id, c.label)}
              title={c.label}
            >
              <span className="hp__card-icon" aria-hidden>
                {c.icon}
              </span>
              <span className="hp__card-body">
                <span className="hp__card-label">{c.label}</span>
                <span className="hp__card-sub">{c.sub}</span>
              </span>
              <span className="hp__card-hint" aria-hidden>
                {c.hint}
              </span>
            </button>
          ))}
        </div>

        <section className="hp__section">
          <div className="hp__section-head">
            <span className="hp__section-label">Recent</span>
            <div className="hp__search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search repositories" />
              <kbd className="hp__search-kbd">⌘ K</kbd>
            </div>
          </div>

          <ul className="hp__list">
            {recents.map((r) => (
              <li key={r.name} className="hp__row" tabIndex={0}>
                <span className="hp__row-thumb" aria-hidden>
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <span className="hp__row-name">
                  <span className="hp__row-name-text">{r.name}</span>
                  <InsightViz insight={r.insight} />
                </span>
                <span className="hp__row-branch">
                  <BranchIcon />
                  {r.branch}
                </span>
                <Sparkbar values={r.spark} />
                <span className={`hp__row-status hp__row-status--${r.status}`}>
                  <span className="hp__row-status-dot" aria-hidden />
                  {r.status === "clean"
                    ? "clean"
                    : r.status === "review"
                      ? `${r.changes} in review`
                      : `${r.changes} ${r.changes === 1 ? "change" : "changes"}`}
                </span>
                <span className="hp__row-time">{r.time}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Insight visualization — diff bar + authors + event tags
   ══════════════════════════════════════════════════════════════ */
function InsightViz({ insight }: { insight: Insight }) {
  const total = insight.additions + insight.deletions;
  const addPct = total > 0 ? (insight.additions / total) * 100 : 0;
  const delPct = 100 - addPct;
  const maxShown = 3;
  const shown = insight.authors.slice(0, maxShown);
  const extra = insight.authors.length - shown.length;

  return (
    <span className="hp__viz">
      {total > 0 && (
        <span
          className="hp__diff"
          title={`+${insight.additions} / −${insight.deletions}`}
          aria-label={`${insight.additions} additions, ${insight.deletions} deletions`}
        >
          <span className="hp__diff-bar" aria-hidden>
            <span className="hp__diff-add" style={{ width: `${addPct}%` }} />
            <span className="hp__diff-del" style={{ width: `${delPct}%` }} />
          </span>
          <span className="hp__diff-text">
            <span className="hp__diff-text-add">+{compact(insight.additions)}</span>
            <span className="hp__diff-text-del">−{compact(insight.deletions)}</span>
          </span>
        </span>
      )}

      {shown.length > 0 && (
        <span className="hp__authors" aria-label={`${insight.authors.length} authors`}>
          {shown.map((a, i) => (
            <span key={i} className="hp__author">{a}</span>
          ))}
          {extra > 0 && (
            <span className="hp__author hp__author--more">+{extra}</span>
          )}
        </span>
      )}

      {insight.tags.length > 0 && (
        <span className="hp__tags">
          {insight.tags.map((t, i) => <InsightTagChip key={i} tag={t} />)}
        </span>
      )}
    </span>
  );
}

function InsightTagChip({ tag }: { tag: InsightTag }) {
  switch (tag.kind) {
    case "commits":
      return (
        <span className="hp__tag" title={`${tag.n} new commits`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="1.5" y1="12" x2="8" y2="12" />
            <line x1="16" y1="12" x2="22.5" y2="12" />
          </svg>
          {tag.n}
        </span>
      );
    case "pr":
      return (
        <span className="hp__tag hp__tag--info" title={`${tag.n} PR merged`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="2.2" />
            <circle cx="6" cy="18" r="2.2" />
            <circle cx="18" cy="18" r="2.2" />
            <path d="M6 8.2v7.6M18 15.8V11a4 4 0 0 0-4-4h-2l2-2m0 4l-2-2" />
          </svg>
          merged
        </span>
      );
    case "rebase":
      return (
        <span className="hp__tag hp__tag--warn" title="Branch history rewritten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <polyline points="3 3 3 8 8 8" />
          </svg>
          rebased
        </span>
      );
    case "cve":
      return (
        <span className="hp__tag hp__tag--danger" title="Security advisory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 2 21h20L12 2z" />
            <line x1="12" y1="10" x2="12" y2="14" />
            <line x1="12" y1="17.5" x2="12" y2="17.6" />
          </svg>
          CVE
        </span>
      );
    case "release":
      return (
        <span className="hp__tag hp__tag--info" title="Release cut">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          {tag.v}
        </span>
      );
    case "quiet":
      return (
        <span className="hp__tag hp__tag--muted" title="No activity since you left">
          quiet
        </span>
      );
  }
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function Sparkbar({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <span
      className="hp__sparkbar"
      aria-label={`${total} commits over last ${values.length} days`}
      title={`${total} commits · last ${values.length} days`}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={`hp__sparkbar-bar${v === 0 ? " hp__sparkbar-bar--zero" : ""}${i === values.length - 1 ? " hp__sparkbar-bar--today" : ""}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function BranchIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
