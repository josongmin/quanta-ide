import { cn } from "@/shared/lib";
import { PRS, FILES, riskBand } from "@/entities/pr";
import {
  IconRefresh,
  IconSearch,
  IconBranch,
  IconPrDot,
} from "../../lib/icons";

export function PrSidebar({
  activePrId,
  setActivePrId,
  activePath,
  setActivePath,
  queueFilter,
  setQueueFilter,
  filteredPrs,
  reviewedPaths,
  reviewedCount,
  totalFiles,
}: {
  activePrId: string;
  setActivePrId: (id: string) => void;
  activePath: string;
  setActivePath: (path: string) => void;
  queueFilter: "all" | "mine" | "review";
  setQueueFilter: (f: "all" | "mine" | "review") => void;
  filteredPrs: typeof PRS;
  reviewedPaths: Set<string>;
  reviewedCount: number;
  totalFiles: number;
}) {
  return (
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
            className={cn("pr-page__filter-tab", queueFilter === f && "is-active")}
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
        <input type="text" placeholder="Search PRs..." aria-label="Search pull requests" />
      </div>

      <nav className="pr-page__queue">
        {filteredPrs.map((pr) => {
          const active = pr.id === activePrId;
          return (
            <button
              key={pr.id}
              type="button"
              className={cn("pr-page__pr", active && "is-active")}
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
                  {pr.ci === "pass" ? "\u2713" : pr.ci === "fail" ? "\u2715" : "\u2026"} CI
                </span>
              </div>
              <div className="pr-page__pr-footer">
                <span className={`pr-page__pr-risk pr-page__pr-risk--${riskBand(pr.risk)}`}>
                  Risk {pr.risk.toFixed(2)}
                </span>
                <span className="pr-page__pr-delta">
                  <span className="pr-page__pr-add">+{pr.added}</span>
                  <span className="pr-page__pr-rm">-{pr.removed}</span>
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

      <FileList
        activePath={activePath}
        setActivePath={setActivePath}
        reviewedPaths={reviewedPaths}
      />
    </aside>
  );
}

function FileList({
  activePath,
  setActivePath,
  reviewedPaths,
}: {
  activePath: string;
  setActivePath: (path: string) => void;
  reviewedPaths: Set<string>;
}) {
  return (
    <ul className="pr-page__files" role="listbox" aria-label="Changed files">
      {FILES.map((f) => {
        const active = f.path === activePath;
        const isReviewed = reviewedPaths.has(f.path);
        return (
          <li
            key={f.path}
            role="option"
            aria-selected={active}
            tabIndex={0}
            className={cn("pr-page__file", active && "is-active", isReviewed && "is-reviewed")}
            onClick={() => setActivePath(f.path)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivePath(f.path); } }}
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
              <span className="pr-page__file-rm">-{f.removed}</span>
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
  );
}
