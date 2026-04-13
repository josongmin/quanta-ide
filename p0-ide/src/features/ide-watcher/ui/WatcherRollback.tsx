import type { RollbackCheckpoint } from "@/entities/watcher";

interface Props {
  stack: readonly RollbackCheckpoint[];
  onRollback?: (checkpoint: RollbackCheckpoint) => void;
}

function ago(sec: number): string {
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export function WatcherRollback({ stack, onRollback }: Props) {
  return (
    <div className="wt-rollback" aria-label="Rollback checkpoints">
      <div className="wt-rollback-header">
        <span className="wt-section-title">Checkpoints</span>
        <span className="wt-rollback-count">{stack.length}</span>
      </div>
      {stack.length === 0 ? (
        <div className="wt-rollback-empty">no checkpoints</div>
      ) : (
        <ul className="wt-rollback-list">
          {stack.map((cp, i) => (
            <li key={cp.id} className="wt-rollback-item">
              <div className="wt-rollback-timeline">
                <span className={`wt-rollback-dot${i === 0 ? " is-latest" : ""}`} />
                {i < stack.length - 1 && <span className="wt-rollback-line" />}
              </div>
              <button
                type="button"
                className="wt-rollback-card"
                onClick={() => onRollback?.(cp)}
              >
                <span className="wt-rollback-label">{cp.label}</span>
                <span className="wt-rollback-meta">
                  {cp.filesChanged > 0 && <span>{cp.filesChanged} files</span>}
                  <span className="wt-rollback-ago">{ago(cp.agoSec)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
