import { useMemo, useState } from "react";
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
          {mode === "diff" && (
            <DiffView file={activeFile} findings={findings} reviews={reviews} />
          )}
          {mode === "insights" && <InsightsView />}
          {mode === "graph" && <GraphView />}
          {mode === "tests" && <TestsView />}
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

/* ─────────── DiffView ─────────── */

function DiffView({
  file,
  findings,
  reviews,
}: {
  file: FileDiff;
  findings: Finding[];
  reviews: ReviewComment[];
}) {
  if (file.hunks.length === 0) {
    return (
      <div className="pr-page__diff-empty">
        <div className="pr-page__diff-empty-icon">···</div>
        <p>This file isn't loaded in the view yet. Pick another file from the left.</p>
      </div>
    );
  }
  return (
    <div className="pr-page__diff">
      <header className="pr-page__diff-head">
        <span className={`pr-page__file-st pr-page__file-st--${file.status}`}>{file.status}</span>
        <span className="pr-page__diff-path">{file.path}</span>
        <span className="pr-page__diff-nums">
          <span className="pr-page__add">+{file.added}</span>
          <span className="pr-page__rm">−{file.removed}</span>
        </span>
        <span className={`pr-page__diff-risk pr-page__diff-risk--${riskBand(file.risk)}`}>
          Risk {file.risk.toFixed(2)}
        </span>
      </header>
      <div className="pr-page__diff-body">
        {file.hunks.map((hunk, hi) => (
          <div key={hi} className="pr-page__hunk">
            {hunk.map((line, li) => {
              const finding = line.inlineFinding ? findings.find((f) => f.id === line.inlineFinding) : undefined;
              const review = line.inlineReview ? reviews.find((r) => r.id === line.inlineReview) : undefined;
              return (
                <div key={li}>
                  <div className={`pr-page__row pr-page__row--${line.kind}`}>
                    <span className="pr-page__gutter pr-page__gutter--l">{line.ln ?? ""}</span>
                    <span className="pr-page__gutter pr-page__gutter--r">{line.rn ?? ""}</span>
                    <span className="pr-page__mark">
                      {line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}
                    </span>
                    <span className="pr-page__code">{line.text}</span>
                    {finding && (
                      <span className={`pr-page__inline-pip pr-page__inline-pip--${finding.sev}`}>
                        {SEV_META[finding.sev].label}
                      </span>
                    )}
                    {review && <span className="pr-page__inline-pip pr-page__inline-pip--review">Review</span>}
                  </div>
                  {finding && !finding.applied && (
                    <div className={`pr-page__inline-panel pr-page__inline-panel--${finding.sev}`}>
                      <div className="pr-page__inline-panel-head">
                        <span className={`pr-page__finding-sev pr-page__finding-sev--${finding.sev}`}>
                          {SEV_META[finding.sev].label}
                        </span>
                        <span className="pr-page__inline-rule">{finding.rule}</span>
                      </div>
                      <div className="pr-page__inline-panel-title">{finding.title}</div>
                      <p className="pr-page__inline-panel-detail">{finding.detail}</p>
                    </div>
                  )}
                  {review && !review.resolved && (
                    <div className="pr-page__inline-panel pr-page__inline-panel--review">
                      <div className="pr-page__inline-panel-head">
                        <span className="pr-page__review-av">{review.avatar}</span>
                        <span className="pr-page__review-author">{review.author}</span>
                        <span className="pr-page__review-when">{review.when}</span>
                      </div>
                      <p className="pr-page__inline-panel-detail">{review.body}</p>
                      {review.suggestion && (
                        <pre className="pr-page__review-suggest">
                          <code>{review.suggestion}</code>
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── InsightsView ─────────── */

function InsightsView() {
  return (
    <div className="pr-page__insights">
      <div className="pr-page__ins-grid">
        <InsCard
          title="Blast Radius"
          hero="23"
          unit="files"
          delta={{ dir: "up", value: "+5", from: "was 18 on main" }}
          sub="transitively affected"
          foot="4 cross-service hops"
          tone="high"
          chart={<BlastChart />}
        />
        <InsCard
          title="Structural Risk"
          hero="0.72"
          delta={{ dir: "up", value: "+0.18", from: "was 0.54 last PR" }}
          sub="engine score · threshold 0.60"
          foot="2 blockers · 5 high"
          tone="crit"
          chart={<RiskChart />}
        />
        <InsCard
          title="Coverage"
          hero="38.6%"
          delta={{ dir: "down", value: "−3.4pp", from: "from 42.0%" }}
          sub="line coverage in payments/*"
          foot="2 new tests · 4 regressions"
          tone="warn"
          chart={<CovChart />}
        />
        <InsCard
          title="Complexity"
          hero="18"
          unit="cyc"
          delta={{ dir: "up", value: "+6", from: "was 12 on main" }}
          sub="retry_handler · budget 15"
          foot="4 files over budget"
          tone="warn"
          chart={<ComplexChart />}
        />
        <InsCard
          title="Test Pass Rate"
          hero="98.1%"
          delta={{ dir: "up", value: "+0.4pp", from: "from 97.7%" }}
          sub="412 / 420 passing"
          foot="+12 new tests · 0 flaky"
          tone="low"
          chart={<TestRateChart />}
        />
        <InsCard
          title="API Latency p99"
          hero="142"
          unit="ms"
          delta={{ dir: "up", value: "+8ms", from: "budget 200ms" }}
          sub="payments/* · 30d window"
          foot="stable · within budget"
          tone="med"
          chart={<LatencyChart />}
        />
      </div>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Call graph changes</h3>
          <span className="pr-page__ins-sub">Impact paths tracked by the static engine</span>
        </header>
        <ul className="pr-page__ins-list">
          {[
            { from: "webhook.handle", to: "retry_handler.retry_with_backoff", kind: "modified", hops: 3 },
            { from: "retry_handler.retry_with_backoff", to: "orchestrator.execute", kind: "signature", hops: 1 },
            { from: "orchestrator.execute", to: "ledger.update", kind: "concurrency", hops: 2 },
            { from: "ledger.update", to: "metrics.emit", kind: "new", hops: 1 },
          ].map((e) => (
            <li key={`${e.from}-${e.to}`} className="pr-page__ins-edge">
              <span className={`pr-page__ins-kind pr-page__ins-kind--${e.kind}`}>{e.kind}</span>
              <span className="pr-page__ins-from">{e.from}</span>
              <span className="pr-page__ins-arrow">→</span>
              <span className="pr-page__ins-to">{e.to}</span>
              <span className="pr-page__ins-hops">{e.hops} hop</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Past incident similarity</h3>
          <span className="pr-page__ins-sub">Prior incidents with overlapping structural patterns</span>
        </header>
        <ul className="pr-page__ins-incidents">
          {[
            { id: "INC-842", title: "ledger double-write on refund retry", sim: 0.89, when: "2025-11" },
            { id: "INC-701", title: "jitterless backoff storm on webhooks", sim: 0.74, when: "2025-08" },
            { id: "INC-655", title: "guard leak in auth rotation", sim: 0.52, when: "2025-06" },
          ].map((i) => (
            <li key={i.id} className="pr-page__ins-inc">
              <span className="pr-page__ins-inc-id">{i.id}</span>
              <span className="pr-page__ins-inc-title">{i.title}</span>
              <span className="pr-page__ins-inc-bar">
                <span style={{ width: `${i.sim * 100}%` }} />
              </span>
              <span className="pr-page__ins-inc-sim">{Math.round(i.sim * 100)}%</span>
              <span className="pr-page__ins-inc-when">{i.when}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-page__ins-sec">
        <header className="pr-page__ins-head">
          <h3>Ownership</h3>
          <span className="pr-page__ins-sub">Owners of modules touched by this change</span>
        </header>
        <div className="pr-page__ins-owners">
          {[
            { team: "Payments Core", owner: "alice", share: 0.62, files: 5 },
            { team: "Shared Infra", owner: "bento", share: 0.23, files: 2 },
            { team: "QA Automation", owner: "claire", share: 0.15, files: 2 },
          ].map((o) => (
            <div key={o.team} className="pr-page__ins-owner">
              <div className="pr-page__ins-owner-top">
                <span className="pr-page__ins-owner-team">{o.team}</span>
                <span className="pr-page__ins-owner-share">{Math.round(o.share * 100)}%</span>
              </div>
              <div className="pr-page__ins-owner-bar">
                <span style={{ width: `${o.share * 100}%` }} />
              </div>
              <div className="pr-page__ins-owner-foot">
                <span>@{o.owner}</span>
                <span>{o.files} files</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type InsTone = "low" | "med" | "high" | "warn" | "crit";
interface InsDelta {
  dir: "up" | "down" | "flat";
  value: string;
  /** secondary baseline reference shown next to the delta */
  from?: string;
}

function InsCard({
  title,
  hero,
  unit,
  delta,
  sub,
  foot,
  tone,
  chart,
}: {
  title: string;
  hero: string;
  unit?: string;
  delta?: InsDelta;
  sub: string;
  foot: string;
  tone: InsTone;
  chart: React.ReactNode;
}) {
  /* Whether a delta is "good" depends on the metric.
     For tone "low" (success) the metric is healthy → up = good.
     For tones high/crit/warn the metric is bad → up = bad.
     Med is neutral. */
  const goodDirection =
    tone === "low" ? "up" : tone === "med" ? null : "down";
  const isGood = delta && goodDirection && delta.dir === goodDirection;
  const isBad = delta && goodDirection && delta.dir !== goodDirection && delta.dir !== "flat";

  return (
    <article className={`pr-page__ins-card pr-page__ins-card--${tone}`}>
      <header className="pr-page__ins-card-head">{title}</header>
      <div className="pr-page__ins-card-row">
        <div className="pr-page__ins-card-hero">
          {hero}
          {unit && <span className="pr-page__ins-card-unit">{unit}</span>}
        </div>
        {delta && (
          <span
            className={`pr-page__ins-card-delta${
              isGood ? " is-good" : isBad ? " is-bad" : ""
            }`}
          >
            <DeltaArrow dir={delta.dir} />
            {delta.value}
          </span>
        )}
      </div>
      <div className="pr-page__ins-card-sub">
        {sub}
        {delta?.from && <span className="pr-page__ins-card-from"> · {delta.from}</span>}
      </div>
      <div className="pr-page__ins-card-chart">{chart}</div>
      <footer className="pr-page__ins-card-foot">{foot}</footer>
    </article>
  );
}

function DeltaArrow({ dir }: { dir: InsDelta["dir"] }) {
  if (dir === "up") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 8l3-4 3 4" />
      </svg>
    );
  }
  if (dir === "down") {
    return (
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 4l3 4 3-4" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h6" />
    </svg>
  );
}

/* All charts use a wide viewBox (240×40) that roughly matches the rendered
   container aspect, so circles/dots stay round instead of getting stretched. */
function BlastChart() {
  // 4 columns of nodes spreading out (root → tier 1 → tier 2 → tier 3)
  const cols = [24, 88, 152, 216];
  const tier1 = [12, 22, 30];
  const tier2 = [6, 14, 22, 28, 34];
  const tier3 = [8, 18, 26, 32];
  const lines: [number, number, number, number][] = [];
  // root → tier1
  for (const y of tier1) lines.push([cols[0], 20, cols[1], y]);
  // tier1 → tier2 (each tier1 node connects to ~2 tier2 nodes)
  for (let i = 0; i < tier1.length; i++) {
    lines.push([cols[1], tier1[i], cols[2], tier2[i]]);
    lines.push([cols[1], tier1[i], cols[2], tier2[i + 1]]);
  }
  // tier2 → tier3
  for (let i = 0; i < tier2.length; i++) {
    if (tier3[i] !== undefined) lines.push([cols[2], tier2[i], cols[3], tier3[i]]);
  }
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="0.9"
        />
      ))}
      <circle cx={cols[0]} cy={20} r="3.4" fill="currentColor" />
      {tier1.map((y, i) => <circle key={`a${i}`} cx={cols[1]} cy={y} r="1.8" fill="currentColor" />)}
      {tier2.map((y, i) => <circle key={`b${i}`} cx={cols[2]} cy={y} r="1.8" fill="currentColor" />)}
      {tier3.map((y, i) => <circle key={`c${i}`} cx={cols[3]} cy={y} r="1.8" fill="currentColor" />)}
    </svg>
  );
}
function RiskChart() {
  const pts = [0.12, 0.18, 0.22, 0.19, 0.28, 0.34, 0.4, 0.46, 0.54, 0.58, 0.68, 0.72];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p * 40}`)
    .join(" ");
  // threshold line at 0.60 (engine "blocker" cutoff)
  const thresholdY = 40 - 0.6 * 40;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1] * 40;
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.15" />
      <line
        x1="0"
        y1={thresholdY}
        x2="240"
        y2={thresholdY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}
function CovChart() {
  const heights = [24, 28, 26, 30, 28, 32, 30, 28, 22, 20, 18, 16];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect key={i} x={i * 20 + 4} y={40 - h} width="14" height={h} fill="currentColor" fillOpacity="0.7" />
      ))}
    </svg>
  );
}
function ComplexChart() {
  // y values are inverse of complexity score (higher complexity = lower y)
  const pts = [32, 30, 28, 22, 18, 14, 10];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${p}`)
    .join(" ");
  // budget line at cyclomatic 15 (≈ y 17 in the inverted coord)
  const budgetY = 17;
  const lastX = ((pts.length - 1) * 240) / (pts.length - 1);
  const lastY = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={(i * 240) / (pts.length - 1)}
          cy={p}
          r={i === pts.length - 1 ? 2.4 : 1.6}
          fill="currentColor"
        />
      ))}
      <circle cx={lastX} cy={lastY} r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
    </svg>
  );
}
function TestRateChart() {
  // mostly-passing bars with two dips (the failing builds)
  const heights = [26, 28, 27, 29, 28, 30, 14, 29, 28, 27, 29, 17];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="none">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 20 + 4}
          y={40 - h}
          width="14"
          height={h}
          fill="currentColor"
          fillOpacity={h < 20 ? 0.35 : 0.7}
        />
      ))}
    </svg>
  );
}
function LatencyChart() {
  const pts = [22, 20, 24, 22, 26, 23, 21, 25, 24, 22, 26, 24];
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * 240) / (pts.length - 1)} ${40 - p}`)
    .join(" ");
  // budget line near the top of the chart (200ms budget)
  const budgetY = 6;
  const lastX = 240;
  const lastY = 40 - pts[pts.length - 1];
  return (
    <svg viewBox="0 0 240 40" preserveAspectRatio="xMidYMid meet">
      <line
        x1="0"
        y1={budgetY}
        x2="240"
        y2={budgetY}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.7"
        strokeDasharray="2 2"
      />
      <path d={`${d} L 240 40 L 0 40 Z`} fill="currentColor" fillOpacity="0.12" />
      <path d={d} stroke="currentColor" fill="none" strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}

/* ─────────── GraphView ─────────── */

function GraphView() {
  const nodes = [
    { id: "webhook", label: "webhook.handle", x: 80, y: 180, layer: 0 },
    { id: "retry", label: "retry_with_backoff", x: 260, y: 110, layer: 1, changed: true },
    { id: "guard", label: "IdempotencyGuard", x: 260, y: 250, layer: 1, added: true },
    { id: "orchestr", label: "orchestrator.execute", x: 450, y: 110, layer: 2, changed: true },
    { id: "ledger", label: "ledger.update", x: 450, y: 250, layer: 2, changed: true, risky: true },
    { id: "store", label: "store.write", x: 640, y: 180, layer: 3 },
    { id: "metrics", label: "metrics.emit", x: 640, y: 60, layer: 3 },
    { id: "notify", label: "_notify", x: 640, y: 300, layer: 3 },
  ];
  const edges: { a: string; b: string; kind: "ctx" | "mod" | "new" | "risk" }[] = [
    { a: "webhook", b: "retry", kind: "mod" },
    { a: "retry", b: "guard", kind: "new" },
    { a: "retry", b: "orchestr", kind: "mod" },
    { a: "orchestr", b: "ledger", kind: "risk" },
    { a: "ledger", b: "store", kind: "mod" },
    { a: "ledger", b: "notify", kind: "ctx" },
    { a: "retry", b: "metrics", kind: "new" },
  ];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div className="pr-page__graph">
      <header className="pr-page__graph-head">
        <h3>Call graph · change impact</h3>
        <div className="pr-page__graph-legend">
          <span className="pr-page__lg pr-page__lg--changed">modified</span>
          <span className="pr-page__lg pr-page__lg--added">new</span>
          <span className="pr-page__lg pr-page__lg--risky">blocker</span>
          <span className="pr-page__lg pr-page__lg--ctx">unchanged</span>
        </div>
      </header>
      <svg className="pr-page__graph-svg" viewBox="0 0 740 360">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = byId[e.a];
          const b = byId[e.b];
          return (
            <line
              key={i}
              className={`pr-page__edge pr-page__edge--${e.kind}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              markerEnd="url(#arrow)"
            />
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.id}
            className={`pr-page__node${n.changed ? " is-changed" : ""}${n.added ? " is-added" : ""}${n.risky ? " is-risky" : ""}`}
            transform={`translate(${n.x - 70},${n.y - 18})`}
          >
            <rect width="140" height="36" rx="6" />
            <text x="70" y="22" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─────────── TestsView ─────────── */

function TestsView() {
  const suites = [
    { name: "tests/payments/test_retry.py", total: 14, pass: 12, fail: 1, skip: 1, ms: 842, delta: "+2" },
    { name: "tests/payments/test_ledger.py", total: 9, pass: 9, fail: 0, skip: 0, ms: 412, delta: "+0" },
    { name: "tests/shared/test_idempotency.py", total: 8, pass: 8, fail: 0, skip: 0, ms: 86, delta: "new" },
    { name: "tests/payments/test_refund_integration.py", total: 6, pass: 5, fail: 1, skip: 0, ms: 2140, delta: "+0" },
  ];
  return (
    <div className="pr-page__tests">
      <header className="pr-page__tests-head">
        <div className="pr-page__tests-summary">
          <div className="pr-page__tests-big">34 / 37</div>
          <div className="pr-page__tests-sub">tests passing · 2 failing · 1 skipped</div>
        </div>
        <div className="pr-page__tests-bars">
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Total</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "91%" }} />
              <span className="pr-page__tests-bar-fail" style={{ width: "6%" }} />
              <span className="pr-page__tests-bar-skip" style={{ width: "3%" }} />
            </span>
            <span className="pr-page__tests-bar-v">91%</span>
          </div>
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Change cov</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "72%" }} />
              <span className="pr-page__tests-bar-fail" style={{ width: "0%" }} />
            </span>
            <span className="pr-page__tests-bar-v">72%</span>
          </div>
          <div className="pr-page__tests-bar">
            <span className="pr-page__tests-bar-k">Error paths</span>
            <span className="pr-page__tests-bar-track">
              <span className="pr-page__tests-bar-pass" style={{ width: "38%" }} />
            </span>
            <span className="pr-page__tests-bar-v">38%</span>
          </div>
        </div>
      </header>

      <table className="pr-page__tests-table">
        <thead>
          <tr>
            <th>Suite</th>
            <th>Total</th>
            <th>Pass</th>
            <th>Fail</th>
            <th>Skip</th>
            <th>ms</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {suites.map((s) => (
            <tr key={s.name} className={s.fail > 0 ? "is-fail" : ""}>
              <td className="pr-page__tests-name">{s.name}</td>
              <td>{s.total}</td>
              <td className="pr-page__tests-pass">{s.pass}</td>
              <td className="pr-page__tests-fail">{s.fail}</td>
              <td className="pr-page__tests-skip">{s.skip}</td>
              <td>{s.ms}</td>
              <td className="pr-page__tests-delta">{s.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="pr-page__tests-fail-list">
        <header>Failed tests</header>
        <article className="pr-page__tests-fail-item">
          <div className="pr-page__tests-fail-name">
            test_retry.py::test_exponential_backoff_without_jitter
          </div>
          <pre>
            <code>{`AssertionError: jitter window expected [100, 400) got 250
  where 250 == constant(250)`}</code>
          </pre>
          <button type="button" className="pr-page__apply-btn">
            <IconMagic /> Apply engine suggestion
          </button>
        </article>
        <article className="pr-page__tests-fail-item">
          <div className="pr-page__tests-fail-name">
            test_refund_integration.py::test_double_webhook_idempotent
          </div>
          <pre>
            <code>{`LedgerDuplicateWrite: entry=rf_9281 written twice
  at ledger.py:42`}</code>
          </pre>
          <button type="button" className="pr-page__apply-btn">
            <IconMagic /> Apply engine suggestion
          </button>
        </article>
      </section>
    </div>
  );
}

/* ─────────── RiskGauge ─────────── */

function RiskGauge({ risk }: { risk: number }) {
  const rad = (risk - 1) * Math.PI;
  const endX = 60 + 50 * Math.cos(rad);
  const endY = 60 + 50 * Math.sin(rad);
  const needleX = 60 + 38 * Math.cos(rad);
  const needleY = 60 + 38 * Math.sin(rad);
  const band = riskBand(risk);
  return (
    <div className={`pr-page__gauge pr-page__gauge--${band}`}>
      <svg viewBox="0 0 120 70">
        <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path
          d={`M 10 60 A 50 50 0 0 1 ${endX} ${endY}`}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <line x1="60" y1="60" x2={needleX} y2={needleY} stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="60" r="2.5" fill="var(--fg)" />
      </svg>
      <div className="pr-page__gauge-value">{risk.toFixed(2)}</div>
      <div className="pr-page__gauge-label">Structural risk</div>
    </div>
  );
}

/* ─────────── icons ─────────── */

const I = { fill: "none" as const, stroke: "currentColor" as const, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconRefresh() { return <svg width="13" height="13" viewBox="0 0 24 24" {...I}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>; }
function IconSearch() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>; }
function IconBranch() { return <svg width="11" height="11" viewBox="0 0 24 24" {...I}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8M18 10c0 4-6 4-6 8" /></svg>; }
function IconPrDot() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5" /></svg>; }
function IconComment() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function IconClose() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>; }
function IconCheck() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><polyline points="20 6 9 17 4 12" /></svg>; }
function IconMerge() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M6 8v8M6 6c0 6 6 6 6 12" /></svg>; }
function IconDiff() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><path d="M8 3v18M16 3v18M3 8h10M11 16h10" /></svg>; }
function IconSpark() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>; }
function IconGraph() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M6.6 7.4 10.6 16.6M17.4 7.4 13.4 16.6" /></svg>; }
function IconFlask() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><path d="M9 3h6M10 3v6l-6 10a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-10V3" /></svg>; }
function IconMagic() { return <svg width="12" height="12" viewBox="0 0 24 24" {...I}><path d="M15 4V2M15 10V8M11 6H9M21 6h-2M18.5 3.5 17 5M18.5 8.5 17 7M4 20l12-12M8 16l4 4" /></svg>; }
