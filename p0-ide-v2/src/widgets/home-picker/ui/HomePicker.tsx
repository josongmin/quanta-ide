import { useMemo, useState, type ReactNode } from "react";
import {
  featureRegistry,
  useFeatureRegistry,
  type FeatureCategory,
  type FeatureRecord,
  type FeatureState,
} from "@/shared/model/feature-registry";
import "./home-picker.css";

type Choice = "repo" | "agent" | "pr";

interface HomePickerProps {
  onPick?: (choice: Choice, label: string) => void;
}

const CATEGORIES: { id: FeatureCategory; label: string }[] = [
  { id: "intelligence", label: "Intelligence" },
  { id: "editing", label: "Editing" },
  { id: "rules", label: "Rules" },
  { id: "integration", label: "Integration" },
  { id: "workflow", label: "Workflow" },
];

function CategoryIcon({ category }: { category: FeatureCategory }): ReactNode {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (category) {
    case "workflow":
      return (
        <svg {...common}>
          <path d="M2 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "intelligence":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "editing":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case "integration":
      return (
        <svg {...common}>
          <path d="M9 2v6" />
          <path d="M15 2v6" />
          <path d="M7 8h10v4a5 5 0 0 1-10 0z" />
          <path d="M12 17v5" />
        </svg>
      );
    case "rules":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 8h14" />
          <path d="M5 8 2 14a4 4 0 0 0 6 0z" />
          <path d="M19 8l-3 6a4 4 0 0 0 6 0z" />
          <path d="M8 21h8" />
        </svg>
      );
  }
}

function stateLabel(s: FeatureRecord["state"]): string {
  return s;
}

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

interface SparkDay {
  add: number;
  del: number;
}

