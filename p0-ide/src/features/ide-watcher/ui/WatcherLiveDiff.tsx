import type { LiveDiffEntry } from "@/entities/watcher";

interface Props {
  entries: readonly LiveDiffEntry[];
}

function ago(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export function WatcherLiveDiff({ entries }: Props) {
  return (
    <div className="wt-diff" aria-label="Live diff feed">
      <div className="wt-diff-header">
        <span className="wt-section-title">Live Changes</span>
        <span className="wt-diff-count">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <div className="wt-diff-empty">idle</div>
      ) : (
        <ul className="wt-diff-list">
          {entries.map(e => (
            <li key={e.id} className="wt-diff-item">
              <div className="wt-diff-row-top">
                <span className="wt-diff-file">{e.file}</span>
                <span className="wt-diff-ago">{ago(e.agoSec)}</span>
              </div>
              <div className="wt-diff-row-bot">
                <span className="wt-diff-stat">
                  <span className="wt-diff-add">+{e.linesAdded}</span>
                  <span className="wt-diff-del">-{e.linesRemoved}</span>
                </span>
                <span className="wt-diff-summary">{e.summary}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
