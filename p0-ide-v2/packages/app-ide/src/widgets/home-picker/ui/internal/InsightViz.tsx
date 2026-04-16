import type { Insight, InsightTag } from "../../lib/home-picker.mock";
import { compact } from "../../lib/home-picker.utils";

export function InsightViz({ insight }: { insight: Insight }) {
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