const recents: {
  name: string;
  branch: string;
  changes: number;
  status: RecentStatus;
  time: string;
  spark: SparkDay[];
  insight: Insight;
}[] = [
  {
    name: "payments-api", branch: "main", changes: 3, status: "changes", time: "1h ago",
    spark: [
      { add: 12, del: 4 }, { add: 0, del: 0 }, { add: 28, del: 9 }, { add: 18, del: 6 },
      { add: 0, del: 0 }, { add: 36, del: 14 }, { add: 9, del: 3 }, { add: 22, del: 8 },
      { add: 0, del: 0 }, { add: 31, del: 11 }, { add: 48, del: 18 }, { add: 20, del: 7 },
      { add: 11, del: 4 }, { add: 30, del: 10 },
    ],
    insight: {
      additions: 240, deletions: 87,
      authors: ["R", "D"],
      tags: [{ kind: "commits", n: 3 }],
    },
  },
  {
    name: "order-service", branch: "feat/checkout", changes: 0, status: "clean", time: "3h ago",
    spark: [
      { add: 18, del: 22 }, { add: 8, del: 14 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 6, del: 9 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 0, deletions: 0,
      authors: [],
      tags: [{ kind: "quiet" }],
    },
  },
  {
    name: "ledger-core", branch: "main", changes: 12, status: "review", time: "yesterday",
    spark: [
      { add: 0, del: 0 }, { add: 14, del: 3 }, { add: 22, del: 5 }, { add: 0, del: 0 },
      { add: 48, del: 12 }, { add: 33, del: 9 }, { add: 20, del: 6 }, { add: 62, del: 18 },
      { add: 95, del: 28 }, { add: 74, del: 20 }, { add: 42, del: 11 }, { add: 110, del: 34 },
      { add: 82, del: 24 }, { add: 130, del: 40 },
    ],
    insight: {
      additions: 1240, deletions: 340,
      authors: ["M", "J", "R", "D"],
      tags: [{ kind: "commits", n: 14 }, { kind: "pr", n: 1 }, { kind: "rebase" }],
    },
  },
  {
    name: "auth-gateway", branch: "release/0.4", changes: 1, status: "changes", time: "2d ago",
    spark: [
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 9, del: 2 }, { add: 0, del: 0 },
      { add: 16, del: 3 }, { add: 24, del: 5 }, { add: 40, del: 8 }, { add: 32, del: 6 },
      { add: 18, del: 4 }, { add: 10, del: 2 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 8, del: 2 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 45, deletions: 8,
      authors: ["M"],
      tags: [{ kind: "commits", n: 1 }, { kind: "release", v: "v0.4" }],
    },
  },
  {
    name: "search-index", branch: "main", changes: 0, status: "clean", time: "5d ago",
    spark: [
      { add: 28, del: 10 }, { add: 20, del: 7 }, { add: 36, del: 12 }, { add: 10, del: 4 },
      { add: 26, del: 9 }, { add: 18, del: 6 }, { add: 0, del: 0 }, { add: 11, del: 4 },
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 180, deletions: 60,
      authors: ["D", "K"],
      tags: [{ kind: "commits", n: 7 }, { kind: "cve" }],
    },
  },
];

export function HomePicker(_props: HomePickerProps) {
  void _props;
  const [showAll, setShowAll] = useState(false);
  const featuresMap = useFeatureRegistry((s) => s.features);
  const allFeatures = useMemo(() => {
    const stateOrder: Record<FeatureState, number> = { error: 0, active: 1, disabled: 2 };
    return [...featuresMap.values()]
      .filter((f) => f.visibility === "user")
      .sort((a, b) => {
        const sd = stateOrder[a.state] - stateOrder[b.state];
        return sd !== 0 ? sd : a.title.localeCompare(b.title);
      });
  }, [featuresMap]);

  const primaryFeatures = useMemo(
    () => allFeatures.filter((f) => f.primary).slice(0, 3),
    [allFeatures],
  );
  const primaryIds = useMemo(
    () => new Set(primaryFeatures.map((f) => f.id)),
    [primaryFeatures],
  );
  const nonPrimary = useMemo(
    () => allFeatures.filter((f) => !primaryIds.has(f.id)),
    [allFeatures, primaryIds],
  );
  const nonPrimaryCompact = useMemo(() => nonPrimary.slice(0, 8), [nonPrimary]);

  const runNonPrimary = (f: FeatureRecord): void => {
    const first = f.commands?.[0];
    if (first) featureRegistry.runCommand(first.id);
  };

  const runCapability = (f: FeatureRecord): void => {
    if (f.primary) {
      f.primary.tileRun();
      return;
    }
    const first = f.commands?.[0];
    if (first) featureRegistry.runCommand(first.id);
  };

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
          {primaryFeatures.map((f) => {
            const p = f.primary;
            if (!p) return null;
            return (
              <button
                key={f.id}
                type="button"
                className="hp__card"
                onClick={() => p.tileRun()}
                title={p.tileLabel}
              >
                <span className="hp__card-icon" aria-hidden>
                  {f.icon ?? <CategoryIcon category={f.category} />}
                </span>
                <span className="hp__card-body">
                  <span className="hp__card-label">{p.tileLabel}</span>
                  <span className="hp__card-sub">{f.description}</span>
                </span>
                {p.tileHint && (
                  <span className="hp__card-hint" aria-hidden>
                    {p.tileHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="hp__more">
          <div className="hp__more-label">more capabilities</div>
          <div className="hp__more-list">
            {nonPrimaryCompact.map((f) => (
              <button
                key={f.id}
                type="button"
                className="hp__more-item"
                onClick={() => runNonPrimary(f)}
                title={f.description}
              >
                {f.title}
              </button>
            ))}
          </div>
          {!showAll && (
            <button
              type="button"
              className="hp__more-browse"
              onClick={() => setShowAll(true)}
            >
              browse all →
            </button>
          )}
        </div>

        {showAll ? (
          <section className="hp__browse">
            <header className="hp__browse-head">
              <h3 className="hp__browse-title">All Capabilities</h3>
              <button
                type="button"
                className="hp__browse-back"
                onClick={() => setShowAll(false)}
              >
                ← back
              </button>
            </header>
            <div className="hp__browse-cats">
              {CATEGORIES.map((cat) => {
                const items = allFeatures.filter((f) => f.category === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id} className="hp__browse-cat">
                    <h4 className="hp__browse-cat-label">{cat.label}</h4>
                    <div className="hp__browse-grid">
                      {items.map((f) => (
                        <CapabilityCard
                          key={f.id}
                          feature={f}
                          onRun={() => runCapability(f)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
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
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Capability card — used by the expanded browse-all grid
   ══════════════════════════════════════════════════════════════ */
function CapabilityCard({
  feature,
  onRun,
}: {
  feature: FeatureRecord;
  onRun: () => void;
}) {
  const kbd = feature.commands?.[0]?.keybinding;
  const stateCls =
    feature.state === "disabled"
      ? " hp__cap-state--disabled"
      : feature.state === "error"
        ? " hp__cap-state--error"
        : "";
  const badge = feature.badge;
  return (
    <button type="button" className="hp__cap" onClick={onRun} title={feature.description}>
      {badge && (
        <span className={`hp__cap-badge hp__cap-badge--${badge}`} aria-hidden>
          {badge}
        </span>
      )}
      <h5 className="hp__cap-title">{feature.title}</h5>
      <p className="hp__cap-desc">{feature.description}</p>
      <span className="hp__cap-foot">
        <span className={`hp__cap-state${stateCls}`}>
          <span className="hp__cap-dot" aria-hidden />
          {stateLabel(feature.state)}
        </span>
        {kbd && <span className="hp__cap-kbd">{kbd}</span>}
      </span>
    </button>
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

function Sparkbar({ values }: { values: SparkDay[] }) {
  const max = Math.max(1, ...values.map((d) => Math.max(d.add, d.del)));
  const totalAdd = values.reduce((s, d) => s + d.add, 0);
  const totalDel = values.reduce((s, d) => s + d.del, 0);
  return (
    <span
      className="hp__sparkbar"
      aria-label={`+${totalAdd} / −${totalDel} over last ${values.length} days`}
      title={`+${totalAdd} · −${totalDel} · last ${values.length} days`}
    >
      {values.map((d, i) => {
        const empty = d.add === 0 && d.del === 0;
        const addH = empty ? 0 : Math.max(6, (d.add / max) * 100);
        const delH = empty ? 0 : Math.max(6, (d.del / max) * 100);
        return (
          <span key={i} className="hp__sparkbar-day" aria-hidden>
            <span className="hp__sparkbar-add" style={{ height: `${addH}%` }} />
            <span className="hp__sparkbar-axis" />
            <span className="hp__sparkbar-del" style={{ height: `${delH}%` }} />
          </span>
        );
      })}
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
