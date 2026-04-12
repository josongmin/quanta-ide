import { create } from "zustand";
import type { NowWatchingItem, WatcherSnapshot, WatcherStatus, WatcherTrend } from "./types";

/**
 * Watcher store
 *
 * 단일 책임: Tier 0 Persistent Surface가 읽는 *현재 스냅샷*을 보관한다.
 *
 * 이 store는 stability/breakpoint 계산 로직을 *알지 못한다*. Phase 2 이후
 * features/ide-stability-tracker 같은 외부 모듈이 setSnapshot으로 주입한다.
 * Phase 1.5에서는 mock seed로 시작하고, 데모 토글만 노출한다.
 *
 * SOLID:
 *  - SRP: 상태 보유 + 단순 setter만. 계산 X.
 *  - OCP: 외부 계산기는 setSnapshot으로 갈아끼움. store 변경 없음.
 *  - DIP: features/widgets는 store interface에만 의존.
 */

const INITIAL_SNAPSHOT: WatcherSnapshot = {
  impactedFiles: 0,
  status: "stable",
  trend: "steady",
  series: [],
  peak: 0,
  nowWatching: [],
};

interface WatcherState {
  snapshot: WatcherSnapshot;
  /** 외부 계산기가 호출하는 단일 진입점. */
  setSnapshot: (next: WatcherSnapshot) => void;
  /** 부분 갱신 헬퍼. peak는 자동으로 max 유지. */
  patchSnapshot: (patch: Partial<WatcherSnapshot>) => void;
  /** envelope 시작/리셋. */
  reset: () => void;
}

export const useWatcherStore = create<WatcherState>()((set) => ({
  snapshot: INITIAL_SNAPSHOT,

  setSnapshot: (next) => {
    set({
      snapshot: {
        ...next,
        peak: Math.max(next.peak, next.impactedFiles),
      },
    });
  },

  patchSnapshot: (patch) => {
    set((state) => {
      const merged: WatcherSnapshot = { ...state.snapshot, ...patch };
      return {
        snapshot: {
          ...merged,
          peak: Math.max(merged.peak, merged.impactedFiles),
        },
      };
    });
  },

  reset: () => { set({ snapshot: INITIAL_SNAPSHOT }); },
}));

/* ── Selectors ─────────────────────────────────────────────────────────────── */
/* selector를 export해서 컴포넌트가 store shape에 직접 묶이지 않게 한다. */

export const selectSnapshot = (s: WatcherState): WatcherSnapshot => s.snapshot;
export const selectStatus = (s: WatcherState): WatcherStatus => s.snapshot.status;
export const selectTrend = (s: WatcherState): WatcherTrend => s.snapshot.trend;
export const selectImpactedFiles = (s: WatcherState): number => s.snapshot.impactedFiles;
export const selectSeries = (s: WatcherState): readonly number[] => s.snapshot.series;
export const selectNowWatching = (s: WatcherState): readonly NowWatchingItem[] =>
  s.snapshot.nowWatching;
