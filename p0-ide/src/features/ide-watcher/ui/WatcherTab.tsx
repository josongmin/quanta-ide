import { useEffect } from "react";
import {
  MOCK_WATCHER_SNAPSHOT,
  selectSnapshot,
  useWatcherStore,
  type NowWatchingItem,
} from "@/entities/watcher";
import { WatcherVitals } from "./WatcherVitals";
import { WatcherSparkline } from "./WatcherSparkline";
import { WatcherNowWatching } from "./WatcherNowWatching";

interface WatcherTabProps {
  /** Now watching item 클릭 시 부모가 처리할 navigation. */
  onNavigate?: (item: NowWatchingItem) => void;
}

/**
 * Watcher 탭 (Tier 0 Persistent).
 *
 * 책임:
 *  - watcher store 구독
 *  - 3-column(Vitals / Sparkline / NowWatching) 조립
 *
 * Phase 1.5에선 store가 빈 스냅샷이면 mock seed로 채운다.
 * Phase 2 이후 stability tracker가 setSnapshot으로 주입하기 시작하면
 * 이 seed 코드를 제거한다.
 */
export function WatcherTab({ onNavigate }: WatcherTabProps) {
  const snapshot = useWatcherStore(selectSnapshot);
  const setSnapshot = useWatcherStore((s) => s.setSnapshot);

  useEffect(() => {
    if (snapshot.impactedFiles === 0 && snapshot.series.length === 0) {
      setSnapshot(MOCK_WATCHER_SNAPSHOT);
    }
    // 1회만 시드. 이후 외부 계산기가 갱신.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startLabel =
    snapshot.series.length > 0 ? String(snapshot.series[0]) : undefined;
  const endLabel = String(snapshot.impactedFiles);

  return (
    <div className="wt-root">
      <div className="wt-row">
        <div className="wt-col wt-col-vitals">
          <WatcherVitals
            impactedFiles={snapshot.impactedFiles}
            status={snapshot.status}
            trend={snapshot.trend}
          />
        </div>
        <div className="wt-col wt-col-spark">
          <WatcherSparkline
            series={snapshot.series}
            startLabel={startLabel}
            endLabel={endLabel}
            inFlux={snapshot.status === "in-flux"}
          />
        </div>
        <div className="wt-col wt-col-now">
          <WatcherNowWatching items={snapshot.nowWatching} onItemClick={onNavigate} />
        </div>
      </div>
    </div>
  );
}
