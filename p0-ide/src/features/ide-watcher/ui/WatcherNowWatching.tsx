import type { NowWatchingItem } from "@/entities/watcher";

interface WatcherNowWatchingProps {
  items: readonly NowWatchingItem[];
  onItemClick?: (item: NowWatchingItem) => void;
}

/**
 * Column 3 — Now watching
 * 엔진이 현재 주시 중인 대상 목록(0~3개).
 * 클릭 시 부모가 결정한 navigation 핸들러 호출.
 */
export function WatcherNowWatching({ items, onItemClick }: WatcherNowWatchingProps) {
  return (
    <div className="wt-now" aria-label="Now watching">
      <div className="wt-now-title">Now watching</div>
      {items.length === 0 ? (
        <div className="wt-now-empty">— quiet —</div>
      ) : (
        <ul className="wt-now-list">
          {items.map((item) => (
            <li key={item.id} className="wt-now-item">
              <button
                type="button"
                className="wt-now-btn"
                onClick={() => { onItemClick?.(item); }}
              >
                <span className="wt-now-arrow" aria-hidden>→</span>
                <span className="wt-now-label">{item.label}</span>
                {item.reason !== undefined && item.reason !== "" ? (
                  <span className="wt-now-reason">({item.reason})</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
