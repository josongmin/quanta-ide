import { useMemo, useState, type ComponentType } from "react";
import "./pr-page.css";
import {
  PRS,
  FILES,
  FINDINGS,
  REVIEWS,
  SEV_META,
  riskBand,
  type Mode,
  type Severity,
  type FileDiff,
  type Finding,
  type ReviewComment,
} from "@/entities/pr";
import { DiffView } from "./views/DiffView";
import { InsightsView } from "./views/InsightsView";
import { GraphView } from "./views/GraphView";
import { TestsView } from "./views/TestsView";
import { RiskGauge } from "../lib/RiskGauge";
import {
  IconRefresh,
  IconSearch,
  IconBranch,
  IconPrDot,
  IconComment,
  IconClose,
  IconCheck,
  IconMerge,
  IconDiff,
  IconSpark,
  IconGraph,
  IconFlask,
  IconMagic,
} from "../lib/icons";

type ViewProps = {
  file: FileDiff;
  findings: Finding[];
  reviews: ReviewComment[];
};

const VIEW_REGISTRY: Record<Mode, ComponentType<ViewProps>> = {
  diff: ({ file, findings, reviews }) => (
    <DiffView file={file} findings={findings} reviews={reviews} />
  ),
  insights: () => <InsightsView />,
  graph: () => <GraphView />,
  tests: () => <TestsView />,
};


