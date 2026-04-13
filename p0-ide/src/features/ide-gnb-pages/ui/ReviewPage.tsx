import { useState } from "react";

type ReviewTab = "queue" | "preflight" | "radar";

const PR_QUEUE = [
  { id: "PR-347", title: "Add idempotency guard to refund path", author: "alice", riskScore: 0.87, filesChanged: 4, impactFiles: 23, status: "needs-review" as const, reviewers: ["bob", "charlie"], created: "2h ago" },
  { id: "PR-342", title: "Migrate webhook handler to async", author: "bob", riskScore: 0.64, filesChanged: 3, impactFiles: 12, status: "approved" as const, reviewers: ["alice"], created: "1d ago" },
  { id: "PR-339", title: "Fix fee calculation rounding", author: "charlie", riskScore: 0.31, filesChanged: 1, impactFiles: 3, status: "needs-review" as const, reviewers: [], created: "2d ago" },
  { id: "PR-335", title: "Update routing policy weights", author: "dave", riskScore: 0.52, filesChanged: 2, impactFiles: 8, status: "changes-requested" as const, reviewers: ["alice", "bob"], created: "3d ago" },
  { id: "PR-331", title: "Add health check endpoint logging", author: "eve", riskScore: 0.12, filesChanged: 1, impactFiles: 1, status: "approved" as const, reviewers: ["charlie"], created: "4d ago" },
];

const PREFLIGHT = {
  pr: "PR-347",
  filesChanged: 4,
  realImpact: 23,
  brokenTests: 2,
  newTaintPaths: 1,
  behaviorChanges: [
    { type: "semantic" as const, file: "orchestrator.py", line: 73, desc: "Retry condition now checks idempotency key existence" },
    { type: "behavior" as const, file: "ledger.py", line: 45, desc: "Ledger write now guarded by dedup check — may skip valid retries" },
    { type: "syntax" as const, file: "fee.py", line: 22, desc: "Variable rename: amount → refund_amount" },
  ],
  reviewPriority: [
    { file: "orchestrator.py", reason: "Core logic change + highest blast radius", priority: 1 },
    { file: "ledger.py", reason: "Behavior change in critical write path", priority: 2 },
    { file: "retry_handler.py", reason: "Retry logic modified", priority: 3 },
    { file: "fee.py", reason: "Syntax-only rename, low risk", priority: 4 },
  ],
};

const RADAR = {
  stale: [
    { branch: "feat/batch-webhook", daysSinceUpdate: 14, author: "bob", conflicts: true },
    { branch: "fix/ledger-rounding", daysSinceUpdate: 21, author: "dave", conflicts: false },
  ],
  ownershipGaps: [
    { file: "infrastructure/webhook.py", owners: 0, lastTouched: "3mo ago" },
    { file: "shared/reasoning.py", owners: 0, lastTouched: "6mo ago" },
  ],
};

