import type { WatcherSnapshot } from "./types";

/**
 * Phase 1.5 데모 시드.
 *
 * Stability/Breakpoint 계산기는 Phase 2 이후 도입. 그 전까지 Watcher 탭은
 * 이 정적 시드를 보여주고, 외부에서 setSnapshot으로 시연 시 갱신할 수 있다.
 */
export const MOCK_WATCHER_SNAPSHOT: WatcherSnapshot = {
  impactedFiles: 21,
  status: "stable",
  trend: "converging",
  series: [54, 51, 47, 44, 41, 38, 34, 30, 26, 23, 21],
  peak: 54,
  nowWatching: [
    { id: "f1", label: "strategy_selector.py", reason: "high churn", kind: "file" },
    { id: "p1", label: "2 API paths potentially affected", kind: "api-path" },
  ],
};
