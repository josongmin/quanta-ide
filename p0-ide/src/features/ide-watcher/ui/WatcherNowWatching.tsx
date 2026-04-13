import type { NowWatchingItem } from "@/entities/watcher";

interface WatcherNowWatchingProps {
  items: readonly NowWatchingItem[];
  onItemClick?: (item: NowWatchingItem) => void;
}

const KIND_ICON: Record<NowWatchingItem["kind"], string> = {
  file: "◉",
  "api-path": "⬡",
  symbol: "◆",
};

/**
 * Column 3 — Now Watching (redesigned)
 * 카드 형태 아이템 + severity 인디케이터.
 */
export function WatcherNowWatching({ items, onItemClick }: WatcherNowWatchingProps) {
  return (
    <div className="wt-now" aria-label="Now watching">
      <div className="wt-now-header">
        <span className="wt-now-title">Now Watching</span>
        {items.length > 0 && (
          <span className="wt-now-count">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="wt-now-empty">
          <span className="wt-now-empty-icon" aria-hidden>○</span>
          <span>all quiet</span>
        </div>
      ) : (
        <ul className="wt-now-list">
          {items.map((item) => (
            <li key={item.id} className="wt-now-item">
              <button
                type="button"
                className={`wt-now-card wt-now-card-${item.kind}`}
                onClick={() => { onItemClick?.(item); }}
              >
                <span className="wt-now-icon" aria-hidden>
                  {KIND_ICON[item.kind]}
                </span>
                <span className="wt-now-content">
                  <span className="wt-now-label">{item.label}</span>
                  {item.reason !== undefined && item.reason !== "" && (
                    <span className="wt-now-reason">{item.reason}</span>
                  )}
                </span>
                <span className="wt-now-chevron" aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
