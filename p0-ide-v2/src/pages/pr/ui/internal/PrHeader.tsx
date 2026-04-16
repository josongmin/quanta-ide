import { cn } from "@/shared/lib";
import type { Mode, Finding, ReviewComment } from "@/entities/pr";
import { RiskGauge } from "../../lib/RiskGauge";
import {
  IconComment,
  IconClose,
  IconCheck,
  IconMerge,
  IconDiff,
  IconSpark,
  IconGraph,
  IconFlask,
  IconBranch,
} from "../../lib/icons";

interface PrHeaderProps {
  activePr: {
    number: number;
    title: string;
    author: string;
    authorAvatar: string;
    branch: string;
    base: string;
    ci: string;
    files: number;
    added: number;
    removed: number;
    labels: string[];
    risk: number;
  };
  mode: Mode;
  setMode: (m: Mode) => void;
  splitView: boolean;
  setSplitView: (fn: (s: boolean) => boolean) => void;
  activePath: string;
  reviewedPaths: Set<string>;
  toggleReviewed: (path: string) => void;
  openFindings: Finding[];
  autofixable: Finding[];
  openReviews: ReviewComment[];
  reviewedPct: number;
}

export function PrHeader({
  activePr,
  mode,
  setMode,
  splitView,
  setSplitView,
  activePath,
  reviewedPaths,
  toggleReviewed,
  openFindings,
  autofixable,
  openReviews,
  reviewedPct,
}: PrHeaderProps) {
  return (
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
          <span className="pr-page__rm">-{activePr.removed}</span>
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
              className={cn("pr-page__mode", mode === m.id && "is-active")}
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
              className={cn("pr-page__tool", splitView && "is-on")}
              onClick={() => setSplitView((s) => !s)}
              title="Unified / Split"
              aria-label="Toggle split view"
              aria-pressed={splitView}
            >
              {splitView ? "Split" : "Unified"}
            </button>
            <button
              type="button"
              className="pr-page__tool"
              onClick={() => toggleReviewed(activePath)}
            >
              {reviewedPaths.has(activePath) ? "\u2713 Reviewed" : "Mark Reviewed"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