export function ReviewPage() {
  const [tab, setTab] = useState<ReviewTab>("queue");
  const [selectedPr, setSelectedPr] = useState(PR_QUEUE[0].id);

  return (
    <div className="gnb-page gnb-review">
      <div className="gnb-page-header">
        <h2 className="gnb-page-title">Code Review</h2>
        <p className="gnb-page-subtitle">PR queue, behavior diff &amp; pre-flight checks</p>
      </div>

      <div className="gnb-metric-cards">
        <div className="gnb-metric-card gnb-metric-card--accent">
          <span className="gnb-metric-card-value">{PR_QUEUE.filter((p) => p.status === "needs-review").length}</span>
          <span className="gnb-metric-card-label">Needs Review</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--success">
          <span className="gnb-metric-card-value">{PR_QUEUE.filter((p) => p.status === "approved").length}</span>
          <span className="gnb-metric-card-label">Approved</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--warn">
          <span className="gnb-metric-card-value">{RADAR.stale.length}</span>
          <span className="gnb-metric-card-label">Stale Branches</span>
        </div>
        <div className="gnb-metric-card gnb-metric-card--danger">
          <span className="gnb-metric-card-value">{RADAR.ownershipGaps.length}</span>
          <span className="gnb-metric-card-label">Ownership Gaps</span>
        </div>
      </div>

      <nav className="gnb-subtabs">
        {(["queue", "preflight", "radar"] as const).map((t) => (
          <button key={t} type="button" className={`gnb-subtab${tab === t ? " is-active" : ""}`} onClick={() => { setTab(t); }}>
            {t === "queue" ? "PR Queue" : t === "preflight" ? "Pre-flight" : "Radar"}
          </button>
        ))}
      </nav>

      <div className="gnb-page-body">
        {tab === "queue" && (
          <div className="gnb-table">
            <div className="gnb-table-head">
              <span>PR</span><span>Title</span><span>Author</span><span>Risk</span><span>Files</span><span>Impact</span><span>Status</span>
            </div>
            {PR_QUEUE.map((pr) => (
              <div
                key={pr.id}
                className={`gnb-table-row${selectedPr === pr.id ? " is-selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => { setSelectedPr(pr.id); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPr(pr.id); } }}
              >
                <span className="gnb-table-cell gnb-table-cell--mono">{pr.id}</span>
                <span className="gnb-table-cell">{pr.title}</span>
                <span className="gnb-table-cell">{pr.author}</span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${pr.riskScore > 0.7 ? "danger" : pr.riskScore > 0.4 ? "warn" : "success"}`}>{pr.riskScore.toFixed(2)}</span></span>
                <span className="gnb-table-cell">{pr.filesChanged}</span>
                <span className="gnb-table-cell">{pr.impactFiles}</span>
                <span className="gnb-table-cell"><span className={`gnb-badge gnb-badge--${pr.status === "needs-review" ? "warn" : pr.status === "approved" ? "success" : "danger"}`}>{pr.status}</span></span>
              </div>
            ))}
          </div>
        )}

        {tab === "preflight" && (
          <div className="gnb-preflight">
            <div className="gnb-metric-cards" style={{ marginBottom: 16 }}>
              <div className="gnb-metric-card"><span className="gnb-metric-card-value">{PREFLIGHT.filesChanged}</span><span className="gnb-metric-card-label">Changed</span></div>
              <div className="gnb-metric-card gnb-metric-card--danger"><span className="gnb-metric-card-value">{PREFLIGHT.realImpact}</span><span className="gnb-metric-card-label">Real Impact</span></div>
              <div className="gnb-metric-card gnb-metric-card--danger"><span className="gnb-metric-card-value">{PREFLIGHT.brokenTests}</span><span className="gnb-metric-card-label">Broken Tests</span></div>
              <div className="gnb-metric-card gnb-metric-card--warn"><span className="gnb-metric-card-value">{PREFLIGHT.newTaintPaths}</span><span className="gnb-metric-card-label">New Taint Paths</span></div>
            </div>
            <section className="gnb-section">
              <h3 className="gnb-section-title">Behavior Changes</h3>
              {PREFLIGHT.behaviorChanges.map((b, i) => (
                <div key={i} className="gnb-list-row">
                  <span className={`gnb-badge gnb-badge--${b.type === "behavior" ? "danger" : b.type === "semantic" ? "warn" : "info"}`}>{b.type}</span>
                  <span className="gnb-list-row-name">{b.desc}</span>
                  <span className="gnb-list-row-meta">{b.file}:{b.line}</span>
                </div>
              ))}
            </section>
            <section className="gnb-section">
              <h3 className="gnb-section-title">Review Priority</h3>
              {PREFLIGHT.reviewPriority.map((r) => (
                <div key={r.file} className="gnb-list-row">
                  <span className="gnb-badge gnb-badge--info">#{r.priority}</span>
                  <span className="gnb-list-row-name">{r.file}</span>
                  <span className="gnb-list-row-meta">{r.reason}</span>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === "radar" && (
          <div className="gnb-overview-grid">
            <section className="gnb-section">
              <h3 className="gnb-section-title">Stale Branches</h3>
              {RADAR.stale.map((s) => (
                <div key={s.branch} className="gnb-list-row">
                  <span className="gnb-list-row-name">{s.branch}</span>
                  <span className="gnb-list-row-meta">{s.author} · {s.daysSinceUpdate}d ago</span>
                  {s.conflicts && <span className="gnb-badge gnb-badge--danger">conflicts</span>}
                </div>
              ))}
            </section>
            <section className="gnb-section">
              <h3 className="gnb-section-title">Ownership Gaps</h3>
              {RADAR.ownershipGaps.map((g) => (
                <div key={g.file} className="gnb-list-row">
                  <span className="gnb-list-row-name">{g.file}</span>
                  <span className="gnb-list-row-meta">Last touched {g.lastTouched}</span>
                  <span className="gnb-badge gnb-badge--danger">no owner</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