export function PrPage() {
  const [activePrId, setActivePrId] = useState<string>("pr-1284");
  const [mode, setMode] = useState<Mode>("diff");
  const [activePath, setActivePath] = useState<string>("src/payments/retry_handler.py");
  const [findings, setFindings] = useState<Finding[]>(FINDINGS);
  const [reviews, setReviews] = useState<ReviewComment[]>(REVIEWS);
  const [reviewedPaths, setReviewedPaths] = useState<Set<string>>(
    () => new Set(FILES.filter((f) => f.reviewed).map((f) => f.path)),
  );
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "review">("all");
  const [splitView, setSplitView] = useState(false);

  const activePr = useMemo(() => PRS.find((p) => p.id === activePrId)!, [activePrId]);
  const activeFile = useMemo(() => FILES.find((f) => f.path === activePath)!, [activePath]);

  const reviewedCount = reviewedPaths.size;
  const totalFiles = FILES.length;
  const reviewedPct = Math.round((reviewedCount / totalFiles) * 100);

  const openFindings = findings.filter((f) => !f.applied);
  const autofixable = openFindings.filter((f) => f.autofix);
  const openReviews = reviews.filter((r) => !r.resolved && !r.applied);

  const applyFinding = (id: number) =>
    setFindings((list) => list.map((f) => (f.id === id ? { ...f, applied: true } : f)));
  const applyReview = (id: number) =>
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, applied: true, resolved: true } : r)));
  const resolveReview = (id: number) =>
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, resolved: true } : r)));

  const toggleReviewed = (path: string) =>
    setReviewedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const applyAllAutofix = () =>
    setFindings((list) => list.map((f) => (f.autofix && !f.applied ? { ...f, applied: true } : f)));

  const filteredPrs = PRS.filter((p) => {
    if (queueFilter === "mine") return p.author === "songmin";
    if (queueFilter === "review") return p.reviewers.some((r) => r.name === "songmin");
    return true;
  });

  return (
    <div className="pr-page">
      {/* ══════ LEFT: PR queue + file list ══════ */}
      <aside className="pr-page__sidebar">
        <div className="pr-page__sidebar-head">
          <div className="pr-page__sidebar-title">Pull Requests</div>
          <button type="button" className="pr-page__sidebar-btn" title="Refresh" aria-label="Refresh">
            <IconRefresh />
          </button>
        </div>

        <div className="pr-page__filter-tabs" role="tablist">
          {(["all", "mine", "review"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={queueFilter === f}
              className={`pr-page__filter-tab${queueFilter === f ? " is-active" : ""}`}
              onClick={() => setQueueFilter(f)}
            >
              {f === "all" ? "All" : f === "mine" ? "My PRs" : "Review requests"}
              <span className="pr-page__filter-count">
                {f === "all"
                  ? PRS.length
                  : f === "mine"
                    ? PRS.filter((p) => p.author === "songmin").length
                    : PRS.filter((p) => p.reviewers.some((r) => r.name === "songmin")).length}
              </span>
            </button>
          ))}
        </div>

        <div className="pr-page__search">
          <IconSearch />
          <input type="text" placeholder="Search PRs..." />
        </div>

        <nav className="pr-page__queue">
          {filteredPrs.map((pr) => {
            const active = pr.id === activePrId;
            return (
              <button
                key={pr.id}
                type="button"
                className={`pr-page__pr${active ? " is-active" : ""}`}
                onClick={() => setActivePrId(pr.id)}
              >
                <div className="pr-page__pr-top">
                  <span className={`pr-page__pr-state pr-page__pr-state--${pr.state}`}>
                    <IconPrDot />
                  </span>
                  <span className="pr-page__pr-num">#{pr.number}</span>
                  <span className="pr-page__pr-when">{pr.when}</span>
                </div>
                <div className="pr-page__pr-title">{pr.title}</div>
                <div className="pr-page__pr-meta">
                  <span className="pr-page__pr-branch">
                    <IconBranch />
                    {pr.branch}
                  </span>
                  <span className={`pr-page__pr-ci pr-page__pr-ci--${pr.ci}`}>
                    {pr.ci === "pass" ? "✓" : pr.ci === "fail" ? "✕" : "…"} CI
                  </span>
                </div>
                <div className="pr-page__pr-footer">
                  <span className={`pr-page__pr-risk pr-page__pr-risk--${riskBand(pr.risk)}`}>
                    Risk {pr.risk.toFixed(2)}
                  </span>
                  <span className="pr-page__pr-delta">
                    <span className="pr-page__pr-add">+{pr.added}</span>
                    <span className="pr-page__pr-rm">−{pr.removed}</span>
                  </span>
                  <span className="pr-page__pr-avatars">
                    {pr.reviewers.slice(0, 3).map((r) => (
                      <span key={r.name} className={`pr-page__pr-av pr-page__pr-av--${r.status}`} title={r.name}>
                        {r.avatar}
                      </span>
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="pr-page__sidebar-sep" />

        <div className="pr-page__files-head">
          <span>Changed files</span>
          <span className="pr-page__files-count">
            {reviewedCount}/{totalFiles}
          </span>
        </div>

        <ul className="pr-page__files">
          {FILES.map((f) => {
            const active = f.path === activePath;
            const isReviewed = reviewedPaths.has(f.path);
            return (
              <li
                key={f.path}
                className={`pr-page__file${active ? " is-active" : ""}${isReviewed ? " is-reviewed" : ""}`}
                onClick={() => setActivePath(f.path)}
              >
                <span className={`pr-page__file-st pr-page__file-st--${f.status}`}>{f.status}</span>
                <span className="pr-page__file-path" title={f.path}>
                  {f.path}
                </span>
                <span className="pr-page__file-risk" aria-hidden>
                  <span
                    className={`pr-page__file-risk-bar pr-page__file-risk-bar--${riskBand(f.risk)}`}
                    style={{ width: `${Math.max(4, f.risk * 100)}%` }}
                  />
                </span>
                <span className="pr-page__file-nums">
                  <span className="pr-page__file-add">+{f.added}</span>
                  <span className="pr-page__file-rm">−{f.removed}</span>
                </span>
                {(f.findings > 0 || f.comments > 0) && (
                  <span className="pr-page__file-pips">
                    {f.findings > 0 && (
                      <span
                        className="pr-page__file-pip pr-page__file-pip--finding"
                        title={`${f.findings} finding${f.findings > 1 ? "s" : ""}`}
                      >
                        {f.findings}
                      </span>
                    )}
                    {f.comments > 0 && (
                      <span
                        className="pr-page__file-pip pr-page__file-pip--comment"
                        title={`${f.comments} comment${f.comments > 1 ? "s" : ""}`}
                      >
                        {f.comments}
                      </span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ══════ CENTER: header + canvas ══════ */}
      <main className="pr-page__main">
        <header className="pr-page__header">
          <div className="pr-page__hdr-top">
            <div className="pr-page__hdr-ident">
              <span className="pr-page__hdr-num">#{activePr.number}</span>
              <span className="pr-page__hdr-title">{activePr.title}</span>
            </div>
            <div className="pr-page__hdr-actions">
              <button type="button" className="pr-page__btn">
                <IconComment /> Comment
              </button>
              <button type="button" className="pr-page__btn">
                <IconClose /> Request changes
              </button>
              <button type="button" className="pr-page__btn pr-page__btn--approve">
                <IconCheck /> Approve
              </button>
              <button type="button" className="pr-page__btn pr-page__btn--merge">
                <IconMerge /> Squash & Merge
              </button>
            </div>
          </div>
          <div className="pr-page__hdr-meta">
            <span className="pr-page__chip">
              <span className="pr-page__chip-av">{activePr.authorAvatar}</span>
              {activePr.author}
            </span>
            <span className="pr-page__chip">
              <IconBranch />
              {activePr.branch} → {activePr.base}
            </span>
            <span className={`pr-page__chip pr-page__chip--ci-${activePr.ci}`}>
              <span className="pr-page__chip-dot" />
              CI {activePr.ci === "pass" ? "pass" : activePr.ci === "fail" ? "fail" : "running"} · 42/44
            </span>
            <span className="pr-page__chip">
              <IconDiff />
              {activePr.files} files · <span className="pr-page__add">+{activePr.added}</span>{" "}
              <span className="pr-page__rm">−{activePr.removed}</span>
            </span>
            {activePr.labels.map((l) => (
              <span key={l} className="pr-page__label">
                {l}
              </span>
            ))}
          </div>
          <div className="pr-page__hdr-gauge">
            <RiskGauge risk={activePr.risk} />
            <div className="pr-page__gauge-stats">
              <div className="pr-page__gauge-row">
                <span className="pr-page__gauge-k">Static engine</span>
                <span className="pr-page__gauge-v">
                  <span className="pr-page__gauge-big">{openFindings.length}</span> findings ·{" "}
                  <span className="pr-page__gauge-accent">{autofixable.length}</span> auto-fix
                </span>
              </div>
              <div className="pr-page__gauge-row">
                <span className="pr-page__gauge-k">Review</span>
                <span className="pr-page__gauge-v">
                  <span className="pr-page__gauge-big">{openReviews.length}</span> comments · 2 requested · 1 approved
                </span>
              </div>
              <div className="pr-page__gauge-row">
                <span className="pr-page__gauge-k">Progress</span>
                <span className="pr-page__gauge-v">
                  <span className="pr-page__gauge-big">{reviewedPct}%</span> of files reviewed
                </span>
              </div>
            </div>
          </div>
          <div className="pr-page__modebar">
            <div className="pr-page__modes" role="tablist">
              {(
                [
                  { id: "diff", label: "Diff", icon: <IconDiff /> },
                  { id: "insights", label: "Insights", icon: <IconSpark /> },
                  { id: "graph", label: "Graph", icon: <IconGraph /> },
                  { id: "tests", label: "Tests", icon: <IconFlask /> },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  className={`pr-page__mode${mode === m.id ? " is-active" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            {mode === "diff" && (
              <div className="pr-page__mode-tools">
                <button
                  type="button"
                  className={`pr-page__tool${splitView ? " is-on" : ""}`}
                  onClick={() => setSplitView((s) => !s)}
                  title="Unified / Split"
                >
                  {splitView ? "Split" : "Unified"}
                </button>
                <button
                  type="button"
                  className="pr-page__tool"
                  onClick={() => toggleReviewed(activePath)}
                >
                  {reviewedPaths.has(activePath) ? "✓ Reviewed" : "Mark Reviewed"}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="pr-page__canvas">
          {(() => {
            const View = VIEW_REGISTRY[mode];
            return <View file={activeFile} findings={findings} reviews={reviews} />;
          })()}
        </div>
      </main>

      {/* ══════ RIGHT: static engine + reviews ══════ */}
      <aside className="pr-page__right">
        <section className="pr-page__panel">
          <header className="pr-page__panel-head">
            <div className="pr-page__panel-title">
              p0 engine auto-review
            </div>
            <button type="button" className="pr-page__panel-cta" onClick={applyAllAutofix} disabled={autofixable.length === 0}>
              <IconMagic /> Fix {autofixable.length} in batch
            </button>
          </header>
          <div className="pr-page__sev-bar">
            {(["blocker", "high", "med", "low"] as Severity[]).map((s) => {
              const count = openFindings.filter((f) => f.sev === s).length;
              return (
                <span key={s} className={`pr-page__sev pr-page__sev--${s}`}>
                  <span className="pr-page__sev-dot" />
                  {SEV_META[s].label}
                  <span className="pr-page__sev-n">{count}</span>
                </span>
              );
            })}
          </div>

          <div className="pr-page__findings">
            {findings.map((f) => (
              <article
                key={f.id}
                className={`pr-page__finding pr-page__finding--${f.sev}${f.applied ? " is-applied" : ""}`}
              >
                <header className="pr-page__finding-head">
                  <span className={`pr-page__finding-sev pr-page__finding-sev--${f.sev}`}>
                    {SEV_META[f.sev].label}
                  </span>
                  <span className="pr-page__finding-rule">{f.rule}</span>
                </header>
                <div className="pr-page__finding-title">{f.title}</div>
                <div className="pr-page__finding-loc">
                  {f.path}:{f.line}
                </div>
                <p className="pr-page__finding-detail">{f.detail}</p>
                <footer className="pr-page__finding-foot">
                  {f.applied ? (
                    <span className="pr-page__finding-applied">
                      <IconCheck /> Applied
                    </span>
                  ) : f.autofix ? (
                    <button
                      type="button"
                      className="pr-page__apply-btn"
                      onClick={() => applyFinding(f.id)}
                    >
                      <IconMagic /> Auto-fix
                    </button>
                  ) : (
                    <span className="pr-page__finding-noauto">Needs manual review</span>
                  )}
                  <button type="button" className="pr-page__finding-jump">Jump to file</button>
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="pr-page__panel">
          <header className="pr-page__panel-head">
            <div className="pr-page__panel-title">
              <IconComment />
              Review comments
            </div>
            <span className="pr-page__panel-count">
              {openReviews.length}/{reviews.length}
            </span>
          </header>

          <div className="pr-page__reviews">
            {reviews.map((r) => (
              <article
                key={r.id}
                className={`pr-page__review${r.resolved ? " is-resolved" : ""}${r.applied ? " is-applied" : ""}`}
              >
                <header className="pr-page__review-head">
                  <span className="pr-page__review-av">{r.avatar}</span>
                  <span className="pr-page__review-author">{r.author}</span>
                  <span className="pr-page__review-when">{r.when}</span>
                </header>
                <div className="pr-page__review-loc">
                  {r.path.split("/").slice(-1)[0]}:{r.line}
                </div>
                <p className="pr-page__review-body">{r.body}</p>
                {r.suggestion && (
                  <pre className="pr-page__review-suggest">
                    <code>{r.suggestion}</code>
                  </pre>
                )}
                <footer className="pr-page__review-foot">
                  {r.applied ? (
                    <span className="pr-page__review-ok">
                      <IconCheck /> Auto-applied
                    </span>
                  ) : r.suggestion ? (
                    <button type="button" className="pr-page__apply-btn" onClick={() => applyReview(r.id)}>
                      <IconMagic /> Auto-apply patch
                    </button>
                  ) : (
                    <button type="button" className="pr-page__review-resolve" onClick={() => resolveReview(r.id)}>
                      Mark resolved
                    </button>
                  )}
                  <button type="button" className="pr-page__review-reply">Reply</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

